/**
 * CAS 统一认证集成
 * 流程: 未登录 -> 302 到学校统一认证 -> 登录成功后带 ticket 回调
 *        -> 本服务用 ticket 调 serviceValidate 验证并获取身份属性
 * 实测依据(2026-08 学生账号验证):
 *   - serviceValidate 返回 cas:user=学号, cas:userName=姓名,
 *     cas:containerId=ou=bzks,ou=People (本科生 OU)
 *   - 教师账号的 containerId 形态未验证, 判定采用"白名单式":
 *     只放行明确命中的 OU, 其余一律拒绝(安全优先)
 */

const AUTH_BASE = "https://authserver.bigc.edu.cn/authserver";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";

/** 生成跳转到统一认证的地址 */
export function buildLoginUrl(callbackUrl) {
  const service = encodeURIComponent(callbackUrl);
  return `${AUTH_BASE}/login?service=${service}`;
}

/** 用 ticket 换取用户身份, 返回 { ok, user, userName, containerId, attrs } */
export async function validateTicket(callbackUrl, ticket, env) {
  const service = encodeURIComponent(callbackUrl);
  const url = `${AUTH_BASE}/serviceValidate?service=${service}&ticket=${encodeURIComponent(ticket)}`;

  let resp;
  try {
    resp = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "manual",
    });
  } catch (e) {
    return { ok: false, error: `统一认证服务不可达: ${e.message}` };
  }

  const xml = await resp.text();

  // 认证失败
  const fail = xml.match(/<cas:authenticationFailure[^>]*code="([^"]+)"[^>]*>/);
  if (fail) {
    return { ok: false, error: `认证失败 (${fail[1]})` };
  }

  // 认证成功
  const user = xml.match(/<cas:user>([^<]+)<\/cas:user>/);
  if (!user) {
    return { ok: false, error: "统一认证返回了无法识别的响应" };
  }

  // 解析所有 cas:* 属性
  const attrs = {};
  const attrRe = /<cas:(\w+)>([^<]*)<\/cas:\1>/g;
  let m;
  while ((m = attrRe.exec(xml))) {
    attrs[m[1]] = m[2];
  }

  return {
    ok: true,
    user: user[1],
    userName: attrs.userName || attrs.cn || user[1],
    containerId: attrs.containerId || "",
    attrs,
  };
}

/**
 * 提取响应中的所有会话 cookie(name=value, 去掉 path/HttpOnly 等指令)
 * 注意: authserver 一次 Set 3 个 cookie(acw_tc/route/JSESSIONID),
 *       headers.get("Set-Cookie") 只取第一个, 必须用 getSetCookie() 全取
 */
function extractCookies(resp) {
  const all = typeof resp.headers.getSetCookie === "function"
    ? resp.headers.getSetCookie()
    : [resp.headers.get("Set-Cookie") || ""].filter(Boolean);
  const pairs = [];
  for (const c of all) {
    const pair = c.split(";")[0].trim();
    if (pair) pairs.push(pair);
  }
  return pairs.join("; ");
}

/** 身份判定: 是否学生(白名单式, 只放行命中的 OU) */
export function isStudent(identity, env) {
  const patterns = (env.STUDENT_CONTAINER_PATTERNS || "bzks")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const containerId = identity.containerId || "";
  return patterns.some((p) => containerId.includes(p));
}

/**
 * 后端代登录: 用学号+密码模拟统一认证登录, 换取身份标识
 * 流程: GET登录页(取execution/salt) -> AES加密密码POST -> 302拿ticket
 *       -> serviceValidate取身份属性(containerId等)
 * 注意: 密码明文只在本函数内存中使用, 不落盘不存储
 * service 使用 ehall 已注册地址(白名单内, 已实测 serviceValidate 可用)
 */
const SERVICE_EHALL = "https%3A%2F%2Fehall.bigc.edu.cn%2Flogin";

export async function loginWithPassword(env, username, rawPassword) {
  // 1. 获取登录页, 提取 execution + pwdEncryptSalt + 会话 cookie
  //    (execution 绑定服务端 session, POST 必须带上 GET 时的 cookie)
  let page;
  let sessionCookie = "";
  try {
    const resp = await fetch(`${AUTH_BASE}/login?service=${SERVICE_EHALL}`, {
      headers: { "User-Agent": UA },
      redirect: "manual",
    });
    sessionCookie = extractCookies(resp);
    page = await resp.text();
  } catch (e) {
    return { ok: false, error: `统一认证不可达: ${e.message}` };
  }

  // 应用未注册等错误页判断
  if (!page.includes("pwdEncryptSalt")) {
    return { ok: false, error: "统一认证登录页异常(可能服务维护)" };
  }

  const execution = page.match(/id="execution" name="execution" value="([^"]+)"/);
  const salt = page.match(/id="pwdEncryptSalt" value="([^"]+)"/);
  if (!execution || !salt) {
    return { ok: false, error: "无法解析登录参数" };
  }

  // 2. AES-CBC 加密密码(与学校前端 encrypt.js 算法一致)
  //    明文 = 64位随机字符 + 密码; Key = salt; IV = 16位随机字符
  const chars = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";
  const randStr = (n) => {
    let s = "";
    for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };
  const key = salt[1];
  const iv = randStr(16);
  const plain = new TextEncoder().encode(randStr(64) + rawPassword);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(key),
    { name: "AES-CBC" }, false, ["encrypt"]
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: new TextEncoder().encode(iv) }, cryptoKey, plain
  );
  // WebCrypto 默认 PKCS7 padding, 与学校一致
  const encrypted = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  // 3. POST 登录
  const body = new URLSearchParams({
    username,
    password: encrypted,
    cllt: "userNameLogin",
    dllt: "generalLogin",
    lt: "",
    execution: execution[1],
    _eventId: "submit",
    rmShown: "1",
  });
  let loginResp;
  try {
    loginResp = await fetch(`${AUTH_BASE}/login?service=${SERVICE_EHALL}`, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: sessionCookie,
      },
      body,
      redirect: "manual",
    });
  } catch (e) {
    return { ok: false, error: `登录请求失败: ${e.message}` };
  }

  const location = loginResp.headers.get("Location") || "";
  const ticket = location.match(/ticket=([^&]+)/);

  // 4. 登录失败(密码错误/验证码/锁定等)
  if (!ticket) {
    const htmlText = await loginResp.text();
    const m = htmlText.match(/class="login-error[^"]*"[^>]*>([^<]+)/) ||
              htmlText.match(/<span[^>]*id="errorTip"[^>]*>([^<]+)/) ||
              htmlText.match(/>(账号|密码|验证码|锁定|冻结|多次)[^<]{0,30}/);
    const msg = m ? m[1] || m[0] : `登录失败(状态码 ${loginResp.status})`;
    return { ok: false, error: msg.replace(/&nbsp;/g, " ").trim() };
  }

  // 5. 用 ticket 验证并取身份
  const identity = await validateTicket(
    "https://ehall.bigc.edu.cn/login", ticket[1], env
  );
  if (!identity.ok) {
    return { ok: false, error: `身份验证失败: ${identity.error}` };
  }
  return { ok: true, identity };
}

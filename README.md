# 北印课程评价系统 (survivebigc-course-review)

基于 Cloudflare Workers + D1 的课程评价系统。**仅在校学生可访问**:
学生可查看/提交课程评价, 教师/其他身份一律 403。

登录支持两种模式(`wrangler.toml` 的 `LOGIN_MODE` 配置):

| 模式 | 说明 | 适用场景 |
|---|---|---|
| `password`(当前) | **后端代登录**: 页面提交学号+密码, 后端模拟登录学校统一认证, 密码只在本请求内存中使用、不落盘 | authserver 未注册本应用时 |
| `cas` | 浏览器 302 跳转学校统一认证, 回调带 ticket 验证 | authserver 已注册本应用时 |

## 技术方案(已实测验证)

### 身份判定(两种模式共用)

- 用 ticket 调 `authserver.bigc.edu.cn/authserver/serviceValidate?service=...&ticket=...`
- 解析返回 XML 的 `cas:containerId`, 含 `bzks`(本科生 OU)即视为学生
  - 实测学生账号: `ou=bzks,ou=People`, `cas:user=学号`, `cas:userName=姓名`
  - **白名单式判定**: 只放行明确命中的 OU, 其余拒绝(安全优先)
  - ⚠️ 教师账号的 containerId 尚未实测, 建议后续用工号确认其 OU 形态,
    确认后把教师 OU 不在白名单中即可(默认已满足)

### password 模式(后端代登录, 已实测)

1. GET 登录页取 `execution`、`pwdEncryptSalt`、**全部会话 cookie**
   (⚠️ authserver 一次 Set 3 个 cookie: acw_tc/route/JSESSIONID,
   `headers.get("Set-Cookie")` 只取第一个, 必须用 `getSetCookie()` 全取,
   execution 绑定 session, 缺 cookie 必失败)
2. AES-128-CBC 加密密码: 明文 = 64位随机字符 + 密码(字符集与学校前端 encrypt.js 一致),
   Key = salt, IV = 16位随机字符, PKCS7 padding(WebCrypto 默认)
3. POST 登录(带 session cookie, service 用 ehall 已注册地址, 302 提取 ticket)
4. 用 ticket 调 serviceValidate 取身份(如上)
5. 限流: 同 IP 5 分钟内最多 5 次尝试(`login_attempts` 表, 不含任何密码信息)
6. 密码明文只存在于请求内存, 函数返回后即被丢弃, 不落盘不存储

## 本地开发

```bash
npm install -g wrangler        # 安装 wrangler(只需一次)
wrangler login                 # 浏览器登录你的 Cloudflare 账号(只需一次)
```

## 部署(Cloudflare 操作步骤)

### 1. 准备 Cloudflare 账号

打开 https://dash.cloudflare.com/sign-up 注册免费账号(邮箱即可, 不需要信用卡)。
已有账号跳过。

### 2. 终端执行(项目目录下)

```bash
# 登录 Cloudflare(会打开浏览器授权)
wrangler login

# 创建数据库
wrangler d1 create course-review
# -> 输出里有一行: database_id = "xxxxxxxx-xxxx-..."
#    把 id 填到 wrangler.toml 的 database_id 处
```

### 3. 修改 wrangler.toml 两个占位符

```toml
PUBLIC_BASE_URL = "https://REPLACE_WITH_YOUR_WORKER_DOMAIN"   # 部署后再填实际域名
database_id = "REPLACE_WITH_YOUR_DATABASE_ID"                # 上一步拿到的 id
```

### 4. 建表 + 导入示例数据

```bash
wrangler d1 execute course-review --file=schema.sql
wrangler d1 execute course-review --file=seed.sql   # 可选, 示例课程
```

### 5. 部署

```bash
wrangler deploy
# Worker 会自动分配 workers.dev 子域名, 同时响应已绑定的自定义域名
# 如果还没有绑定自定义域名, 先在 Cloudflare 控制台绑定再继续
```

> **:warning: 校园网访问注意事项**
>
> 北印校园网默认 DNS 为 `dns.bigc.edu.cn (202.205.107.10)`, 该 DNS **没有
> 自定义域名 `eval.survival.bigcctf.cn` 的解析记录**(实测 NXDOMAIN), 因此在
> 校园网内不开代理无法访问; 手机流量 / 校外网络可直接访问。
>
> Cloudflare 官方的 `workers.dev` 域名虽能被学校 DNS 解析, 但其对应 IP 段
> (`108.160.x.x`)被学校防火墙拦截, 校园网内同样不可达。
>
> 实测结论: **校园网内访问必须开代理(如 Clash)**, 或在非校园网环境下访问。
> 已在学生文档(生存手册「课程评价」页)中注明。

### 6. 确认配置并重新部署

确认 `wrangler.toml` 里的 `PUBLIC_BASE_URL` 已改成最终使用的域名
(当前为 `https://eval.survival.bigcctf.cn`, 不带末尾斜杠):

```bash
wrangler deploy
```

> 这个值必须是你的真实域名, 因为 CAS 回调地址(service)与 ticket 校验必须严格一致。

### 7. 测试

`LOGIN_MODE=password` 时:

1. 浏览器打开 Worker 域名 → 未登录应 302 到 `/login` 登录表单
2. 输入学号+密码 → 应 302 到课程列表, 右上角显示姓名 → 成功
3. 错误密码 → 401 显示错误提示; 同一地址 5 分钟 5 次后 → 429 限流提示
4. 退出登录(右上角)→ 再试 → 确认重新走登录
5. (可选)借一个教师工号测试 → 应看到 403 无权访问页

`LOGIN_MODE=cas` 时: 未登录应自动 302 到学校统一认证登录页, 登录后带
ticket 回调验证, 其余同上。

### 8. (必需)绑定自定义域名

由于校园网防火墙封了 `workers.dev` IP 段,自定义域名是**必须的**。
当前使用的域名: `eval.survival.bigcctf.cn`。

配置步骤:
1. Cloudflare 控制台 → 左侧 Workers & Pages → 你的 Worker → Settings → Domains & Routes
2. Add → Custom Domain → 输入域名
3. 域名 DNS 若在 Cloudflare 托管会自动配置; 否则按提示在 DNS 处加 CNAME

绑定后确认 `PUBLIC_BASE_URL` 指向该域名并重新 `wrangler deploy`。

## 在 SurviveBIGCManual 中添加入口

在文档仓库的 `docs/05-校园生活/课程评价.md` 中添加:

```markdown
[点击进入课程评价体系](https://eval.survival.bigcctf.cn)
```

> **为什么不能用 workers.dev 域名?** 北印校园网防火墙封了 `workers.dev` 对应的
> Cloudflare IP 段(`108.160.x.x`), 学生在校园网内无法通过 workers.dev 访问。
> 自定义域名在校园网内同样需要开代理访问(校园网 DNS 无该记录, 实测 NXDOMAIN)。

## 换届交接(半小时可完成)

本系统不依赖任何个人账号, 交接 = 重新部署:

1. `git clone` 本仓库代码
2. 新负责人 `wrangler login`(自己的账号)
3. `wrangler d1 create course-review` → 更新 `database_id`
4. 导出旧数据: `wrangler d1 export course-review --no-schema --output=backup.sql`
   在新库导入: `wrangler d1 execute course-review --file=backup.sql`
5. `wrangler deploy` → 域名 DNS 指向新 Worker

## 安全说明

⚠️ **注意**: `password` 模式(后端代登录)下, 密码会经由本服务的后端转发给
学校统一认证平台——这与 CAS 跳转模式(密码只在学校页面输入)不同, 属于
**借用学生密码换取身份验证**的方案, 学生使用前必须知情。缓解措施:

- 密码明文只存在于 Worker 单次请求的内存中, 不落盘、不存储、不打日志
- 限流: 同 IP 5 分钟最多 5 次登录尝试, 防批量爆破
- 密码在传输中使用学校登录页下发的 salt 做 AES 加密, 与学校前端加密算法一致
- 建议在服务说明页明确告知学生: 密码仅用于本次身份验证
- `cas` 模式(若学校注册应用)下密码完全不经本服务, 更安全, 优先选用

其他:

- 本服务只持有: ticket(一次性)、`serviceValidate` 返回的用户属性(学号/姓名/OU)
- 会话 cookie: HttpOnly + Secure + SameSite=Lax, 存 D1(30 天有效)
- 评价支持匿名提交(不显示姓名, 但数据库有记录, 仅系统维护者可见)
- 教师判定为白名单式: 无法确认身份的账号一律拒绝

/**
 * 北印课程评价系统 - 入口
 * 仅在校学生可访问: CAS 统一认证登录 -> serviceValidate 身份判定
 */
import { buildLoginUrl, validateTicket, isStudent, loginWithPassword } from "./cas.js";
import * as db from "./db.js";
import * as views from "./views.js";

const SESSION_COOKIE = "cr_session";
const LOGIN_MODES = new Set(["cas", "password", "public"]);

export default {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env, ctx);
    } catch (e) {
      console.error("路由异常", e.stack || e.message);
      return new Response(
        "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='utf-8'><title>出错了</title></head>" +
        "<body style='font-family:sans-serif;text-align:center;padding-top:80px;color:#555'>" +
        "<h1>服务暂时出错</h1><p>请稍后重试或联系维护同学。</p><p><a href='/courses'>返回首页</a></p>" +
        "</body></html>",
        { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
  },
};

async function route(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const loginMode = LOGIN_MODES.has(env.LOGIN_MODE) ? env.LOGIN_MODE : "password";

    // 读取当前会话
    const session = await db.getSession(env, getCookie(request, SESSION_COOKIE));

    // 登录入口: 按模式分发
    if (path === "/login") {
      if (loginMode === "public") return redirect("/courses", url);
      if (loginMode === "cas") {
        return Response.redirect(buildLoginUrl(env.PUBLIC_BASE_URL + "/login/callback"), 302);
      }
      // password 模式: 渲染登录表单
      return html(views.renderLogin());
    }

    // 密码登录提交(后端代登录)
    if (path === "/login/password" && request.method === "POST") {
      return handlePasswordLogin(request, env);
    }

    // CAS 回调: 带 ticket 回来(仅 cas 模式)
    if (path === "/login/callback") {
      return handleCallback(request, url, env);
    }

    // 登出
    if (path === "/logout") {
      await db.deleteSession(env, getCookie(request, SESSION_COOKIE));
      const target = loginMode === "cas"
        ? buildLoginUrl(env.PUBLIC_BASE_URL + "/login/callback")
        : "/login";
      const resp = redirect(target, url);
      resp.headers.set("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
      return resp;
    }

    // 以下路由需要登录(cas/password 模式); public 模式跳过
    if (!session && loginMode !== "public") {
      if (loginMode === "cas") {
        return Response.redirect(buildLoginUrl(env.PUBLIC_BASE_URL + "/login/callback"), 302);
      }
      return redirect("/login", url);
    }

    // 课程列表(搜索, 按课程名去重)
    if (path === "/" || path === "/courses") {
      const q = (url.searchParams.get("q") || "").trim();
      const courses = await db.listCourses(env, q);
      return html(views.renderCourseList(courses, session, q));
    }

    // 老师列表(搜索)
    if (path === "/teachers") {
      const q = (url.searchParams.get("q") || "").trim();
      const teachers = await db.listTeachers(env, q);
      return html(views.renderTeacherList(teachers, session, q));
    }

    // 老师详情(教的课程 + 全部评价)
    const teacherMatch = path.match(/^\/teachers\/(\d+)$/);
    if (teacherMatch) {
      const teacher = await db.getTeacher(env, Number(teacherMatch[1]));
      if (!teacher) return html(views.renderError("这位老师不存在"), 404);
      return html(views.renderTeacherDetail(teacher, session));
    }

    // 添加课程表单
    if (path === "/courses/new" && request.method === "GET") {
      return html(views.renderNewCourse(session));
    }

    // 创建课程(支持多位老师)
    if (path === "/courses" && request.method === "POST") {
      const form = await request.formData();
      const name = String(form.get("name") || "").trim();
      const teachers = form.getAll("teachers").map((s) => String(s).trim()).filter(Boolean);
      const description = String(form.get("description") || "").trim();
      if (!name || teachers.length === 0) {
        return html(views.renderError("课程名称和任课老师不能为空", session), 400);
      }
      const created = await db.createCourse(env, { name, teachers, description });
      if (!created) {
        const existing = await env.DB.prepare(
          "SELECT id FROM courses WHERE name = ?"
        ).bind(name).first();
        const link = existing
          ? ` <a href="/courses/${existing.id}" style="color:var(--red)">前往该课程添加老师 →</a>`
          : "";
        return html(
          views.renderError(
            `「${name}」这门课已经存在, 无需重复添加。${link}`,
            session,
            true
          ),
          400
        );
      }
      return redirect("/courses", url);
    }

    // 给已有课程添加老师
    const teacherAddMatch = path.match(/^\/courses\/(\d+)\/teachers$/);
    if (teacherAddMatch && request.method === "POST") {
      const form = await request.formData();
      const teacherName = String(form.get("teacher_name") || "").trim();
      if (!teacherName) return html(views.renderError("老师姓名不能为空", session), 400);
      const result = await db.addCourseTeacher(env, Number(teacherAddMatch[1]), teacherName);
      if (!result) return html(views.renderError("课程不存在"), 404);
      return redirect(`/courses/${teacherAddMatch[1]}?teacher=${result.teacherId}`, url);
    }

    // 课程详情 / 提交评价
    const courseMatch = path.match(/^\/courses\/(\d+)$/);
    if (courseMatch) {
      const id = Number(courseMatch[1]);
      const course = await db.getCourse(env, id);
      if (!course) return html(views.renderError("课程不存在"), 404);

      // 提交评价(针对该课程某位老师)
      if (request.method === "POST") {
        // 简单 CSRF 防护: 校验来源
        const origin = request.headers.get("Origin") || "";
        if (origin && !origin.includes(new URL(request.url).host)) {
          return html(views.renderError("请求来源不合法"), 403);
        }
        const form = await request.formData();
        const rating = Math.min(5, Math.max(1, Number(form.get("rating") || 0)));
        const content = String(form.get("content") || "").trim();
        let teacherId = Number(form.get("teacher_id") || 0);
        // teacher_id 必须是这门课的老师, 否则回退到第一位老师
        if (!course.teachers.some((t) => t.id === teacherId)) {
          teacherId = course.teachers[0]?.id || 0;
        }
        if (!content) return html(views.renderError("评价内容不能为空"), 400);
        if (!teacherId) return html(views.renderError("这门课还没有老师, 无法提交评价"), 400);
        await db.createReview(env, id, teacherId, {
          rating,
          content,
          user: session.userId,
          userName: session.userName,
          isAnonymous: form.get("anonymous") === "1",
        });
        return redirect(`/courses/${id}?teacher=${teacherId}`, url);
      }

      // 查看详情: 选中的老师(?teacher=), 默认第一位
      let teacherId = Number(url.searchParams.get("teacher") || 0);
      if (!course.teachers.some((t) => t.id === teacherId)) {
        teacherId = course.teachers[0]?.id || 0;
      }
      if (!teacherId) return html(views.renderError("这门课还没有老师"), 404);
      const teacher = await db.getCourseTeacher(env, id, teacherId);
      if (!teacher) return html(views.renderError("课程或老师不存在"), 404);
      return html(views.renderCourseDetail(course, teacher, session, teacherId));
    }

    return html(views.renderError("页面不存在"), 404);
}

/** 密码登录: 后端代登录统一认证 -> 身份判定 -> 建会话 */
async function handlePasswordLogin(request, env) {
  // 限流: 同 IP 5分钟最多5次尝试
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - 300;
  const attempts = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM login_attempts WHERE ip = ? AND created_at > ?"
  ).bind(ip, windowStart).first();
  if (attempts && attempts.c >= 5) {
    return html(views.renderLogin("尝试次数过多, 请5分钟后再试"), 429);
  }

  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  if (!username || !password) {
    return html(views.renderLogin("请输入学号和密码"), 400);
  }

  // 记录本次尝试(用于限流)
  await env.DB.prepare(
    "INSERT INTO login_attempts (ip, created_at) VALUES (?, ?)"
  ).bind(ip, now).run();

  // 后端模拟登录统一认证(密码仅在此函数内存中使用, 不落盘)
  const result = await loginWithPassword(env, username, password);

  if (!result.ok) {
    return html(views.renderLogin(result.error), 401);
  }

  // 身份判定: 非学生拒绝
  if (!isStudent(result.identity, env)) {
    return html(views.renderForbidden(), 403);
  }

  // 建会话
  const { token, expires } = await db.createSession(
    env, result.identity.user, result.identity.userName
  );
  const resp = redirect("/courses", new URL(request.url));
  resp.headers.set("Set-Cookie", cookie(SESSION_COOKIE, token, expires));
  return resp;
}

/** CAS 回调: 验证 ticket 并判定身份 */
async function handleCallback(request, url, env) {
  const ticket = url.searchParams.get("ticket");
  if (!ticket) {
    return html(views.renderError("缺少 ticket 参数"), 400);
  }

  const callbackUrl = env.PUBLIC_BASE_URL + "/login/callback";
  const identity = await validateTicket(callbackUrl, ticket, env);

  if (!identity.ok) {
    return html(views.renderError(`统一认证验证失败: ${identity.error}`), 401);
  }

  // 身份判定: 非学生一律拒绝(白名单式)
  if (!isStudent(identity, env)) {
    return html(views.renderForbidden(), 403);
  }

  // 建立会话
  const { token, expires } = await db.createSession(env, identity.user, identity.userName);
  const resp = redirect("/courses", url);
  resp.headers.set(
    "Set-Cookie",
    cookie(SESSION_COOKIE, token, expires, url.hostname)
  );
  return resp;
}

/** 重定向(手动构造 Response, 这样 headers 可变, 之后还能 Set-Cookie) */
function redirect(path, url) {
  return new Response(null, {
    status: 302,
    headers: { Location: new URL(path, url).toString() },
  });
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function cookie(name, value, expiresEpoch, hostname) {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ];
  if (expiresEpoch) {
    parts.push(`Max-Age=${expiresEpoch - Math.floor(Date.now() / 1000)}`);
  } else {
    parts.push("Max-Age=0");
  }
  // 自定义域名下限定主域, workers.dev 子域直接可用
  if (hostname && !hostname.endsWith(".workers.dev") && !hostname.endsWith(".pages.dev")) {
    parts.push(`Domain=${hostname}`);
  }
  return parts.join("; ");
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

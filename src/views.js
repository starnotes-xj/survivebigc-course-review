/**
 * 页面渲染(简单服务端模板)
 * 不引前端框架, 全部内联, 保持零依赖
 */

const CSS = `
:root { --bg:#0f1115; --card:#1a1e26; --fg:#e6e9ef; --dim:#8b93a3; --accent:#6c8cff; --ok:#3fb97f; --bad:#e5534b; }
* { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--bg); color:var(--fg); font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; line-height:1.6; }
.wrap { max-width:760px; margin:0 auto; padding:24px 16px 64px; }
header { display:flex; justify-content:space-between; align-items:center; padding:16px 0; border-bottom:1px solid #262c38; margin-bottom:24px; }
header h1 { font-size:20px; }
header .who { color:var(--dim); font-size:13px; }
a { color:var(--accent); text-decoration:none; }
.card { background:var(--card); border:1px solid #262c38; border-radius:10px; padding:16px 18px; margin-bottom:14px; }
.card h2 { font-size:17px; }
.card .meta { color:var(--dim); font-size:13px; margin-top:4px; }
.card .desc { margin-top:8px; font-size:14px; color:#c3c9d4; }
.badge { display:inline-block; padding:2px 8px; border-radius:20px; font-size:12px; background:#262c38; color:var(--dim); margin-left:8px; }
.badge.good { background:#1c3a2c; color:var(--ok); }
.stars { color:#ffc94d; }
.btn { display:inline-block; background:var(--accent); color:#fff; border:none; border-radius:8px; padding:8px 18px; font-size:14px; cursor:pointer; }
.btn.ghost { background:transparent; border:1px solid #3a4254; color:var(--fg); }
textarea, input[type=text], input[type=number], select { width:100%; background:#12151c; border:1px solid #2c3342; color:var(--fg); border-radius:8px; padding:10px 12px; font-size:14px; margin-bottom:12px; }
label { display:block; font-size:13px; color:var(--dim); margin-bottom:4px; }
.review { border-left:3px solid var(--accent); padding:10px 14px; margin-bottom:12px; background:var(--card); border-radius:0 8px 8px 0; }
.review .top { display:flex; justify-content:space-between; font-size:13px; color:var(--dim); }
.empty { color:var(--dim); text-align:center; padding:40px 0; font-size:14px; }
.err { background:#2c1a1a; border:1px solid #4a2a2a; color:#f0b0ab; padding:12px 16px; border-radius:8px; margin-bottom:16px; }
form { margin-top:16px; }
h3 { font-size:15px; margin:20px 0 10px; }
.pill { display:inline-block; font-size:12px; padding:1px 8px; border-radius:12px; background:#262c38; color:var(--dim); }
.anon { color:#7fb3ff; }
`;

function page(title, body, session) {
  const who = session
    ? `<span class="who">${escapeHtml(session.userName)} · ${escapeHtml(session.userId)} · <a href="/logout">退出</a></span>`
    : "";
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} - 北印课程评价</title>
<style>${CSS}</style></head>
<body><div class="wrap">
<header><h1>📚 北印课程评价</h1>${who}</header>
${body}
<footer style="color:var(--dim);font-size:12px;text-align:center;margin-top:40px;">
  仅限北京印刷学院在校学生 · 登录由学校统一认证提供 · 评价内容不对教职工开放
</footer>
</div></body></html>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function stars(n) {
  const full = "★".repeat(Math.round(n || 0));
  const rest = "☆".repeat(Math.max(0, 5 - Math.round(n || 0)));
  return `<span class="stars">${full}${rest}</span>`;
}

/** 403 页面(教师/非学生) */
export function renderForbidden() {
  const body = `
<div class="err"><strong>无权访问</strong><br>
你的统一认证身份不是在校学生, 无法查看课程评价内容。</div>
<p style="color:var(--dim);font-size:13px">课程评价体系仅对北京印刷学院在校学生开放。</p>`;
  return page("无权访问", body, null);
}

/** 登录页(学号密码模式) */
export function renderLogin(error) {
  const errBox = error
    ? `<div class="err">${escapeHtml(error)}</div>`
    : "";
  const body = `
<div class="card" style="max-width:420px;margin:40px auto">
  <h2 style="margin-bottom:16px">学号登录</h2>
  ${errBox}
  <form method="post" action="/login/password" id="loginForm">
    <label>学号</label>
    <input type="text" name="username" required placeholder="如: 245020219" autocomplete="username">
    <label>密码</label>
    <input type="password" name="password" required placeholder="统一认证密码" autocomplete="current-password">
    <button class="btn" type="submit" style="width:100%">登录</button>
  </form>
  <p style="color:var(--dim);font-size:12px;margin-top:14px">
    使用学校统一认证验证身份。密码仅用于本次身份验证, <strong>系统不保存密码</strong>,
    验证通过后立即丢弃。仅在校学生可访问。
  </p>
</div>`;
  return page("登录", body, null);
}

/** 课程列表 */
export function renderCourseList(courses, session) {
  const items = courses.length ? courses.map((c) => `
<div class="card">
  <h2><a href="/courses/${c.id}">${escapeHtml(c.name)}</a>
    <span class="badge">${escapeHtml(c.teacher)}</span></h2>
  <div class="meta">${stars(c.avg_rating)} ${c.avg_rating || "-"} / 5
    · ${c.review_count || 0} 条评价</div>
  ${c.description ? `<div class="desc">${escapeHtml(c.description)}</div>` : ""}
</div>`).join("") : `<div class="empty">还没有课程, 来添加第一门吧</div>`;
  const body = `
<p style="margin-bottom:16px"><a class="btn" href="/courses/new">+ 添加课程</a></p>
${items}`;
  return page("课程列表", body, session);
}

/** 课程详情 + 评价 */
export function renderCourseDetail(course, session) {
  const reviews = course.reviews.length ? course.reviews.map((r) => `
<div class="review">
  <div class="top">
    <span>${stars(r.rating)} ${r.rating}/5</span>
    <span>${r.is_anonymous ? '<span class="anon">匿名</span>' : escapeHtml(r.user_name)} · ${escapeHtml(String(r.created_at).slice(0, 10))}</span>
  </div>
  <div style="margin-top:6px;font-size:14px;white-space:pre-wrap">${escapeHtml(r.content)}</div>
</div>`).join("") : `<div class="empty">暂无评价, 来写第一条吧</div>`;
  const body = `
<div class="card">
  <h2>${escapeHtml(course.name)} <span class="badge">${escapeHtml(course.teacher)}</span></h2>
  ${course.description ? `<div class="desc">${escapeHtml(course.description)}</div>` : ""}
  <div class="meta" style="margin-top:8px">${course.reviews.length} 条评价</div>
</div>
<h3>提交评价</h3>
<form method="post" action="/courses/${course.id}/reviews">
  <label>评分 (1-5)</label>
  <input type="number" name="rating" min="1" max="5" required>
  <label>评价内容</label>
  <textarea name="content" rows="4" required placeholder="课程体验、老师授课风格、作业考试情况、避坑建议……"></textarea>
  <label><input type="checkbox" name="anonymous" value="1" checked style="width:auto"> 匿名提交(不显示你的姓名)</label>
  <button class="btn" type="submit">提交评价</button>
</form>
<h3>全部评价 (${course.reviews.length})</h3>
${reviews}
<p style="margin-top:24px"><a href="/courses">← 返回课程列表</a></p>`;
  return page(`课程详情 - ${course.name}`, body, session);
}

/** 添加课程表单 */
export function renderNewCourse(session) {
  const body = `
<h3 style="margin-top:0">添加课程</h3>
<form method="post" action="/courses">
  <label>课程名称 *</label>
  <input type="text" name="name" required placeholder="如: 计算机网络">
  <label>任课教师 *</label>
  <input type="text" name="teacher" required placeholder="如: 张老师">
  <label>课程简介 (可选)</label>
  <textarea name="description" rows="3" placeholder="课程内容、考核方式等"></textarea>
  <button class="btn" type="submit">创建课程</button>
</form>
<p style="margin-top:24px"><a href="/courses">← 返回课程列表</a></p>`;
  return page("添加课程", body, session);
}

/** 通用错误页 */
export function renderError(msg, session) {
  return page("出错了", `<div class="err">${escapeHtml(msg)}</div><p><a href="/courses">← 返回课程列表</a></p>`, session);
}

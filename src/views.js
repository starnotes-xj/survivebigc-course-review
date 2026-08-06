/**
 * 页面渲染(服务端模板)
 * 设计语言: 「铅字印刷」—— 纸张米白 + 油墨黑 + 印刷红
 * 呼应北京印刷学院的印刷出版特色; 全站零外部依赖(无 CDN 字体/库)
 */

const CSS = `
:root {
  --paper: #f6f1e5;        /* 纸张米白 */
  --paper-deep: #efe8d6;   /* 深一档纸色(输入框底色) */
  --paper-card: #fbf8f0;   /* 卡片纸白 */
  --ink: #26221a;          /* 油墨黑 */
  --ink-dim: #7d7463;      /* 淡墨 */
  --red: #b03a2e;          /* 印刷红 */
  --red-deep: #8c2b21;
  --red-soft: #f3e2dd;
  --line: #d9cfb6;         /* 细线 */
  --line-deep: #c3b694;
  --serif: Georgia, "Noto Serif SC", "Songti SC", "STSong", "SimSun", serif;
  --sans: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; }
body {
  background-color: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 15px;
  line-height: 1.7;
  min-height: 100vh;
}
/* 纸张噪点纹理 */
body::before {
  content: "";
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='linear' slope='0.05'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: .55;
}
.wrap { position: relative; z-index: 1; max-width: 820px; margin: 0 auto; padding: 28px 18px 72px; }

/* ---------- 顶栏 ---------- */
.top {
  display: flex; justify-content: space-between; align-items: flex-end;
  padding: 8px 0 14px; margin-bottom: 26px;
  border-bottom: 3px double var(--ink);
}
.brand h1 {
  font-family: var(--serif); font-size: 30px; font-weight: 800;
  letter-spacing: 3px; line-height: 1.2;
}
.brand h1 a { color: var(--ink); text-decoration: none; }
.brand .sub { font-size: 12px; color: var(--ink-dim); letter-spacing: 2px; margin-top: 4px; }
.brand .sub b { color: var(--red); font-weight: 600; }
.who { font-size: 13px; color: var(--ink-dim); text-align: right; white-space: nowrap; }
.who .me { font-family: var(--serif); color: var(--ink); font-size: 14px; }
.who a { color: var(--red); text-decoration: none; margin-left: 10px; border: 1px solid var(--red); padding: 1px 10px; border-radius: 3px; font-size: 12px; }
.who a:hover { background: var(--red); color: #fff; }

/* ---------- 通用卡片 ---------- */
.card {
  display: block; position: relative;
  background: var(--paper-card);
  border: 1px solid var(--line-deep);
  padding: 16px 18px 14px 22px; margin-bottom: 14px;
  color: var(--ink); text-decoration: none;
  box-shadow: 2px 2px 0 rgba(38,34,26,.06);
  animation: rise .45s ease both;
  animation-delay: calc(var(--i, 0) * 45ms);
  transition: transform .15s ease, box-shadow .15s ease;
}
.card::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
  background: var(--red);
}
.card:hover { transform: translateY(-2px); box-shadow: 4px 6px 0 rgba(38,34,26,.10); }
@keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

.card .ctop { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.card h2 { font-family: var(--serif); font-size: 20px; font-weight: 800; letter-spacing: 1px; }
.card .tag {
  flex-shrink: 0; font-size: 11.5px; color: var(--red); border: 1px solid var(--red);
  padding: 0 8px; border-radius: 2px; letter-spacing: 1px; white-space: nowrap;
  background: var(--red-soft);
}
.card .meta { font-size: 13px; color: var(--ink-dim); margin-top: 5px; }
.card .desc { font-size: 13.5px; color: var(--ink); margin-top: 7px; }
.card .desc.gone { color: var(--ink-dim); font-style: italic; }

/* ---------- 搜索区 ---------- */
.searchbar {
  display: flex; gap: 10px; margin-bottom: 22px;
  border: 1.5px solid var(--ink); background: var(--paper-card);
  padding: 8px 10px; align-items: center;
}
.searchbar .glyph { font-size: 17px; color: var(--ink-dim); padding: 0 4px; }
.searchbar input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  font-family: var(--serif); font-size: 16px; color: var(--ink); padding: 4px 0;
}
.searchbar input::placeholder { color: var(--line-deep); }
.searchbar button {
  border: 1px solid var(--ink); background: var(--paper); color: var(--ink);
  font-family: var(--serif); font-size: 14px; letter-spacing: 3px;
  padding: 4px 18px; cursor: pointer; transition: all .15s;
}
.searchbar button:hover { background: var(--ink); color: var(--paper); }
.subnav { margin: -12px 0 20px; font-size: 13px; text-align: right; }
.subnav a { color: var(--red); text-decoration: none; border-bottom: 1px dashed var(--red); }
.subnav a:hover { border-bottom-style: solid; }

/* ---------- 老师 tab ---------- */
.teachers { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 4px; }
.t-tab {
  font-family: var(--serif); font-size: 15px; text-decoration: none;
  padding: 5px 16px; border: 1.5px solid var(--ink); color: var(--ink);
  background: var(--paper-card); letter-spacing: 1px;
  transition: all .15s;
}
.t-tab em { font-style: normal; font-size: 12px; color: var(--ink-dim); margin-left: 6px; }
.t-tab:hover { border-color: var(--red); color: var(--red); }
.t-tab.active { background: var(--red); border-color: var(--red); color: #fff; }
.t-tab.active em { color: rgba(255,255,255,.85); }

/* ---------- 评价 ---------- */
.review {
  border-left: 3px solid var(--line-deep);
  background: var(--paper-card);
  padding: 12px 16px; margin-bottom: 12px;
  box-shadow: 1px 1px 0 rgba(38,34,26,.05);
  animation: rise .4s ease both;
  animation-delay: calc(var(--i, 0) * 40ms);
}
.review .rtop { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; color: var(--ink-dim); }
.review .rbody { margin-top: 7px; font-size: 14px; white-space: pre-wrap; word-break: break-word; }
.review .course-tag {
  font-size: 11.5px; color: var(--red); border: 1px dashed var(--red);
  padding: 0 7px; border-radius: 2px; margin-right: 8px;
}
.stars { color: var(--red); font-size: 14px; letter-spacing: 1px; }
.stars .off { color: var(--line-deep); }

/* ---------- 表单 ---------- */
h3.sec { font-family: var(--serif); font-size: 18px; margin: 26px 0 12px; letter-spacing: 2px; }
h3.sec::before { content: "■ "; color: var(--red); font-size: 13px; }
form.paper { margin-top: 16px; }
label.f { display: block; font-family: var(--serif); font-size: 13.5px; color: var(--ink-dim); letter-spacing: 2px; margin: 14px 0 4px; }
/* 登记表风格输入框: 纸色底 + 底线墨色, focus 变红 —— 杜绝浏览器 autofill 白色 */
input[type=text], input[type=password], input[type=search], input[type=number], textarea, select {
  width: 100%; background: var(--paper-deep); border: 1px solid var(--line-deep);
  border-bottom: 2px solid var(--ink); border-radius: 2px 2px 0 0;
  color: var(--ink); font-family: var(--sans); font-size: 15px;
  padding: 9px 12px; margin-bottom: 2px; outline: none;
  transition: border-color .15s, box-shadow .15s;
}
input:focus, textarea:focus, select:focus {
  border-color: var(--red); border-bottom-color: var(--red);
  box-shadow: 0 2px 0 rgba(176,58,46,.25);
}
textarea { min-height: 96px; resize: vertical; line-height: 1.6; }
/* 浏览器自动填充白底修复 */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--ink);
  -webkit-box-shadow: 0 0 0 1000px var(--paper-deep) inset;
  box-shadow: 0 0 0 1000px var(--paper-deep) inset;
  border-bottom: 2px solid var(--ink);
  caret-color: var(--ink);
  transition: background-color 999999s ease-in-out 0s;
}
.btn {
  display: inline-block; border: 1.5px solid var(--red); background: var(--red);
  color: #fff; font-family: var(--serif); font-size: 16px; letter-spacing: 6px;
  padding: 9px 34px; cursor: pointer; border-radius: 2px;
  transition: background .15s, transform .1s;
}
.btn:hover { background: var(--red-deep); transform: translateY(-1px); }
.btn.ghost { background: transparent; color: var(--red); }
.btn.ghost:hover { background: var(--red-soft); }
.btn.ink { background: var(--ink); border-color: var(--ink); }
.btn.ink:hover { background: #17130e; }

.checkrow { margin: 12px 0; font-size: 13.5px; color: var(--ink-dim); }
.checkrow input { width: auto; margin-right: 6px; }
.anon-badge {
  display: inline-block; font-size: 11.5px; color: var(--ink-dim);
  border: 1px dashed var(--line-deep); padding: 0 8px; border-radius: 2px; letter-spacing: 1px;
}

/* ---------- 登录页 ---------- */
.login-stage { min-height: 70vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 0; }
.login-card {
  position: relative; width: 100%; max-width: 430px;
  background: var(--paper-card);
  border: 1.5px solid var(--ink);
  padding: 40px 44px 34px;
  box-shadow: 6px 8px 0 rgba(38,34,26,.12);
  animation: rise .5s ease both;
}
.login-card::before {  /* 顶部印刷红杠 */
  content: ""; position: absolute; top: 0; left: 0; right: 0; height: 6px;
  background: var(--red);
}
/* 红色印章: 竖排「仅限在校学生」 */
.seal {
  position: absolute; top: -16px; right: 22px;
  font-family: var(--serif); font-size: 13px; letter-spacing: 4px;
  color: var(--red); border: 2px solid var(--red); border-radius: 4px;
  padding: 6px 8px; line-height: 1.35; text-align: center;
  background: rgba(243,226,221,.85);
  transform: rotate(2deg);
  box-shadow: inset 0 0 0 2px var(--red-soft);
  writing-mode: vertical-rl;
}
.login-card h2 { font-family: var(--serif); font-size: 26px; letter-spacing: 6px; font-weight: 800; margin-bottom: 4px; }
.login-sub { font-size: 13px; color: var(--ink-dim); letter-spacing: 1px; margin-bottom: 8px; }
.login-note {
  margin-top: 20px; padding-top: 14px; border-top: 1px dashed var(--line-deep);
  font-size: 12.5px; color: var(--ink-dim); line-height: 1.8;
}
.login-note b { color: var(--red); font-weight: 600; }
.login-foot { margin-top: 26px; font-size: 12px; color: var(--ink-dim); text-align: center; letter-spacing: 1px; }

/* ---------- 错误/提示 ---------- */
.err {
  background: var(--red-soft); border: 1px solid var(--red); border-left: 4px solid var(--red);
  color: var(--red-deep); padding: 12px 16px; margin-bottom: 18px;
  font-size: 14px; letter-spacing: 1px;
}
.err strong { font-family: var(--serif); }
.empty { text-align: center; padding: 56px 0; color: var(--ink-dim); font-family: var(--serif); letter-spacing: 2px; }
.empty .big { font-size: 34px; color: var(--line-deep); display: block; margin-bottom: 10px; }

/* 403 印章页 */
.forbid { text-align: center; padding: 70px 0; }
.forbid .big-seal {
  display: inline-block; font-family: var(--serif); font-size: 22px; letter-spacing: 8px;
  color: var(--red); border: 3px solid var(--red); border-radius: 8px;
  padding: 18px 30px; transform: rotate(-2deg);
  box-shadow: inset 0 0 0 3px var(--red-soft);
  margin-bottom: 26px;
}
.forbid p { color: var(--ink-dim); font-size: 14px; }

/* 老师行(新建课程页动态添加) */
.trow { display: flex; gap: 8px; margin-bottom: 8px; }
.trow input { margin-bottom: 0; }
.trow .del {
  border: 1px solid var(--line-deep); background: var(--paper); color: var(--ink-dim);
  width: 42px; flex-shrink: 0; cursor: pointer; font-size: 16px;
}
.trow .del:hover { border-color: var(--red); color: var(--red); }
.addt { margin-top: 4px; }

footer.pagefoot {
  margin-top: 52px; padding-top: 16px; border-top: 1px solid var(--line);
  font-size: 12px; color: var(--ink-dim); text-align: center; letter-spacing: 1px;
}
footer.pagefoot b { color: var(--red); font-weight: 600; }
`;

function page(title, body, session) {
  const who = session
    ? `<div class="who"><span class="me">${escapeHtml(session.userName)}</span> · ${escapeHtml(session.userId)}<br><a href="/logout">退出</a></div>`
    : "";
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} - 北印课程评价</title>
<style>${CSS}</style></head>
<body><div class="wrap">
<header class="top">
  <div class="brand">
    <h1><a href="/courses">北印课程评价</a></h1>
    <div class="sub">北京印刷学院 · <b>学生评教录</b></div>
  </div>
  ${who}
</header>
${body}
<footer class="pagefoot">
  北京印刷学院 · 课程评价体系 · 仅限在校学生 · 评价内容不对教职工开放<br>
  登录由学校统一认证验证身份, 密码仅用于本次验证, 不保存
</footer>
</div></body></html>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/** 星星(印刷红实心 + 淡墨空心) */
function stars(n, size = "") {
  const v = Math.round(Number(n) || 0);
  let s = "";
  for (let i = 1; i <= 5; i++) {
    s += i <= v ? "★" : `<span class="off">★</span>`;
  }
  return `<span class="stars"${size ? ` style="font-size:${size}"` : ""}>${s}</span>`;
}

function fmtDate(d) {
  return String(d || "").slice(0, 10);
}

/** 搜索栏(课程/老师共用, action 区分) */
function searchbar(action, q, placeholder, glyph = "🔍") {
  return `<form class="searchbar" method="get" action="${action}">
  <span class="glyph">${glyph}</span>
  <input type="search" name="q" placeholder="${placeholder}" value="${escapeHtml(q)}">
  <button type="submit">检 索</button>
</form>`;
}

/** 403 页 */
export function renderForbidden() {
  const body = `
<div class="forbid">
  <div class="big-seal">无 权 访 问</div>
  <p>你的统一认证身份不是在校学生, 无法查看课程评价内容。</p>
  <p style="margin-top:8px;font-size:13px">本体系仅对北京印刷学院在校学生开放。</p>
</div>`;
  return page("无权访问", body, null);
}

/** 登录页: 登记表样式, 印章点缀 */
export function renderLogin(error) {
  const errBox = error
    ? `<div class="err"><strong>✕ 未能登录</strong> — ${escapeHtml(error)}</div>`
    : "";
  const body = `
<div class="login-stage">
  <div class="login-card">
    <div class="seal">仅限在校学生</div>
    <h2>学号登录</h2>
    <p class="login-sub">使用学校统一认证验证身份</p>
    ${errBox}
    <form method="post" action="/login/password" id="loginForm">
      <label class="f">学号</label>
      <input type="text" name="username" required placeholder="如: 245020219"
             autocomplete="username" autofocus>
      <label class="f">密码</label>
      <input type="password" name="password" required placeholder="统一认证密码"
             autocomplete="current-password">
      <div style="height:16px"></div>
      <button class="btn" type="submit" style="width:100%">登　录</button>
    </form>
    <p class="login-note">
      密码仅用于本次身份验证, <b>系统不保存密码</b>, 验证通过后立即丢弃。<br>
      同一浏览器登录后 30 天内免登录。
    </p>
  </div>
  <div class="login-foot">评价内容不对教职工开放 · 匿名提交, 姓名仅后台留档</div>
</div>`;
  return page("登录", body, null);
}

/** 课程列表(去重): 搜索 + 课程卡片 */
export function renderCourseList(courses, session, q = "") {
  const items = courses.length ? courses.map((c, i) => `
<a class="card" href="/courses/${c.id}" style="--i:${i}">
  <div class="ctop">
    <h2>${escapeHtml(c.name)}</h2>
    <span class="tag">${c.teacher_count || 0} 位老师</span>
  </div>
  <div class="meta">${stars(c.avg_rating)} ${c.avg_rating || "-"} / 5 · ${c.review_count || 0} 条评价</div>
  ${c.description ? `<div class="desc">${escapeHtml(c.description)}</div>` : ""}
</a>`).join("") : `
<div class="empty" style="--i:0"><span class="big">空</span>没有找到相关课程, 来添加第一门吧</div>`;
  const body = `
${searchbar("/courses", q, "搜索课程名称, 如: 程序设计基础")}
<div class="subnav"><a href="/teachers">按老师查看评价 →</a></div>
${items}
<p style="margin:22px 0 8px"><a class="btn ink" href="/courses/new">＋ 添加课程</a></p>`;
  return page(q ? `“${q}”的搜索结果` : "课程列表", body, session);
}

/** 课程详情: 老师切换 tab + 该老师评价 + 提交表单 */
export function renderCourseDetail(course, teacher, session, activeTeacherId = 0) {
  const tabs = course.teachers.map((t) => {
    const on = t.id === teacher.teacher_id;
    const score = t.avg_rating ? `${t.avg_rating}` : "—";
    const cnt = t.review_count ? `${t.review_count} 评` : "0 评";
    return `<a class="t-tab${on ? " active" : ""}" href="/courses/${course.id}?teacher=${t.id}">${escapeHtml(t.name)}<em>${score} · ${cnt}</em></a>`;
  }).join("");

  const reviews = teacher.reviews.length ? teacher.reviews.map((r, i) => `
<div class="review" style="--i:${i}">
  <div class="rtop">
    <span>${stars(r.rating)} ${r.rating}/5</span>
    <span><span class="anon-badge">匿名</span> · ${fmtDate(r.created_at)}</span>
  </div>
  <div class="rbody">${escapeHtml(r.content)}</div>
</div>`).join("") : `
<div class="empty" style="--i:0"><span class="big">…</span>${escapeHtml(teacher.teacher_name)}老师这门课还没有评价, 来写第一条吧</div>`;

  const teacherOpts = course.teachers.map((t) =>
    `<option value="${t.id}" ${t.id === teacher.teacher_id ? "selected" : ""}>${escapeHtml(t.name)}</option>`
  ).join("");

  const body = `
<div class="card" style="--i:0">
  <div class="ctop">
    <h2>${escapeHtml(course.name)}</h2>
    <span class="tag">${course.teachers.length} 位老师</span>
  </div>
  ${course.description ? `<div class="desc">${escapeHtml(course.description)}</div>` : ""}
  <div class="teachers">${tabs}</div>
</div>

<h3 class="sec">添加老师</h3>
<form class="paper" method="post" action="/courses/${course.id}/teachers" style="display:flex;gap:10px;align-items:flex-end">
  <div style="flex:1">
    <label class="f">老师姓名(本课还有别的老师? 填上即可)</label>
    <input type="text" name="teacher_name" required placeholder="如: 钱老师">
  </div>
  <button class="btn ink" type="submit" style="margin-bottom:2px">添 加</button>
</form>

<h3 class="sec">${escapeHtml(teacher.teacher_name)} · 授课评价</h3>
<p class="meta" style="font-size:13px;color:var(--ink-dim);margin-bottom:14px">
  综合评分 ${stars(teacher.avg_rating)} ${teacher.avg_rating || "-"} / 5 · ${teacher.reviews.length} 条评价
</p>
${reviews}

<h3 class="sec">提交评价</h3>
<form class="paper" method="post" action="/courses/${course.id}/reviews">
  <label class="f">老师</label>
  <select name="teacher_id">${teacherOpts}</select>
  <label class="f">评分 (1-5)</label>
  <input type="number" name="rating" min="1" max="5" step="1" required placeholder="4">
  <label class="f">评价内容</label>
  <textarea name="content" rows="4" required placeholder="课程体验、老师授课风格、作业考试情况、避坑建议……"></textarea>
  <label class="checkrow"><input type="checkbox" name="anonymous" value="1" checked> 匿名提交(列表只显示「匿名」, 后台留档)</label>
  <button class="btn" type="submit">提 交</button>
  <a class="btn ghost" href="/courses" style="margin-left:10px">返 回</a>
</form>`;
  return page(`课程详情 - ${course.name}`, body, session);
}

/** 新建课程: 课程名 + 多老师动态行 + 简介 */
export function renderNewCourse(session) {
  const body = `
<div class="card" style="--i:0">
  <h2 style="font-family:var(--serif);font-size:22px;margin-bottom:4px">添加课程</h2>
  <p style="font-size:13px;color:var(--ink-dim)">同一门课只需添加一次; 不同班的老师可以在下方逐一添加。</p>
</div>
<form class="paper" method="post" action="/courses" id="courseForm">
  <label class="f">课程名称 *</label>
  <input type="text" name="name" required placeholder="如: 程序设计基础">
  <label class="f">任课老师 * (至少一位, 可多个)</label>
  <div id="trows">
    <div class="trow">
      <input type="text" name="teachers" required placeholder="如: 张老师">
      <button type="button" class="del" onclick="this.parentElement.remove()" title="移除">✕</button>
    </div>
  </div>
  <button type="button" class="btn ghost addt" id="addTeacher" style="font-size:13px;letter-spacing:2px">＋ 再添加一位老师</button>
  <label class="f">课程简介 (可选)</label>
  <textarea name="description" rows="3" placeholder="课程内容、考核方式等"></textarea>
  <div style="height:10px"></div>
  <button class="btn" type="submit">创建课程</button>
  <a class="btn ghost" href="/courses" style="margin-left:10px">返 回</a>
</form>
<script>
document.getElementById('addTeacher').addEventListener('click', function () {
  var d = document.createElement('div');
  d.className = 'trow';
  d.innerHTML = '<input type="text" name="teachers" placeholder="如: 李老师"><button type="button" class="del" onclick="this.parentElement.remove()" title="移除">✕</button>';
  document.getElementById('trows').appendChild(d);
  d.querySelector('input').focus();
});
</script>`;
  return page("添加课程", body, session);
}

/** 老师列表(支持搜索): 卡片 */
export function renderTeacherList(teachers, session, q = "") {
  const items = teachers.length ? teachers.map((t, i) => `
<a class="card" href="/teachers/${t.id}" style="--i:${i}">
  <div class="ctop">
    <h2>${escapeHtml(t.name)}</h2>
    <span class="tag">${t.course_count || 0} 门课</span>
  </div>
  <div class="meta">${stars(t.avg_rating)} ${t.avg_rating || "-"} / 5 · ${t.review_count || 0} 条评价</div>
</a>`).join("") : `
<div class="empty" style="--i:0"><span class="big">空</span>没有找到这位老师</div>`;
  const body = `
${searchbar("/teachers", q, "搜索老师姓名, 如: 张老师")}
<div class="subnav"><a href="/courses">← 按课程查看</a></div>
${items}`;
  return page(q ? `“${q}”的老师` : "老师名录", body, session);
}

/** 老师详情: 教的课程 + 全部评价 */
export function renderTeacherDetail(teacher, session) {
  const courseRows = teacher.courses.length ? teacher.courses.map((c, i) => `
<a class="card" href="/courses/${c.id}?teacher=${teacher.id}" style="--i:${i};padding:12px 18px 10px 22px">
  <div class="ctop">
    <h2 style="font-size:17px">${escapeHtml(c.name)}</h2>
    <span class="meta">${stars(c.avg_rating)} ${c.avg_rating || "-"} / 5 · ${c.review_count || 0} 条</span>
  </div>
</a>`).join("") : `<div class="empty" style="--i:0"><span class="big">…</span>暂无课程记录</div>`;

  const reviews = teacher.reviews.length ? teacher.reviews.map((r, i) => `
<div class="review" style="--i:${i}">
  <div class="rtop">
    <span><span class="course-tag">${escapeHtml(r.course_name)}</span>${stars(r.rating)} ${r.rating}/5</span>
    <span><span class="anon-badge">匿名</span> · ${fmtDate(r.created_at)}</span>
  </div>
  <div class="rbody">${escapeHtml(r.content)}</div>
</div>`).join("") : `
<div class="empty" style="--i:0"><span class="big">…</span>还没有关于这位老师的评价</div>`;

  const body = `
<div class="card" style="--i:0">
  <div class="ctop">
    <h2>${escapeHtml(teacher.name)}</h2>
    <span class="tag">${teacher.courses.length} 门课</span>
  </div>
  <div class="meta" style="margin-top:8px">
    综合评分 ${stars(teacher.avg_rating)} ${teacher.avg_rating || "-"} / 5 · ${teacher.reviews.length} 条评价
  </div>
</div>

<h3 class="sec">任课情况</h3>
${courseRows}

<h3 class="sec">同学评价 (${teacher.reviews.length})</h3>
${reviews}
<p style="margin-top:22px"><a class="btn ghost" href="/teachers">← 返回老师名录</a></p>`;
  return page(`老师 - ${teacher.name}`, body, session);
}

/** 通用错误页; 若 msg 已含安全 HTML(如链接)可传 htmlMsg=true */
export function renderError(msg, session, htmlMsg = false) {
  return page(
    "出错了",
    `<div class="err"><strong>✕ 出错了</strong> — ${htmlMsg ? msg : escapeHtml(msg)}</div><p><a class="btn ghost" href="/courses">← 返回课程列表</a></p>`,
    session
  );
}

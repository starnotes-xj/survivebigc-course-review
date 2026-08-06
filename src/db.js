/**
 * D1 数据访问层
 * 表: sessions / courses(名称唯一) / teachers / course_teachers / reviews / login_attempts
 */

/** 创建登录会话, 返回 token */
export async function createSession(env, user, userName) {
  const token = crypto.randomUUID().replaceAll("-", "") +
    crypto.randomUUID().replaceAll("-", "");
  const ttl = parseInt(env.SESSION_TTL || "2592000", 10);
  const expires = Math.floor(Date.now() / 1000) + ttl;
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, user_name, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(token, user, userName, expires)
    .run();
  return { token, expires };
}

/** 校验会话, 返回会话信息或 null */
export async function getSession(env, token) {
  if (!token) return null;
  const res = await env.DB.prepare(
    "SELECT user_id, user_name, expires_at FROM sessions WHERE token = ?"
  )
    .bind(token)
    .first();
  if (!res) return null;
  if (res.expires_at < Math.floor(Date.now() / 1000)) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return null;
  }
  return { userId: res.user_id, userName: res.user_name };
}

/** 删除会话(登出) */
export async function deleteSession(env, token) {
  if (!token) return;
  await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

/**
 * 课程列表: 按课程名去重(同一门课多位老师只显示一条)
 * q: 课程名关键字(空串=全部), 返回含 teacher_count/avg_rating/review_count
 */
export async function listCourses(env, q = "") {
  return env.DB.prepare(
    `SELECT c.id, c.name, c.description,
            COUNT(DISTINCT ct.teacher_id) AS teacher_count,
            COUNT(r.id) AS review_count,
            ROUND(AVG(r.rating), 1) AS avg_rating
     FROM courses c
     LEFT JOIN course_teachers ct ON ct.course_id = c.id
     LEFT JOIN reviews r ON r.course_id = c.id
     WHERE (? = '' OR c.name LIKE '%' || ? || '%')
     GROUP BY c.id
     ORDER BY c.id DESC`
  )
    .bind(q, q)
    .all()
    .then((r) => r.results || []);
}

/** 课程详情: 基本信息 + 老师列表(每位老师带各自评分统计) */
export async function getCourse(env, id) {
  const course = await env.DB.prepare(
    "SELECT id, name, description, created_at FROM courses WHERE id = ?"
  ).bind(id).first();
  if (!course) return null;
  const teachers = await env.DB.prepare(
    `SELECT t.id, t.name,
            COUNT(r.id) AS review_count,
            ROUND(AVG(r.rating), 1) AS avg_rating
     FROM course_teachers ct
     JOIN teachers t ON t.id = ct.teacher_id
     LEFT JOIN reviews r ON r.course_id = ct.course_id AND r.teacher_id = t.id
     WHERE ct.course_id = ?
     GROUP BY t.id
     ORDER BY t.id`
  ).bind(id).all().then((r) => r.results || []);
  return { ...course, teachers };
}

/** 课程 + 某位老师的评价列表(课程详情页按老师切换时用) */
export async function getCourseTeacher(env, courseId, teacherId) {
  const row = await env.DB.prepare(
    `SELECT c.id AS course_id, c.name AS course_name, c.description,
            t.id AS teacher_id, t.name AS teacher_name,
            COUNT(r.id) AS review_count,
            ROUND(AVG(r.rating), 1) AS avg_rating
     FROM course_teachers ct
     JOIN courses c ON c.id = ct.course_id
     JOIN teachers t ON t.id = ct.teacher_id
     LEFT JOIN reviews r ON r.course_id = ct.course_id AND r.teacher_id = t.id
     WHERE c.id = ? AND t.id = ?
     GROUP BY c.id`
  ).bind(courseId, teacherId).first();
  if (!row) return null;
  const reviews = await env.DB.prepare(
    `SELECT rating, content, is_anonymous, created_at
     FROM reviews
     WHERE course_id = ? AND teacher_id = ?
     ORDER BY id DESC`
  ).bind(courseId, teacherId).all().then((r) => r.results || []);
  return { ...row, reviews };
}

/**
 * 老师列表(支持按老师名搜索): 每位老师带教的课程数/评价数/总平均分
 */
export async function listTeachers(env, q = "") {
  return env.DB.prepare(
    `SELECT t.id, t.name,
            COUNT(DISTINCT ct.course_id) AS course_count,
            COUNT(r.id) AS review_count,
            ROUND(AVG(r.rating), 1) AS avg_rating
     FROM teachers t
     LEFT JOIN course_teachers ct ON ct.teacher_id = t.id
     LEFT JOIN reviews r ON r.course_id = ct.course_id AND r.teacher_id = t.id
     WHERE (? = '' OR t.name LIKE '%' || ? || '%')
     GROUP BY t.id
     ORDER BY t.id`
  )
    .bind(q, q)
    .all()
    .then((r) => r.results || []);
}

/** 老师详情: 教的课程(各带评分) + 全部评价(带课程名) */
export async function getTeacher(env, id) {
  const teacher = await env.DB.prepare(
    "SELECT id, name, created_at FROM teachers WHERE id = ?"
  ).bind(id).first();
  if (!teacher) return null;
  const courses = await env.DB.prepare(
    `SELECT c.id, c.name, c.description,
            COUNT(r.id) AS review_count,
            ROUND(AVG(r.rating), 1) AS avg_rating
     FROM course_teachers ct
     JOIN courses c ON c.id = ct.course_id
     LEFT JOIN reviews r ON r.course_id = c.id AND r.teacher_id = ct.teacher_id
     WHERE ct.teacher_id = ?
     GROUP BY c.id
     ORDER BY c.id`
  ).bind(id).all().then((r) => r.results || []);
  const reviews = await env.DB.prepare(
    `SELECT r.id, r.course_id, r.rating, r.content, r.is_anonymous, r.created_at,
            c.name AS course_name
     FROM reviews r
     JOIN courses c ON c.id = r.course_id
     WHERE r.teacher_id = ?
     ORDER BY r.id DESC`
  ).bind(id).all().then((r) => r.results || []);
  return { ...teacher, courses, reviews };
}

/**
 * 创建课程(含多位老师): 课程名唯一, 重复返回 null
 * 流程: upsert 老师 -> 插入课程 -> 批量插入关联
 */
export async function createCourse(env, { name, teachers = [], description = "" }) {
  const names = [...new Set(teachers.map((s) => s.trim()).filter(Boolean))];
  if (!name || names.length === 0) return null;

  const exists = await env.DB.prepare(
    "SELECT id FROM courses WHERE name = ?"
  ).bind(name.trim()).first();
  if (exists) return null;

  // 1. 课程
  const res = await env.DB.prepare(
    "INSERT INTO courses (name, description) VALUES (?, ?)"
  ).bind(name.trim(), description.trim()).run();
  const courseId = res.meta.last_row_id;

  // 2. upsert 老师并建关联
  const stmts = [];
  for (const tname of names) {
    await env.DB.prepare("INSERT OR IGNORE INTO teachers (name) VALUES (?)").bind(tname).run();
    const t = await env.DB.prepare("SELECT id FROM teachers WHERE name = ?").bind(tname).first();
    stmts.push(env.DB.prepare(
      "INSERT INTO course_teachers (course_id, teacher_id) VALUES (?, ?)"
    ).bind(courseId, t.id));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return { id: courseId };
}

/** 提交评价(针对某课程某老师) */
export async function createReview(env, courseId, teacherId, { rating, content, user, userName, isAnonymous }) {
  return env.DB.prepare(
    `INSERT INTO reviews (course_id, teacher_id, user_id, user_name, rating, content, is_anonymous)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(courseId, teacherId, user, userName, rating, content, isAnonymous ? 1 : 0)
    .run();
}

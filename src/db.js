/**
 * D1 数据访问层
 * 表: sessions(会话) / courses(课程) / reviews(评价)
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

/** 课程列表(含评价数、平均分) */
export async function listCourses(env) {
  return env.DB.prepare(
    `SELECT c.id, c.name, c.teacher, c.description,
            COUNT(r.id) AS review_count,
            ROUND(AVG(r.rating), 1) AS avg_rating
     FROM courses c
     LEFT JOIN reviews r ON r.course_id = c.id
     GROUP BY c.id
     ORDER BY c.id DESC`
  ).all().then((r) => r.results || []);
}

/** 课程详情 + 评价列表 */
export async function getCourse(env, id) {
  const course = await env.DB.prepare(
    "SELECT * FROM courses WHERE id = ?"
  ).bind(id).first();
  if (!course) return null;
  const reviews = await env.DB.prepare(
    `SELECT id, course_id, rating, content, user_name, is_anonymous,
            created_at FROM reviews WHERE course_id = ? ORDER BY id DESC`
  ).bind(id).all().then((r) => r.results || []);
  return { ...course, reviews };
}

/** 创建课程 */
export async function createCourse(env, { name, teacher, description }) {
  return env.DB.prepare(
    "INSERT INTO courses (name, teacher, description) VALUES (?, ?, ?)"
  )
    .bind(name, teacher, description)
    .run();
}

/** 提交评价 */
export async function createReview(env, courseId, { rating, content, user, userName, isAnonymous }) {
  return env.DB.prepare(
    `INSERT INTO reviews (course_id, user_id, user_name, rating, content, is_anonymous)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(courseId, user, userName, rating, content, isAnonymous ? 1 : 0)
    .run();
}

-- 北印课程评价系统 数据表
-- 执行: wrangler d1 execute course-review --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  user_name  TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- 课程: 名称唯一(同一门课只保留一条, 不同班/不同老师挂在多位老师下)
CREATE TABLE IF NOT EXISTS courses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
);

-- 老师: 独立实体(可跨课程)
CREATE TABLE IF NOT EXISTS teachers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
);

-- 课程-老师 关联(一门课多位老师, 一位老师可教多门课)
CREATE TABLE IF NOT EXISTS course_teachers (
  course_id  INTEGER NOT NULL REFERENCES courses(id),
  teacher_id INTEGER NOT NULL REFERENCES teachers(id),
  PRIMARY KEY (course_id, teacher_id)
);

-- 评价: 针对 某门课 + 某位老师
CREATE TABLE IF NOT EXISTS reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id    INTEGER NOT NULL REFERENCES courses(id),
  teacher_id   INTEGER NOT NULL REFERENCES teachers(id),
  user_id      TEXT NOT NULL,
  user_name    TEXT NOT NULL,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content      TEXT NOT NULL,
  is_anonymous INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
);

-- 登录尝试记录(限流用, 不含任何密码信息)
CREATE TABLE IF NOT EXISTS login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_course ON reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_reviews_teacher ON reviews(teacher_id);
CREATE INDEX IF NOT EXISTS idx_course_teachers_teacher ON course_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip, created_at);

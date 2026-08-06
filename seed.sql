-- 示例课程数据(可选)
-- 执行: wrangler d1 execute course-review --file=seed.sql
-- 正式上线后删除或替换为真实课程

INSERT INTO courses (name, teacher, description) VALUES
  ('计算机网络', '张老师', '核心专业课, 期末有实验+笔试, 教材: 谢希仁《计算机网络》'),
  ('密码学基础', '李老师', '理论与实践结合, 平时作业占比高, 认真听课不难'),
  ('信息安全导论', '王老师', '大一入门课, 内容偏科普, 考试开卷');

# 北印课程评价系统 (survivebigc-course-review)

基于 Cloudflare Workers + D1 的课程评价系统。**仅在校学生可访问**:
通过学校统一认证平台(CAS)登录, 后端调 `serviceValidate` 判定身份,
非学生身份(教师/其他)一律返回 403。

## 技术方案(已实测验证)

- 登录: 302 跳转 `authserver.bigc.edu.cn/authserver/login?service=<回调地址>`
- 验证: 用 ticket 调 `authserver.bigc.edu.cn/authserver/serviceValidate?service=...&ticket=...`
- 判定: 解析返回 XML 的 `cas:containerId`, 含 `bzks`(本科生 OU)即视为学生
  - 实测学生账号: `ou=bzks,ou=People`, `cas:user=学号`, `cas:userName=姓名`
  - **白名单式判定**: 只放行明确命中的 OU, 其余拒绝(安全优先)
  - ⚠️ 教师账号的 containerId 尚未实测, 建议后续用工号确认其 OU 形态,
    确认后把教师 OU 不在白名单中即可(默认已满足)

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
# 输出会给出你的 Worker 域名, 形如:
# https://survivebigc-course-review.<你的子域>.workers.dev
```

### 6. 回填域名并重新部署

把第 5 步得到的域名填进 `wrangler.toml` 的 `PUBLIC_BASE_URL`
(注意是 `https://` 开头、不带末尾斜杠), 然后重新:

```bash
wrangler deploy
```

> 这个值必须是你的真实域名, 因为 CAS 回调地址(service)与 ticket 校验必须严格一致。

### 7. 测试

1. 浏览器打开 Worker 域名 → 应自动跳转到学校统一认证登录页
2. 用学号密码登录 → 跳回课程列表 → 成功
3. 退出登录(右上角)→ 再试 → 确认重新走认证
4. (可选)借一个教师工号测试 → 应看到 403 无权访问页

### 8. (可选)绑定自定义域名

想用 `eval.survival.bigcctf.cn` 这类域名:

1. Cloudflare 控制台 → 左侧 Workers & Pages → 你的 Worker → Settings → Domains & Routes
2. Add → Custom Domain → 输入域名
3. 域名 DNS 若在 Cloudflare 托管会自动配置; 否则按提示在 DNS 处加 CNAME

绑定后把 `PUBLIC_BASE_URL` 改成新域名并重新 `wrangler deploy`。

## 在 SurviveBIGCManual 中添加入口

在文档仓库的某个 markdown 页面(如 `05-校园生活/`)加:

```markdown
[课程评价体系](https://survivebigc-course-review.<你的子域>.workers.dev) —
仅限在校学生登录查看, 评价内容不对教职工开放。
```

## 换届交接(半小时可完成)

本系统不依赖任何个人账号, 交接 = 重新部署:

1. `git clone` 本仓库代码
2. 新负责人 `wrangler login`(自己的账号)
3. `wrangler d1 create course-review` → 更新 `database_id`
4. 导出旧数据: `wrangler d1 export course-review --no-schema --output=backup.sql`
   在新库导入: `wrangler d1 execute course-review --file=backup.sql`
5. `wrangler deploy` → 域名 DNS 指向新 Worker

## 安全说明

- 密码**不经过本服务**: 学号密码只提交给学校统一认证平台
- 本服务只持有: ticket(一次性)、`serviceValidate` 返回的用户属性(学号/姓名/OU)
- 会话 cookie: HttpOnly + Secure + SameSite=Lax, 存 D1(30 天有效)
- 评价支持匿名提交(不显示姓名, 但数据库有记录, 仅系统维护者可见)
- 教师判定为白名单式: 无法确认身份的账号一律拒绝

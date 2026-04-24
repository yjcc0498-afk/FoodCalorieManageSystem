# AGENTS.md

## Project Overview
本项目现在的主版本是 **Food Calorie Management System v3**。它已经不再只是早期的 Food CRUD 后端练习，而是一个以 **TypeScript + Express + MongoDB** 为核心、带基础前端演示页面的完整练习项目。

当前主线能力分为 5 块：

1. 用户注册、登录、JWT 鉴权、当前用户查询。
2. 用户级 Food 数据管理，支持 owner 隔离。
3. 用户个人资料能力：资料编辑、密码修改、头像配置。
4. 管理员后台能力：用户管理、总览统计、全局 Food 浏览。
5. v3 演示前端：`/login`、`/register`、`/app`、`/admin`。

注意：
- 当前仓库主业务入口是 `server.ts`，不是旧的 `server.js`。
- 当前项目已经迁移为 **TypeScript**，不要再按旧版 CommonJS `.js` 项目理解整体结构。
- `server_test.js` 仍在仓库中，但不是当前 v3 主业务入口。
- `dist/` 是构建产物，除非任务明确要求，否则优先修改 `src` 风格的 `.ts` 源文件而不是改 `dist/`。

## Tech Stack
- Runtime: Node.js
- Language: TypeScript
- Web Framework: Express 5
- Database: Local MongoDB (`mongod`)
- ODM: Mongoose
- Auth: JWT (`jsonwebtoken`)
- Password Hashing: `bcryptjs`
- Frontend: Vanilla HTML / CSS / TypeScript
- Dev Tooling: `nodemon`, `tsc`
- Main Test Script: `npm test`

## Current Project Structure
代码必须继续遵循分层与职责分离，不要把路由、控制器、模型、配置和前端逻辑混在一起。

```text
/config
  db.ts
  runtime.ts
  bootstrapAdmin.ts
/controllers
  authController.ts
  foodController.ts
  profileController.ts
  adminController.ts
  userController.ts
/middleware
  authMiddleware.ts
  adminMiddleware.ts
  loginRateLimitMiddleware.ts
/models
  Food.ts
  User.ts
/public
  index.html
  login.html
  register.html
  user.html
  admin.html
  styles.css
  app.ts
/routes
  authRoutes.ts
  foodRoutes.ts
  profileRoutes.ts
  adminRoutes.ts
  userRoutes.ts
/tests
  auth-food-admin.test.ts
/types
  /express
    index.d.ts
/utils
  permissions.ts
/docs/images
/dist
server.ts
README.md
package.json
tsconfig.json
tsconfig.public.json
```

## Layering Mental Model
- `server.ts`：启动入口，串联静态资源、路由、运行时校验、数据库连接、管理员引导初始化。
- `routes`：URL 分发层，只负责挂中间件和把请求送进 controller。
- `middleware`：请求前置关卡，处理 JWT、管理员权限、登录限流。
- `controllers`：业务处理层，负责参数校验、模型调用、响应结构组织。
- `models`：数据结构层，定义 MongoDB 字段、校验规则、模型方法。
- `config`：运行时与启动期逻辑，例如数据库连接、JWT 配置、限流配置、管理员初始化。
- `public`：v3 演示前端页面与浏览器端 TypeScript。
- `types`：对 Express Request 做扩展声明，例如 `req.user`、`req.token`、`req.loginRateLimitKey`。
- `tests`：主流程集成测试，不参与线上请求链路。

建议始终按这条链路理解功能：

`Request -> Route -> Middleware -> Controller -> Model -> DB -> Response`

## Code Rules
- 当前项目默认使用 **TypeScript + ES Module 风格导入导出**。
- 可以使用：
  - `import x from '...'`
  - `import type { Request } from 'express'`
  - `export default ...`
  - `export { ... }`
- 不要把新增主代码写回旧式 `.js` 结构，除非是兼容特殊文件。
- 所有数据库操作优先使用 `async/await`。
- 所有异步数据库逻辑必须放在 `try/catch` 中，并返回清晰错误信息。
- 不要把数据库连接、模型、控制器、路由、中间件堆到同一个文件。
- 尽量保持现有代码风格：小函数拆分、显式校验、统一 JSON 响应。
- 可写少量注释，但优先解释“为什么这样分层/为什么这样设计”。

## Runtime And Build Rules
- 服务端入口：`server.ts`
- 构建命令：`npm run build`
- 服务端构建：`npm run build:server`
- 前端构建：`npm run build:client`
- 启动命令：`npm start`
- 开发命令：`npm run dev`
- 测试命令：`npm test`

说明：
- `npm run build` 会同时编译服务端和 `public/app.ts`。
- `npm start` 运行的是 `dist/server.js`。
- 修改前端交互逻辑时，应改 `public/app.ts`，浏览器实际加载的是其编译产物 `public/app.client.js`。

## Environment Rules
所有涉及数据库、JWT、登录限流、管理员初始化的行为，都应优先从 `.env` 读取，不要在源码中硬编码。

常见环境变量：

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/food-calorie-db
JWT_SECRET=replace-with-a-strong-secret
JWT_EXPIRES_IN=7d
LOGIN_RATE_LIMIT_WINDOW_MS=600000
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password
```

要求：
- 讨论或修改认证、数据库、限流、管理员初始化时，优先提醒检查 `.env`。
- 不要要求去源码里手改 MongoDB 地址、JWT 密钥或管理员密码。
- `.env` 不应提交到仓库；`.env.example` 用来说明配置结构。

## Database Connection Rules
- 使用 Mongoose 连接本地 MongoDB。
- 连接串从 `process.env.MONGODB_URI` 读取。
- `config/db.ts` 当前在缺少 `MONGODB_URI` 或连接失败时会直接退出进程。
- 不要在源码中硬编码数据库地址。

## Auth And User Domain Rules
### User Schema
当前 `models/User.ts` 已经不只是基础账号模型，还承载 v3 的 profile 能力：

- `username`
  - `String`
  - 必填、唯一、`trim`、`lowercase`
- `email`
  - `String`
  - 必填、唯一、`trim`、`lowercase`
  - 有基础邮箱格式校验
- `password`
  - `String`
  - 必填
  - 最少 6 位
  - `select: false`
  - 保存前自动哈希
- `role`
  - `user | admin`
  - 默认 `user`
- `bio`
  - 可空
  - 最长 280 字
- `height` / `age` / `weight` / `targetWeight`
  - 非负数
  - 默认 `null`
- `dailyCalorieGoal`
  - 非负数
  - 默认 `null`
- `avatarUrl`
  - 上传头像 URL，可空
- `avatarType`
  - `default | uploaded`
- `avatarSeed`
  - 默认头像种子
- `lastLoginAt`
  - 登录时间记录
- `passwordChangedAt`
  - 密码更新时间

### User Model Behavior
- 用户保存前自动哈希密码。
- 默认头像模式下，`avatarSeed` 会根据用户名生成。
- `toSafeObject()` 是当前项目的关键安全输出方法，返回用户信息时优先复用它。
- `comparePassword()` 是密码校验标准入口，不要自己复制 bcrypt 对比逻辑。

### Auth Rules
- 认证逻辑放在 `controllers/authController.ts`。
- `POST /auth/login` 必须经过 `loginRateLimitMiddleware`。
- `GET /auth/me` 必须经过 `authMiddleware`。
- 登录支持用 `username` 或 `email` 作为 `identifier`。
- 登录成功会更新 `lastLoginAt`。
- 返回用户数据时不要暴露密码字段。
- token 缺失、非法、过期时，应返回明确的 `401` 响应。

### Profile Rules
v3 已新增独立 Profile 域，相关逻辑集中在：
- `routes/profileRoutes.ts`
- `controllers/profileController.ts`

当前 Profile API 包括：
- `GET /profile`
- `PATCH /profile`
- `PATCH /profile/password`
- `PATCH /profile/avatar`
- `DELETE /profile/avatar`

设计要求：
- `PATCH /profile` 只处理资料字段，不要混入密码修改。
- `PATCH /profile/password` 单独处理密码变更。
- `PATCH /profile/avatar` / `DELETE /profile/avatar` 单独处理头像状态。
- `profileController` 默认依赖 `req.user`，不要在控制器里重复解析 JWT。

## Food Domain Rules
### Food Schema
- `name`
  - `String`
  - 必填
  - `trim`
  - `lowercase`
- `calories`
  - `Number`
  - 默认 `0`
  - 不能为负数
- `owner`
  - `ObjectId`
  - 关联 `User`
  - 必填

### Food Controller Rules
`controllers/foodController.ts` 当前除了基础 CRUD，还已经支持列表查询增强：

- `createFood`
  - 创建当前用户自己的 food
- `getAllFoods`
  - 只查询当前登录用户的 food
  - 支持 `keyword`
  - 支持 `page`、`limit`
  - 支持 `caloriesMin`、`caloriesMax`
  - 支持 `sortBy`、`order`
- `updateFoodCalories`
  - 当前只更新 `calories`
- `deleteFood`
  - 按 owner 隔离删除

要求：
- Food 查询 / 更新 / 删除必须带 owner 条件，避免越权访问。
- 不要把 Food 的 owner 隔离逻辑挪出控制器或忘掉。

## Admin Domain Rules
v3 已把管理员能力拆成两个域：

### 1. Admin Dashboard Domain
- 路由前缀：`/admin`
- 代码位置：
  - `routes/adminRoutes.ts`
  - `controllers/adminController.ts`

当前接口：
- `GET /admin/overview`
- `GET /admin/foods`

当前能力：
- 总用户数、管理员数、Food 总数
- 最近 7 天注册 / Food 创建统计
- 最近用户、最近 Food
- 按 Food 数量排行的用户
- 全局 Food 列表查询，支持 owner、keyword、热量范围、分页、排序

### 2. User Management Domain
- 路由前缀：`/users`
- 代码位置：
  - `routes/userRoutes.ts`
  - `controllers/userController.ts`

当前接口：
- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`

当前能力：
- 管理员查询用户列表
- 按 `keyword`、`role`、`sortBy`、`order`、`page`、`limit` 查询
- 用户详情聚合 `foodCount`
- 管理员更新用户资料、角色、密码、头像信息
- 删除用户时同步删除其 Food
- 管理员不能删除自己

要求：
- `/admin/*` 和 `/users/*` 都必须先经过 `authMiddleware`，再经过 `adminMiddleware`。
- 涉及角色判断时，优先复用 `utils/permissions.ts`。

## Middleware Rules
### `authMiddleware.ts`
- 负责 Bearer Token 解析与 JWT 校验。
- 成功后把用户挂到 `req.user`，token 挂到 `req.token`。
- 当前中间件兼容从编译产物或源码路径加载 User model。

### `adminMiddleware.ts`
- 依赖 `req.user`。
- 非管理员返回 `403`。

### `loginRateLimitMiddleware.ts`
- 仅用于登录接口。
- 当前实现是内存版 `Map` 限流，不是 Redis。
- key 由 `req.ip + identifier` 组成。
- 成功登录后会清空对应失败记录。

## Frontend v3 Rules
当前项目不再只是纯后端，`public/` 已经是 v3 的真实演示层。

### Static Pages
- `GET /` -> `public/index.html`
- `GET /login` -> `public/login.html`
- `GET /register` -> `public/register.html`
- `GET /app` -> `public/user.html`
- `GET /admin` -> `public/admin.html`

### Frontend Source
- 浏览器端主要逻辑在 `public/app.ts`。
- `public/app.ts` 统一处理：
  - 登录 / 注册
  - 用户页面视图切换
  - Profile / Security 表单
  - Food 列表分页过滤
  - Admin overview / users / foods

要求：
- 修改前端交互时，优先保持现有“单文件前端控制器 + 多页面 HTML”的结构。
- 不要轻易把前端随意拆成全新框架，除非用户明确要求升级架构。
- 如果只改用户端或管理员端页面，尽量把改动收敛到对应视图逻辑。

## Type Rules
- `types/express/index.d.ts` 负责扩展 Express Request。
- 需要新增 `req.xxx` 字段时，记得同步更新这个声明文件。
- 不要只在运行时往 `req` 上挂值，却忘记补类型。

## Current API Areas
### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Profile
- `GET /profile`
- `PATCH /profile`
- `PATCH /profile/password`
- `PATCH /profile/avatar`
- `DELETE /profile/avatar`

### Food
- `POST /food`
- `GET /foods`
- `PATCH /food/:id`
- `DELETE /food/:id`

常见 Food 查询示例：
- `GET /foods?keyword=chicken`
- `GET /foods?page=1&limit=10&sortBy=createdAt&order=desc`
- `GET /foods?caloriesMin=100&caloriesMax=300&sortBy=calories&order=asc`

### Admin
- `GET /admin/overview`
- `GET /admin/foods`

### User Management
- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`

## Update Checklist
如果你要新增或调整功能，默认按下面顺序检查：

1. `config`
2. `models`
3. `middleware`
4. `controllers`
5. `routes`
6. `server.ts`
7. `public/`（如果页面也受影响）
8. `README.md`
9. `tests/auth-food-admin.test.ts`
10. `types/express/index.d.ts`（如果请求对象形状变化）

特别是新增接口时，要同步检查：
- 是否需要新增 model 字段
- 是否需要新增或复用中间件保护
- 是否需要新增 route 挂载
- 是否需要更新前端调用
- 是否需要更新 README / 示例请求
- 是否需要补测试

## Testing Rules
- 当前主测试文件是 `tests/auth-food-admin.test.ts`。
- 实际运行时通过 `npm test` 先构建，再执行 `dist/tests/auth-food-admin.test.js`。
- 这组测试当前覆盖：
  - 鉴权拦截
  - 注册 / 登录 / `/auth/me`
  - Food owner 隔离
  - Food 分页 / 过滤 / 排序
  - 管理员权限
  - 登录失败限流

如果你修改了以下能力，应优先考虑同步补测或调整测例：
- Auth
- Food 列表查询参数
- Admin 用户管理
- 登录限流
- 返回结构字段名

## Security Notice
- 不要把密码、JWT 密钥、MongoDB 连接串或管理员密码硬编码进源码。
- 密码必须哈希后再入库。
- 返回用户信息时不要暴露密码字段。
- 受保护接口必须经过 JWT 校验。
- 管理员接口必须经过额外权限校验。
- Food 数据必须按 `owner` 隔离。
- 管理员删除用户时，需保持“同步删除其 Food”的现有行为一致。

## Agent Behavior Rules
- 默认把当前项目视为 **v3 主线版本**，后续可能微调，但主体是这个版本。
- 任何修改都应尽量贴近当前实际代码，而不是回退到 v1/v2 的旧认知。
- 不要把现在的 TypeScript v3 结构误写成旧版 CommonJS `.js` 架构。
- 如果用户让你“更新文档 / AGENTS / README”，要先以真实代码为准，再写文档。
- 如果某个能力已经有独立模块，例如：
  - `bootstrapAdmin.ts`
  - `profileController.ts`
  - `adminController.ts`
  就不要把逻辑复制回其他文件。
- 解释接口或链路时，优先使用：
  - `Request -> Route -> Middleware -> Controller -> Model -> DB -> Response`

# AGENTS.md

## Project Overview
本项目是一个食物热量管理系统（Food Calorie Management System）的 Node.js + Express + MongoDB 后端项目。当前项目已经从基础 Food CRUD 扩展为带 JWT 登录、用户模型、管理员用户管理、登录限流和用户级 Food 数据隔离的完整练习项目。

项目的核心职责分为三块：

1. 提供食物数据的增删改查能力，支持记录食物名称和热量。
2. 提供基于 JWT 的注册、登录、当前用户查询和接口鉴权能力。
3. 提供管理员用户管理能力，包括用户查询、更新、删除，以及删除用户时同步删除其 Food 数据。

当前项目使用本地 `mongod` 作为数据库服务，不依赖 MongoDB Atlas。默认开发模式下，数据库连接串、JWT 密钥、登录限流配置和管理员初始化信息都从 `.env` 读取。

注意：仓库中存在 `notebooklm-pack/` 和 `server_test.js`，但它们不属于当前项目主业务结构。更新或生成代码时默认不要把它们当作核心业务入口。

## Tech Stack
- Runtime: Node.js
- Web Framework: Express 5
- Database: Local MongoDB (`mongod`)
- ODM: Mongoose
- Auth: JWT (`jsonwebtoken`)
- Password Hashing: `bcryptjs`
- API Testing: Postman
- Dev Tooling: `nodemon`
- Test Script: `node tests/auth-food-admin.test.js`

## Current Project Structure
代码必须遵循关注点分离原则，不要把数据库连接、认证逻辑、业务逻辑、路由和模型定义混写在单个文件里。

```text
/config
  db.js                         # 数据库连接逻辑
  runtime.js                    # .env 运行时配置读取与校验
  bootstrapAdmin.js             # 启动时确保管理员账号存在
/controllers
  authController.js             # 注册 / 登录 / 当前用户业务逻辑
  foodController.js             # Food CRUD 业务逻辑
  userController.js             # 管理员用户管理逻辑
/middleware
  authMiddleware.js             # JWT 鉴权中间件
  adminMiddleware.js            # 管理员权限校验中间件
  loginRateLimitMiddleware.js   # 登录失败限流中间件
/models
  Food.js                       # Food 数据模型，包含 owner 用户归属
  User.js                       # User 数据模型，包含密码哈希与安全输出方法
/public
  index.html                    # 当前演示页面
  app.js                        # 前端页面逻辑
  styles.css                    # 前端样式
/routes
  authRoutes.js                 # 认证相关路由
  foodRoutes.js                 # Food 相关路由
  userRoutes.js                 # 用户管理相关路由
/tests
  auth-food-admin.test.js       # Auth / Food / Admin 主流程测试脚本
/utils
  permissions.js                # 角色与权限判断工具
/docs/images                    # README 截图资源
server.js                       # 应用入口
.env                            # 本地环境变量，不能提交
.env.example                    # 环境变量示例
README.md                       # 项目说明
package.json                    # 依赖与脚本
```

## Layering Mental Model
- `routes` 像“请求包入口分发器”，负责根据 URL 和 HTTP Method 把请求送进正确链路。
- `middleware` 像“请求前置关卡”，负责 JWT 解析、身份校验、管理员权限校验和登录限流。
- `controllers` 像“参数组装、发包和响应解析层”，负责读取参数、调用模型、组织响应。
- `models` 像“数据结构协议层”，负责定义 MongoDB 中记录的字段结构、校验规则和模型级方法。
- `config` 负责数据库连接、运行时配置校验和启动时管理员账号初始化。
- `utils` 只放可复用的小工具，例如角色判断，不承载请求流程。
- `tests` 负责脱离人工 Postman 的主流程验证，不参与线上请求链路。
- `server.js` 负责把模块串起来，让启动流程和挂载入口保持清晰。

如果你有 JS 逆向 / 爬虫背景，可以这样理解：
- Postman 或前端发来的 HTTP 请求，就像你构造的“请求包”
- `routes` 决定这个包进入哪条链路
- `middleware` 先做登录态识别、权限过滤或限流
- `controllers` 再做参数校验、业务处理和响应组装
- `models` 负责字段规则和结构约束
- MongoDB 是最终落库目标

## Code Rules
- 模块风格必须且仅使用 `CommonJS`：`require` / `module.exports`
- 所有数据库操作必须使用 `async/await`
- 所有异步数据库逻辑必须放在 `try/catch` 中，并返回清晰错误信息
- 不要把数据库连接、模型、控制器、路由、中间件逻辑写进同一个文件
- 关键位置可以写少量注释，优先解释“为什么这样分层”，而不是只解释语法
- 涉及认证时，认证解析逻辑应放在 `middleware`，不要把 JWT 解析散落到每个 controller
- 涉及管理员权限时，优先复用 `adminMiddleware.js` 和 `utils/permissions.js`
- 任何配置项都优先从 `.env` 读取，不要在源码中硬编码数据库地址、JWT 密钥、管理员账号密码或限流参数

## Food Domain Rules
### Food Schema
- `name`
  - 类型：`String`
  - 必填
  - 自动去除首尾空格
  - 自动转换为小写
- `calories`
  - 类型：`Number`
  - 默认值为 `0`
  - 必须校验不能为负数
- `owner`
  - 类型：`ObjectId`
  - 关联 `User`
  - 必填
  - Food 查询 / 更新 / 删除必须带上 owner 过滤条件，避免越权访问

### Food Controller Rules
- `createFood` 负责读取请求体、校验字段、创建带 `owner` 的食物记录
- `getAllFoods` 负责查询当前登录用户可见的食物列表，可带 `keyword` 搜索
- `updateFoodCalories` 负责只更新热量字段
- `deleteFood` 负责删除指定食物记录
- Food 控制器默认依赖 `req.user`，不要在控制器里重复解析 token

## User/Auth Domain Rules
### User Schema
- `username`
  - 类型：`String`
  - 必填
  - 唯一
  - `trim`
  - `lowercase`
- `email`
  - 类型：`String`
  - 必填
  - 唯一
  - `trim + lowercase`
  - 有基本邮箱格式校验
- `password`
  - 类型：`String`
  - 必填
  - 最少 6 位
  - `select: false`
  - 数据库存储必须是哈希值，不能明文保存
- `role`
  - 使用 `user` / `admin`
  - 默认值为 `user`

### Auth Rules
- 注册、登录、当前用户查询逻辑放在 `authController.js`
- JWT 生成和校验要围绕 `.env` 中的 `JWT_SECRET` 和 `JWT_EXPIRES_IN`
- 登录成功后返回 token 和安全用户信息，不返回密码
- `POST /auth/login` 必须经过 `loginRateLimitMiddleware`
- `GET /auth/me` 必须经过 `authMiddleware`
- 如果 token 缺失、非法或过期，应返回清晰的 `401` 错误

### Admin/User Management Rules
- 用户管理相关逻辑放在 `userController.js`
- 用户管理路由统一挂载在 `/users`
- 用户管理接口必须先经过 `authMiddleware`，再经过 `adminMiddleware`
- 删除用户时，当前实现会同步删除该用户名下 Food，应保持这一行为一致
- 当前实现包含“管理员不能删除自己”的约束，应保持该行为一致，避免锁死系统

## Database Connection Rules
- 使用 Mongoose 连接本地 MongoDB
- 连接字符串必须从 `.env` 读取
- 本地默认示例连接串为：

```env
MONGODB_URI=mongodb://127.0.0.1:27017/food-calorie-db
```

- 当前项目使用现代 Mongoose 驱动，默认连接配置即可，不再添加已废弃的 `useNewUrlParser` 和 `useUnifiedTopology`
- 不要在源码中硬编码数据库地址

## Environment Rules
常见环境变量包括：

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

- 涉及数据库、JWT、登录限流或管理员初始化时，必须优先提醒开发者检查 `.env`
- 不要要求去源码里修改连接地址、JWT 密钥或管理员账号密码
- 提交代码前，确保 `.env` 已被 `.gitignore` 忽略

## Agent Behavior Rules
- 修改代码时，优先按这条顺序思考：`config -> models -> middleware -> controllers -> routes -> server.js`
- 如果任务只涉及某个域，例如 Food 域、Auth 域、User 域，应尽量把改动收敛在对应层，不要无谓扩散
- 如果新增接口，要同步检查：
  - 是否需要新增 model 字段
  - 是否需要新增中间件保护
  - 是否需要新增 route 挂载
  - 是否需要更新 README / Postman 示例
  - 是否需要补充或调整 `tests/auth-food-admin.test.js`
- 如果某个功能已经有独立模块，例如 `bootstrapAdmin.js`，不要把初始化逻辑直接复制进业务请求链路
- 如果生成代码示例或解释接口，优先用下面这条链路说明：
  - `Request -> Route -> Middleware -> Controller -> Model -> DB -> Response`

## Current API Areas
当前项目至少覆盖以下接口域：

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Food
- `POST /food`
- `GET /foods`
- `GET /foods?keyword=chicken`
- `PATCH /food/:id`
- `DELETE /food/:id`

### User Management
- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`

说明：如果你要调整这些接口，必须同时检查对应的 controller、middleware、model、README 和测试脚本描述是否一致。

## Postman Request Examples
生成代码后，默认应提供 Postman 示例，至少包含 URL、Method、Body（如适用）和是否需要 Bearer Token。

### 1. Register
- Method: `POST`
- URL: `http://localhost:3000/auth/register`
- Body:

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "123456"
}
```

### 2. Login
- Method: `POST`
- URL: `http://localhost:3000/auth/login`
- Body:

```json
{
  "identifier": "alice",
  "password": "123456"
}
```

### 3. Get Current User
- Method: `GET`
- URL: `http://localhost:3000/auth/me`
- Headers:

```text
Authorization: Bearer <token>
```

### 4. Create Food
- Method: `POST`
- URL: `http://localhost:3000/food`
- Headers:

```text
Authorization: Bearer <token>
```

- Body:

```json
{
  "name": "Chicken Breast",
  "calories": 165
}
```

### 5. Get All Foods
- Method: `GET`
- URL: `http://localhost:3000/foods`
- Headers:

```text
Authorization: Bearer <token>
```

### 6. Update Food Calories
- Method: `PATCH`
- URL: `http://localhost:3000/food/:id`
- Headers:

```text
Authorization: Bearer <token>
```

- Body:

```json
{
  "calories": 180
}
```

### 7. Delete Food
- Method: `DELETE`
- URL: `http://localhost:3000/food/:id`
- Headers:

```text
Authorization: Bearer <token>
```

### 8. Get Users (Admin)
- Method: `GET`
- URL: `http://localhost:3000/users`
- Headers:

```text
Authorization: Bearer <admin-token>
```

## Project Goals
- 保持 Food、Auth、User 三块能力按层分离
- 跑通本地服务器与本地 MongoDB 的连接
- 通过 `.env` 管理数据库、JWT、登录限流和管理员初始化配置
- 让开发者清楚理解整条链路：
  - `Request -> Route -> Middleware -> Controller -> Model -> DB -> Response`
- 在新增功能时，避免牵一发而动全身

## Security Notice
- 不要把密码、JWT 密钥、远程连接串或管理员账号密码硬编码进源码
- 密码必须哈希后再入库
- 返回用户信息时不要暴露密码字段
- 受保护接口要经过 JWT 校验
- 管理员接口要经过额外权限校验
- Food 数据必须按 `owner` 隔离，避免用户访问他人的数据

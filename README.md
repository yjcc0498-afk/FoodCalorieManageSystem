# Food Calorie Management System v3

一个基于 `Node.js + Express 5 + MongoDB + Mongoose + TypeScript` 的食物热量管理练习项目。当前主线版本已经包含：

- 用户注册、登录、JWT 鉴权、`GET /auth/me`
- 用户级 Food 管理与 owner 隔离
- Profile 资料、密码、头像管理
- Admin 总览、全局 Food 浏览、用户管理
- v3 演示前端页面：`/login`、`/register`、`/app`、`/admin`
- 新增 Goals + Journal 后端：目标周期、按日期体重日志、按日期饮食记录与汇总

## Tech Stack

- Node.js
- TypeScript
- Express 5
- MongoDB（本地 `mongod`）
- Mongoose
- JWT（`jsonwebtoken`）
- `bcryptjs`
- Vanilla HTML / CSS / TypeScript

## Request Flow

项目按以下链路组织：

```text
Request -> Route -> Middleware -> Controller -> Model -> DB -> Response
```

## Project Structure

```text
/config
/controllers
/middleware
/models
/public
/routes
/tests
/types
/utils
server.ts
README.md
package.json
```

## Runtime Config

运行时配置始终以 `.env` / `process.env` 为准，不要把 MongoDB 地址、JWT 密钥、管理员账号密码或限流参数硬编码进源码。

常用变量如下：

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

说明：

- `.env` 不应提交到仓库
- `.env.example` 用来说明配置结构
- 启动、鉴权、管理员引导、限流、Goals + Journal 接口都依赖这些运行时配置

## Getting Started

1. 确保本地 MongoDB 已启动
2. 检查或复制 `.env.example` 到 `.env`
3. 安装依赖并构建

```bash
npm install
npm run build
```

启动生产构建：

```bash
npm start
```

开发模式：

```bash
npm run dev
```

运行集成测试：

```bash
npm test
```

## Demo Routes

- `GET /` -> `public/index.html`
- `GET /login` -> `public/login.html`
- `GET /register` -> `public/register.html`
- `GET /app` -> `public/user.html`
- `GET /admin` -> `public/admin.html`

## Core APIs

默认服务地址：`http://localhost:3000`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

登录成功后将返回 `token`，后续受保护接口需要：

```text
Authorization: Bearer <token>
```

### Profile

- `GET /profile`
- `PATCH /profile`
- `PATCH /profile/password`
- `PATCH /profile/avatar`
- `DELETE /profile/avatar`

### Foods

- `POST /food`
- `GET /foods`
- `PATCH /food/:id`
- `DELETE /food/:id`

支持的常见查询：

- `GET /foods?keyword=chicken`
- `GET /foods?page=1&limit=10&sortBy=createdAt&order=desc`
- `GET /foods?caloriesMin=100&caloriesMax=300&sortBy=calories&order=asc`

### Admin

- `GET /admin/overview`
- `GET /admin/foods`
- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`

`GET /admin/overview` 返回的是脱敏后的运行时摘要，不会暴露原始 JWT secret、管理员密码或 MongoDB 连接串。

## Goals + Journal APIs

当前后端已经支持 Goals + Journal 第一阶段闭环，`Food` 仍作为食物主数据，实际每日摄入量只按 `JournalEntry` 聚合。

### Goal Cycle

- `GET /goals/active`
- `POST /goals/cycle`
- `PATCH /goals/cycle/:id`

`GoalCycle` 字段：

- `owner`
- `startDate`
- `endDate`
- `startWeight`
- `targetWeight`
- `dailyCalorieGoal`
- `status`：`active | completed | archived`

规则：

- 同一用户同一时间最多只有 1 个 `active` 周期
- 新建新周期时，旧的 `active` 周期会自动转为 `archived`
- `User.weight / targetWeight / dailyCalorieGoal` 目前保留兼容，但前端与新汇总接口优先读取当前激活周期

示例：

```http
POST /goals/cycle
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "startDate": "2026-04-24",
  "endDate": "2026-06-24",
  "startWeight": 64.8,
  "targetWeight": 61.5,
  "dailyCalorieGoal": 1750
}
```

### Daily Log

- `GET /daily-log?date=YYYY-MM-DD`
- `PUT /daily-log?date=YYYY-MM-DD`

`DailyLog` 用于记录某天的体重与备注，按 `owner + date` 唯一。重复写入同一天会走 upsert，而不是创建重复记录。

示例：

```http
PUT /daily-log?date=2026-04-24
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "weight": 64.1,
  "notes": "Updated after workout"
}
```

### Journal

- `GET /journal?date=YYYY-MM-DD`
- `POST /journal`
- `PATCH /journal/:id`
- `DELETE /journal/:id`

`JournalEntry` 第一版字段：

- `owner`
- `date`
- `mealType`：`breakfast | lunch | dinner | snack`
- `foodName`
- `calories`
- `quantity`
- `foodId`（可选）
- `notes`（可选）

接口按当前登录用户做 owner 隔离，不能访问或修改他人的 `JournalEntry`。

示例：

```http
POST /journal
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "date": "2026-04-24",
  "mealType": "lunch",
  "foodName": "Chicken Bowl",
  "calories": 560,
  "quantity": 1
}
```

### Goal Day Summary

- `GET /goals/day?date=YYYY-MM-DD`
- `GET /goals/day?date=YYYY-MM-DD&month=YYYY-MM`

这个接口用于一次性取回某天的追踪摘要，返回结构包括：

- `date`
- `goalCycle`
- `dailyLog`
- `journalEntries`
- `monthIndicators`
- `summary.actualCalories`
- `summary.targetCalories`
- `summary.remainingCalories`
- `summary.weightProgress`

其中：

- `actualCalories` = 该日全部 `JournalEntry.calories` 汇总
- `targetCalories` = 当前激活 `GoalCycle.dailyCalorieGoal`
- `remainingCalories` = `targetCalories - actualCalories`
- `weightProgress` = 按周期起止日和起始/目标体重计算的理论进度

## API Examples

### Register

```http
POST /auth/register
Content-Type: application/json
```

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "123456"
}
```

### Login

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "identifier": "alice",
  "password": "123456"
}
```

### Create Food

```http
POST /food
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "name": "Chicken Breast",
  "calories": 165
}
```

### Goal Day Summary Response Shape

```json
{
  "message": "Goal day summary fetched successfully.",
  "data": {
    "date": "2026-04-24",
    "goalCycle": {},
    "dailyLog": {},
    "journalEntries": [],
    "monthIndicators": [],
    "summary": {
      "actualCalories": 1150,
      "targetCalories": 1800,
      "remainingCalories": 650,
      "weightProgress": {
        "expectedWeight": 64.11,
        "actualWeight": 64,
        "variance": -0.11,
        "progressRatio": 0.0645,
        "actualProgressRatio": 0.2424
      }
    }
  }
}
```

## Testing Notes

当前主测试文件是 `tests/auth-food-admin.test.ts`，`npm test` 会先构建，再执行 `dist/tests/auth-food-admin.test.js`。

当前测试覆盖包括：

- 鉴权拦截
- 注册 / 登录 / `GET /auth/me`
- Food owner 隔离与列表筛选
- Admin 权限与总览摘要
- 登录失败限流
- Goal cycle 创建与单激活周期行为
- Daily log 同日 upsert
- Journal owner isolation
- `/goals/day` 热量汇总与摘要结构

## Notes

- `SavedMeal` 与 `AuditLog` 目前仍是后续设计项，本轮未开放对应后端接口
- 若修改认证、数据库、管理员引导或限流配置，请优先检查 `.env`

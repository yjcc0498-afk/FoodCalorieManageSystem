# AGENTS.md

## Project Overview
本项目是一个食物热量管理系统（Food Calorie Management System）的后端 MVP。
核心目标是为前端或 API 调用者提供食物数据的增删改查（CRUD）能力，帮助用户记录食物名称及其对应的卡路里数值。

当前项目使用本地 `mongod` 作为数据库服务，不再依赖 MongoDB Atlas。默认开发模式下，应用通过 `.env` 中的本地连接串连接到本机 MongoDB 实例。

## Tech Stack
- Runtime: Node.js（建议 `v16.20.1` 或更高版本）
- Web Framework: Express
- Database: Local MongoDB (`mongod`)
- ODM: Mongoose
- API Testing: Postman

## Project Structure
代码必须遵循关注点分离原则，严禁将所有逻辑写在单个文件中。

```text
/config
  db.js                # 数据库连接逻辑
/models
  Food.js              # Mongoose 数据模型定义
/controllers
  foodController.js    # 业务逻辑处理函数
/routes
  foodRoutes.js        # API 路由定义
server.js              # 应用入口，负责加载配置、中间件和启动服务
.env                   # 本地环境变量，例如 MongoDB 连接串和端口
```

### Why This Layering
- `routes` 像“请求包入口分发器”，负责根据 URL 和 HTTP Method 把请求送进正确链路。
- `controllers` 像“请求包构建与响应包解析层”，负责读取参数、调用模型、组织返回结果。
- `models` 像“字段协议定义”，负责约束数据库中的记录结构和校验规则。
- `config` 负责底层连接初始化，避免数据库连接细节散落到业务代码里。
- `server.js` 负责把模块串起来，让启动流程和运行入口保持清晰。

## Code Rules
- 模块风格必须且仅使用 `CommonJS`：`require` / `module.exports`
- 所有数据库操作必须使用 `async/await`
- 所有异步数据库逻辑必须包裹在 `try/catch` 中，并返回清晰错误信息
- 不要把数据库连接、路由、业务逻辑、模型定义混写在同一个文件里
- 关键位置可以加入少量注释，解释“为什么要这样分层”，而不是只解释语法

### Food Schema Rules
- `name`
  - 类型：`String`
  - 必填
  - 自动去除首尾空格
  - 自动转换为小写
- `calories`
  - 类型：`Number`
  - 默认值为 `0`
  - 必须校验不能为负数

### Database Connection Rules
- 使用 Mongoose 连接本地 MongoDB
- 连接字符串必须从 `.env` 中读取
- 本地默认示例连接串为：

```env
MONGODB_URI=mongodb://127.0.0.1:27017/food-calorie-db
```

- 当前项目使用现代 Mongoose 驱动，默认连接配置即可，不再添加已废弃的 `useNewUrlParser` 和 `useUnifiedTopology`
- 不要在代码中硬编码数据库地址；即使是本地开发，也统一从 `.env` 读取

## Agent Behavior Rules
- 生成或修改代码时，优先按 `config -> models -> controllers -> routes -> server.js` 的顺序思考和组织
- 解释接口流转时，优先类比 JS 逆向 / 爬虫中的流程：
  - `Route` 像请求包入口
  - `Controller` 像参数组装、发包和响应解析
  - `Model` 像数据结构协议和字段校验
  - `DB` 像最终落库目标
- 涉及数据库配置时，必须提醒开发者检查 `.env`，而不是要求去源码里改连接地址
- 生成代码后，需要提供 Postman 请求示例，至少包含：
  - URL
  - Method
  - Body（如适用）

## Project Goals
- 实现核心 CRUD：
  - 获取所有食物
  - 创建食物
  - 更新食物记录
  - 删除食物记录
- 帮助开发者理解数据流转路径：
  - `Request -> Route -> Controller -> Model -> DB -> Response`
- 跑通本地服务器与本地 MongoDB 的连接，实现持久化存储

## Security Notice
- `.env` 中应保存运行配置，例如：

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/food-calorie-db
```

- 提交代码前，确保 `.env` 已被 `.gitignore` 忽略
- 即使当前改用本地数据库，也不要把账号、密码或远程连接串硬编码进源码

## Postman Request Examples
### 1. Create Food
- Method: `POST`
- URL: `http://localhost:3000/food`
- Body:

```json
{
  "name": "Chicken Breast",
  "calories": 165
}
```

### 2. Get All Foods
- Method: `GET`
- URL: `http://localhost:3000/foods`

### 3. Update Food Calories
- Method: `PATCH`
- URL: `http://localhost:3000/food/:id`
- Body:

```json
{
  "calories": 180
}
```

### 4. Delete Food
- Method: `DELETE`
- URL: `http://localhost:3000/food/:id`

## Mental Model For This Project
如果你有爬虫或 JS 逆向背景，可以这样理解：
- 前端或 Postman 发来的 HTTP 请求，就像你构造的“请求包”
- `routes` 先决定这个包应该进哪条处理链
- `controllers` 负责解析参数、执行业务并组装响应，类似你拿到响应后做字段提取和结构化
- `models` 定义字段规则，相当于在分析接口时先确定 JSON 结构和字段类型
- MongoDB 是最终存储层，相当于把解析后的结果写入本地持久化数据库

这套分层的目标，不只是“代码好看”，而是让请求、业务和数据结构彼此解耦，后续新增接口时不会牵一发而动全身。

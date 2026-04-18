# config/db.js 数据库连接

## 文件职责

这个文件只负责一件事：

连接 MongoDB。

它不负责：

- 定义数据结构
- 写 CRUD 逻辑
- 处理 HTTP 请求

这就是分层的意义。

## 当前代码

```js
const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully.');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
```

## 为什么数据库连接要单独拆文件

因为数据库连接是底层基础设施。

如果把它写在 `server.js`、`controller`、`model` 里，会带来这些问题：

- 连接细节散落在多个地方
- 后续维护困难
- 出错时不容易定位
- 分层不清晰

所以我们把它放在 `config/db.js`。

## 关键知识点

### 1. `process.env.MONGODB_URI`

作用：

- 从 `.env` 中读取数据库连接串

当前示例：

```env
MONGODB_URI=mongodb://127.0.0.1:27017/food-calorie-db
```

注意：

- 不要把数据库地址硬编码进源码
- 即使是本地开发，也应该从 `.env` 读取

### 2. `mongoose.connect(mongoUri)`

作用：

- 使用 Mongoose 连接 MongoDB

Mongoose 是 ODM。

你可以把它理解成：

- MongoDB 原生驱动之上的一层“对象化操作封装”
- 帮你管理 schema、校验、模型和数据库交互

### 3. `try/catch`

作用：

- 捕获连接失败错误

比如：

- MongoDB 没启动
- 连接串写错
- 端口不对

### 4. `process.exit(1)`

作用：

- 在关键启动失败时直接退出进程

这是合理的，因为如果数据库连不上，这个项目的核心功能基本无法正常工作。

## 这个文件在项目里的位置

启动流程是：

1. `server.js` 调用 `connectDB()`
2. `connectDB()` 读取 `.env`
3. 用 Mongoose 连接本地 MongoDB
4. 成功后打印日志
5. 再启动 Express 服务

## 初学者容易混淆的点

### Mongoose 和 MongoDB 的关系

- MongoDB 是数据库
- Mongoose 是操作 MongoDB 的工具库

### 连接数据库不等于定义模型

连接数据库是：

- “我能进数据库了”

定义模型是：

- “数据库里的文档要长什么样”

这两个概念不能混在一起。

## 你可以做的练习

1. 把 `.env` 的数据库名改成别的名字，看看会不会连接成功
2. 故意写错端口，观察报错信息
3. 删除 `.env` 里的 `MONGODB_URI`，观察程序如何退出

## 自测问题

- 为什么这里不用把数据库地址写死在代码里？
- 为什么数据库连接逻辑不放在 `controller` 里？
- 为什么连接失败后要退出进程？

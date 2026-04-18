# server.js 应用入口

## 文件职责

`server.js` 是应用入口。

它不负责写业务逻辑，也不负责定义数据库字段。

它主要做 4 件事：

1. 读取环境变量
2. 创建 Express 应用
3. 注册中间件和路由
4. 连接数据库并启动服务

## 当前代码

```js
require('dotenv').config();

const path = require('path');
const express = require('express');
const connectDB = require('./config/db');
const foodRoutes = require('./routes/foodRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/', foodRoutes);

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
  });
};

startServer();
```

## 逐段理解

### 1. `require('dotenv').config()`

作用：

- 读取 `.env` 文件
- 把 `PORT`、`MONGODB_URI` 放进 `process.env`

如果没有这句，代码里就读不到 `.env` 配置。

### 2. `const app = express()`

作用：

- 创建 Express 应用实例

你可以把它理解成整个后端服务的主对象。

### 3. `app.use(express.json())`

作用：

- 让 Express 能解析 JSON 请求体

比如当前端发送：

```json
{
  "name": "Chicken Breast",
  "calories": 165
}
```

如果没有这句，`req.body` 很可能是 `undefined`。

### 4. `app.use(express.static(...))`

作用：

- 把 `public` 文件夹作为静态资源目录

这样浏览器访问页面时，能加载：

- `index.html`
- `styles.css`
- `app.js`

### 5. `app.get('/', ...)`

作用：

- 当访问首页时，返回前端页面文件

这就是为什么打开 `http://localhost:3000/` 会看到页面，而不是只看到 JSON。

### 6. `app.use('/', foodRoutes)`

作用：

- 把食物相关路由注册进应用

这里不直接写每个接口，而是把请求交给 `routes/foodRoutes.js`。

这就是分层思想：入口负责接线，具体接口定义交给路由层。

### 7. `await connectDB()`

作用：

- 先连接数据库
- 连接成功后再启动服务

这样做的好处是：

- 避免服务启动了但数据库没连上
- 更容易定位问题

## 从请求流转角度理解

如果用户打开首页：

1. 浏览器请求 `/`
2. `server.js` 返回 `public/index.html`
3. 浏览器再加载 `app.js`
4. 前端脚本请求 `/foods`
5. 请求再流向路由层和控制器层

## 初学者最容易忽略的点

- `server.js` 不是业务逻辑文件
- `server.js` 不应该写数据库字段规则
- `server.js` 更像“总接线板”

## 你应该尝试的练习

1. 把首页返回文字改成你自己的标题
2. 把端口改成 `.env` 里的其他值再运行
3. 注释掉 `express.json()`，观察创建接口会发生什么
4. 注释掉 `express.static(...)`，观察页面资源会发生什么

## 自测问题

- 为什么 `server.js` 不直接写 CRUD 逻辑？
- 为什么要先连接数据库再 `listen`？
- 为什么前端页面能通过 Node 服务直接打开？

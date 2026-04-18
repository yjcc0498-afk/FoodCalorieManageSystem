# routes/foodRoutes.js 路由层

## 文件职责

路由层负责把不同的 URL 和 HTTP Method 映射到不同的控制器函数。

你可以把它理解成：

- 请求包入口分发器

它不负责：

- 数据校验细节
- 数据库操作细节
- 字段定义

## 当前代码

```js
const express = require('express');
const {
  createFood,
  getAllFoods,
  updateFoodCalories,
  deleteFood
} = require('../controllers/foodController');

const router = express.Router();

router.post('/food', createFood);
router.get('/foods', getAllFoods);
router.patch('/food/:id', updateFoodCalories);
router.delete('/food/:id', deleteFood);

module.exports = router;
```

## 一行一行理解

### `express.Router()`

作用：

- 创建一个路由对象

这样可以把食物相关路由单独放在一个文件里，而不是全塞进 `server.js`。

### `router.post('/food', createFood)`

含义：

- 当收到 `POST /food`
- 就调用 `createFood`

### `router.get('/foods', getAllFoods)`

含义：

- 当收到 `GET /foods`
- 就调用 `getAllFoods`

同时因为 controller 支持 `req.query.keyword`，所以它也兼容：

- `GET /foods?keyword=chicken`

### `router.patch('/food/:id', updateFoodCalories)`

含义：

- `:id` 是动态参数
- 比如 `/food/6801abc123...`

### `router.delete('/food/:id', deleteFood)`

含义：

- 删除指定 ID 的食物记录

## 为什么路由层要独立存在

如果不拆分，所有接口都会写在 `server.js` 里。

问题会变成：

- 代码越来越长
- 模块职责混乱
- 找接口不方便
- 扩展困难

拆出路由层后，项目更清楚：

- `server.js` 负责挂载
- `routes` 负责分发
- `controller` 负责业务

## Route 和 Controller 的区别

### Route 关注

- 哪个请求走哪个函数

### Controller 关注

- 这个函数里具体做什么

一句话：

- Route 决定“去哪”
- Controller 决定“怎么做”

## 你可以尝试的扩展

1. 新增 `GET /food/:id`
2. 新增 `PUT /food/:id`
3. 新增 `GET /foods/stats`

## 自测问题

- 为什么路由层不直接写数据库操作？
- `:id` 是什么含义？
- 为什么 `GET /foods` 和 `GET /foods?keyword=...` 可以共用一个 route？

# controllers/foodController.js 业务逻辑

## 文件职责

这个文件是业务处理中心。

它负责：

- 读取请求参数
- 做参数校验
- 调用 Model 操作数据库
- 返回响应给前端或 Postman

如果类比 JS 逆向或爬虫：

- `Controller` 很像“参数组装 + 发包 + 响应解析”这一层

## 当前提供的能力

- 创建食物
- 获取所有食物
- 按关键字搜索食物
- 更新热量
- 删除食物

## 代码中最重要的思维

Controller 的核心不是“把所有代码写一起”，而是：

1. 从请求里取数据
2. 判断数据是否合法
3. 调用模型
4. 组织清晰的 JSON 响应

## 方法拆解

### 1. `createFood`

它做了这些事：

1. 从 `req.body` 里取 `name` 和 `calories`
2. 检查 `name` 是否存在
3. 检查 `calories` 是否是合法非负数
4. 组装 `payload`
5. 调用 `Food.create(payload)`
6. 返回 `201` 响应

这一段体现了一个好习惯：

- 先校验，再入库

### 2. `getAllFoods`

它现在不仅能获取全部数据，也支持模糊查询。

关键点：

```js
const { keyword } = req.query;
const filter = {};

if (keyword && keyword.trim()) {
  filter.name = {
    $regex: keyword.trim().toLowerCase(),
    $options: 'i'
  };
}
```

这里的意思是：

- 如果用户没有传 `keyword`，那就查全部
- 如果用户传了 `keyword`，就按名称做模糊查找

例如：

- `GET /foods`
- `GET /foods?keyword=chicken`

### 3. `updateFoodCalories`

它只更新热量。

流程：

1. 取出 URL 参数中的 `id`
2. 取出请求体中的 `calories`
3. 校验 `id` 是否是合法 MongoDB ObjectId
4. 校验 `calories` 是否有效
5. 调用 `Food.findByIdAndUpdate(...)`
6. 如果找不到记录，返回 `404`
7. 更新成功返回 `200`

这里有一个非常实用的点：

```js
{ new: true, runValidators: true }
```

含义：

- `new: true`
  返回更新后的文档
- `runValidators: true`
  更新时也走模型校验

### 4. `deleteFood`

流程：

1. 取出 `id`
2. 校验 `id`
3. 调用 `Food.findByIdAndDelete(id)`
4. 如果找不到记录，返回 `404`
5. 删除成功返回 `200`

## Controller 为什么要用 `try/catch`

因为数据库操作是异步的，而且可能失败。

例如：

- 数据库异常
- 查询失败
- 更新失败

如果不做异常捕获，接口可能直接崩掉，或者返回不清晰的错误。

## Controller 返回的状态码

你应该记住这些：

- `200`
  成功获取、更新、删除
- `201`
  成功创建
- `400`
  参数不合法
- `404`
  目标数据不存在
- `500`
  服务器内部错误

## 初学者要学会的不是“背代码”，而是“背流程”

当你看一个 controller 时，请强制自己按这个顺序理解：

1. 参数从哪里来
2. 参数如何校验
3. 调用哪个模型方法
4. 成功返回什么
5. 失败返回什么

## 练习建议

1. 新增 `getFoodById`
2. 让更新接口同时支持改 `name` 和 `calories`
3. 增加热量范围筛选，比如 `minCalories` 和 `maxCalories`
4. 让搜索接口支持排序参数

## 自测问题

- 为什么更新和删除前要校验 `ObjectId`？
- 为什么 `createFood` 里要先把 `calories` 转成数字？
- `404` 和 `400` 的区别是什么？

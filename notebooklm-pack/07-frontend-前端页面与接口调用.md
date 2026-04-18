# 前端页面与接口调用

## 前端现在的作用

这个项目不再只是一个后端 API。

它还有一个简单前端页面，用来直接调用后端接口。

前端相关文件：

- `public/index.html`
- `public/styles.css`
- `public/app.js`

## 前端做了哪些事

- 展示页面结构
- 收集用户输入
- 发起接口请求
- 显示接口返回结果
- 列出数据库中的食物
- 搜索食物
- 更新热量
- 删除记录

## 你应该重点看哪个文件

最值得看的是：

- `public/app.js`

因为它体现了“前端如何调用后端 API”。

## 前端和后端的关系

页面打开后，前端脚本会通过 `fetch()` 请求后端接口。

例如：

```js
await fetch('/foods')
await fetch('/food', { method: 'POST', ... })
await fetch(`/food/${id}`, { method: 'PATCH', ... })
await fetch(`/food/${id}`, { method: 'DELETE' })
```

你可以这样理解：

- `index.html` 是页面骨架
- `styles.css` 是页面外观
- `app.js` 是前端行为逻辑

## app.js 的学习重点

### 1. DOM 获取

```js
const foodForm = document.getElementById('foodForm');
const searchForm = document.getElementById('searchForm');
```

这表示前端先拿到页面中的表单和按钮。

### 2. 事件监听

```js
foodForm.addEventListener('submit', async (event) => {
  ...
});
```

这表示：

- 用户一提交表单
- 就执行对应逻辑

### 3. 封装请求函数

```js
const request = async (url, options = {}) => {
  const response = await fetch(url, ...);
  ...
};
```

这是一种很好的写法。

好处是：

- 统一处理请求
- 统一处理错误
- 减少重复代码

### 4. 搜索状态

```js
const listState = {
  keyword: ''
};
```

这里保存当前搜索关键词。

这样页面刷新列表时，就能决定请求：

- `/foods`
- 还是 `/foods?keyword=...`

### 5. 渲染表格

`renderFoods(foods)` 会把接口返回的数据渲染到页面表格中。

这一步很重要，因为它把“JSON 数据”变成“用户看得见的内容”。

## 这套前端最适合你学什么

如果你是初学者，这里非常适合练：

- `fetch` 的用法
- 表单提交
- DOM 操作
- 前后端联调
- 接口状态提示

## 初学者最常见问题

### 为什么请求写成 `/foods` 而不是完整域名？

因为前端和后端是同一个服务提供的。

当前页面本身就是从 `localhost:3000` 打开的，所以相对路径就够了。

### 为什么创建成功后还要重新调用 `loadFoods()`？

因为页面上的列表要同步成最新状态。

### 为什么搜索和刷新都调用 `loadFoods()`？

因为获取列表的核心逻辑应该尽量复用。

## 建议练习

1. 给搜索框加“回车自动查询”理解事件流程
2. 给表格新增一列“更新时间”
3. 给创建表单新增“分类”字段
4. 给搜索功能新增“按热量排序”

## 自测问题

- `fetch()` 是谁发出的请求？
- 为什么页面能直接调用 `/food` 和 `/foods`？
- 为什么前端还需要自己维护一个 `listState.keyword`？

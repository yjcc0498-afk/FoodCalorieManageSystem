# models/Food.js 数据模型

## 文件职责

这个文件定义 Food 文档长什么样。

也就是说，它负责数据结构规则和字段校验。

如果把项目类比成接口分析或爬虫：

- `Model` 就像你提前定义好的字段协议
- 它规定哪些字段必须有，字段是什么类型，是否合法

## 当前代码

```js
const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Food name is required.'],
      trim: true,
      lowercase: true
    },
    calories: {
      type: Number,
      default: 0,
      min: [0, 'Calories cannot be negative.']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Food', foodSchema);
```

## 字段解释

### `name`

规则：

- 类型是 `String`
- 必填
- 自动去除首尾空格
- 自动转成小写

这意味着：

如果你传入：

```json
{
  "name": "  Chicken Breast  "
}
```

最后存入数据库时，大概率会变成：

```json
{
  "name": "chicken breast"
}
```

### `calories`

规则：

- 类型是 `Number`
- 默认值是 `0`
- 不能小于 `0`

这意味着：

- 如果你不传热量，它会默认变成 `0`
- 如果你传负数，会校验失败

### `timestamps: true`

作用：

- 自动生成 `createdAt`
- 自动生成 `updatedAt`

这对后续排序、展示、审计都很有帮助。

## 为什么模型层重要

因为模型层统一约束数据格式。

如果没有模型层，可能会出现：

- 有的记录热量是字符串
- 有的记录名称有空格
- 有的记录热量是负数
- 数据越来越乱

模型层的意义就是让数据库数据更稳定。

## Food 模型在项目中的作用

控制器不会直接“手写数据库规则”，而是调用：

```js
Food.create(...)
Food.find(...)
Food.findByIdAndUpdate(...)
Food.findByIdAndDelete(...)
```

这些操作的底层规则，都建立在这个模型上。

## 初学者常见误区

### 误区 1：模型就是数据库本身

不是。

模型只是你在 Node.js 里操作数据库的一层抽象。

### 误区 2：前端传什么，数据库就存什么

也不是。

模型会参与校验和规范化。

### 误区 3：字段校验只能写在 controller

不对。

controller 可以做业务层校验，model 也可以做数据层校验。

通常两层都可以参与，但职责不同：

- controller：更贴近请求参数和业务规则
- model：更贴近字段类型和存储规则

## 练习建议

1. 给 `Food` 增加一个 `category` 字段
2. 让 `category` 默认值为 `uncategorized`
3. 尝试给 `calories` 传字符串，看最后是否会被转成数字
4. 尝试传负数，观察报错

## 自测问题

- `trim: true` 和 `lowercase: true` 的作用是什么？
- 为什么 `calories` 要设置 `min: 0`？
- 为什么模型层和控制器层都可能做校验？

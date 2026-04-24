# Food Calorie Management System v4 数据库设计草案

> 面向当前项目主线：`User / Food / Journal / Goals / Daily Log / Saved Meals`

## 1. 设计目标

本草案基于当前仓库已有能力与后续演进方向，目标是：

- 保持现有 v3 结构可平滑升级，不推翻已有接口
- 支撑 `Saved Meals`、更完整的营养记录、后续统计能力
- 尽量减少“历史数据被源数据修改后漂移”的问题
- 保持 MongoDB 文档结构简单、易查、易扩展

---

## 2. 当前已有集合

当前项目已经实际存在：

- `users`
- `foods`
- `goalcycles`
- `dailylogs`
- `journalentries`

这些集合不建议推倒重来，而是 **保留并增强字段**。

---

## 3. 推荐的 v4 集合规划

### 核心保留

#### `users`
- 账号、鉴权、角色、基础资料

#### `foods`
- 用户自己的食物库

#### `journalentries`
- 每次摄入的明细流水

#### `dailylogs`
- 每天的体重 / 备注 / 身体状态记录

#### `goalcycles`
- 某一段周期的目标计划

### 推荐新增

#### `savedmeals`
- 保存“套餐 / 常用组合餐”
- 主要解决当前前端 `Saved Meals` 选项卡的真实数据来源问题

### 可选新增

#### `userpreferences`
- 用户偏好设置
- 如果你不想让 `users` 越来越重，可以拆出去

#### `dailysummaries`
- 日汇总缓存表
- 只有在日历统计、图表统计明显变慢时再增加

---

## 4. 各集合字段草案

## 4.1 `users`

### 当前保留字段

- `_id`
- `username`
- `email`
- `password`
- `role`
- `bio`
- `height`
- `age`
- `weight`
- `targetWeight`
- `dailyCalorieGoal`
- `avatarUrl`
- `avatarType`
- `avatarSeed`
- `lastLoginAt`
- `passwordChangedAt`
- `createdAt`
- `updatedAt`

### 建议新增字段

```ts
status: 'active' | 'disabled'
timezone?: string | null
locale?: string | null
unitSystem?: 'metric' | 'imperial'
onboardingCompleted?: boolean
deletedAt?: Date | null
schemaVersion?: number
```

### 字段说明

- `status`
  - 用户状态
  - 用于管理员禁用账号
- `timezone`
  - 解决“每日记录按哪一个时区算一天”的问题
- `locale`
  - 未来前端国际化时可直接复用
- `unitSystem`
  - 公制 / 英制偏好
- `onboardingCompleted`
  - 是否完成首次资料初始化
- `deletedAt`
  - 软删除预留
- `schemaVersion`
  - 为后续 schema 升级做兼容标记

### 索引建议

```ts
{ username: 1 } unique
{ email: 1 } unique
{ role: 1, createdAt: -1 }
{ status: 1, createdAt: -1 }
```

### 设计建议

- `users` 仍保留当前兼容字段 `weight / targetWeight / dailyCalorieGoal`
- 这些字段在 v4 中更适合作为“当前快照”
- 真正的周期目标以 `goalcycles` 为主

---

## 4.2 `foods`

### 当前字段

```ts
owner: ObjectId
name: string
calories: number
createdAt: Date
updatedAt: Date
```

### 建议升级后的字段

```ts
owner: ObjectId
name: string
brand?: string | null
category?: string | null

calories: number
protein?: number | null
carbs?: number | null
fat?: number | null
fiber?: number | null
sugar?: number | null
sodium?: number | null

servingSize?: number | null
servingUnit?: string | null
gramsPerServing?: number | null

isFavorite?: boolean
usageCount?: number
lastUsedAt?: Date | null

source?: 'manual' | 'imported' | 'template'
archivedAt?: Date | null
schemaVersion?: number

createdAt: Date
updatedAt: Date
```

### 字段说明

- `brand`
  - 食品品牌
- `category`
  - 分类，如 `protein / fruit / drink / snack`
- `protein / carbs / fat`
  - 让食物不再只是卡路里
- `fiber / sugar / sodium`
  - 为后续更完整营养分析做准备
- `servingSize / servingUnit / gramsPerServing`
  - 解决“一份是多少”的问题
- `isFavorite`
  - 常用食物收藏
- `usageCount / lastUsedAt`
  - 用于 Quick Pick、最近常用排序
- `source`
  - 手动创建 / 导入 / 模板生成
- `archivedAt`
  - 不直接删食物，允许归档

### 索引建议

```ts
{ owner: 1, name: 1 }
{ owner: 1, updatedAt: -1 }
{ owner: 1, isFavorite: 1, updatedAt: -1 }
{ owner: 1, category: 1, updatedAt: -1 }
```

### 设计建议

- `foods` 是“用户食物模板库”
- 它不应承担历史流水的绝对事实来源
- 历史事实应保存在 `journalentries` 的快照字段中

---

## 4.3 `journalentries`

### 当前字段

```ts
owner: ObjectId
date: Date
mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
foodName: string
calories: number
quantity: number
foodId?: ObjectId | null
notes?: string | null
createdAt: Date
updatedAt: Date
```

### 建议升级后的字段

```ts
owner: ObjectId
date: Date
consumedAt?: Date | null

mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
sourceType?: 'food' | 'savedMeal' | 'manual'

foodId?: ObjectId | null
savedMealId?: ObjectId | null

foodName: string
quantity: number
unit?: string | null
grams?: number | null

calories: number
protein?: number | null
carbs?: number | null
fat?: number | null

foodSnapshot?: {
  name?: string
  brand?: string | null
  servingSize?: number | null
  servingUnit?: string | null
  gramsPerServing?: number | null
}

notes?: string | null
schemaVersion?: number

createdAt: Date
updatedAt: Date
```

### 字段说明

- `consumedAt`
  - 用于记录更精确的摄入时间
- `sourceType`
  - 来自单个食物、保存套餐，还是纯手动输入
- `savedMealId`
  - 未来从 `savedmeals` 一键加入 journal 时使用
- `unit / grams`
  - 支持更自然的录入方式
- `protein / carbs / fat`
  - 让 Journal 支持宏量营养分析
- `foodSnapshot`
  - 历史快照，避免 food 模板被修改后影响历史记录

### 索引建议

```ts
{ owner: 1, date: 1 }
{ owner: 1, date: 1, mealType: 1 }
{ owner: 1, createdAt: -1 }
{ owner: 1, savedMealId: 1 }
```

### 设计建议

- `journalentries` 是最重要的业务流水表
- 建议保留 `foodId` 引用，但同时写入快照
- 这样兼顾：
  - 后续还能跳转原 food
  - 历史数据又不会漂移

---

## 4.4 `dailylogs`

### 当前字段

```ts
owner: ObjectId
date: Date
weight?: number | null
notes?: string | null
createdAt: Date
updatedAt: Date
```

### 建议升级后的字段

```ts
owner: ObjectId
date: Date

weight?: number | null
bodyFatRate?: number | null
waist?: number | null
steps?: number | null
sleepHours?: number | null
waterIntakeMl?: number | null
mood?: string | null

notes?: string | null
schemaVersion?: number

createdAt: Date
updatedAt: Date
```

### 字段说明

- `bodyFatRate / waist`
  - 如果你以后要做更认真一点的身体追踪，这两个值比单纯体重更有意义
- `steps / sleepHours / waterIntakeMl`
  - 适合健康习惯追踪
- `mood`
  - 可做很轻量的主观状态记录

### 索引建议

```ts
{ owner: 1, date: 1 } unique
```

### 设计建议

- 当前项目先保留轻量即可
- 如果你当前重点只是减脂 / 饮食，不必一次把所有健康字段都上全

---

## 4.5 `goalcycles`

### 当前字段

```ts
owner: ObjectId
startDate: Date
endDate: Date
startWeight: number
targetWeight: number
dailyCalorieGoal: number
status: 'active' | 'completed' | 'archived'
createdAt: Date
updatedAt: Date
```

### 建议升级后的字段

```ts
owner: ObjectId

title?: string | null
note?: string | null

startDate: Date
endDate: Date

startWeight: number
targetWeight: number
dailyCalorieGoal: number

targetType?: 'lose' | 'maintain' | 'gain'
weeklyTargetRate?: number | null
source?: 'manual' | 'calculated'

status: 'active' | 'completed' | 'archived'
schemaVersion?: number

createdAt: Date
updatedAt: Date
```

### 字段说明

- `title`
  - 例如：`May Cut Plan`
- `note`
  - 周期说明
- `targetType`
  - 减重 / 维持 / 增重
- `weeklyTargetRate`
  - 每周目标变化速度
- `source`
  - 手动设定还是系统计算

### 索引建议

保留当前已有：

```ts
{ owner: 1, status: 1 } // active 唯一的 partial unique index
```

可补充：

```ts
{ owner: 1, startDate: -1 }
{ owner: 1, endDate: -1 }
```

### 设计建议

- 当前 `goalcycles` 设计整体合理，不建议大改
- 它应该继续作为“目标计划”的核心表

---

## 4.6 `savedmeals`（推荐新增）

### 目标

用于支持：

- 前端 `Saved Meals`
- 一键把常用套餐加入 `Journal`
- 复用常见早餐 / 午餐 / 晚餐模板

### 建议字段

```ts
owner: ObjectId
name: string
description?: string | null
mealTypeDefault?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null

items: Array<{
  foodId?: ObjectId | null
  foodName: string
  quantity: number
  unit?: string | null
  grams?: number | null

  calories: number
  protein?: number | null
  carbs?: number | null
  fat?: number | null

  foodSnapshot?: {
    name?: string
    brand?: string | null
    servingSize?: number | null
    servingUnit?: string | null
    gramsPerServing?: number | null
  }
}>

totalCalories: number
totalProtein?: number | null
totalCarbs?: number | null
totalFat?: number | null

tags?: string[]
lastUsedAt?: Date | null
usageCount?: number
isArchived?: boolean
schemaVersion?: number

createdAt: Date
updatedAt: Date
```

### 字段说明

- `items`
  - 建议直接嵌入到 meal 文档里
  - 因为保存套餐时通常总是一起读写
- `totalCalories / totalProtein / totalCarbs / totalFat`
  - 保存聚合值，减少每次都临时计算
- `lastUsedAt / usageCount`
  - 用于快速推荐最近常用 meal

### 索引建议

```ts
{ owner: 1, updatedAt: -1 }
{ owner: 1, lastUsedAt: -1 }
{ owner: 1, isArchived: 1, updatedAt: -1 }
{ owner: 1, name: 1 }
```

### 设计建议

- `savedmeals` 不要拆成 `savedmealitems` 子表
- MongoDB 下这种“总是一起读写”的结构更适合嵌入

---

## 4.7 `userpreferences`（可选）

如果你后面觉得 `users` 字段太多，可以拆这个集合。

### 建议字段

```ts
owner: ObjectId
timezone?: string | null
locale?: string | null
unitSystem?: 'metric' | 'imperial'
energyUnit?: 'kcal' | 'kj'
weekStartsOn?: 0 | 1 | 6
defaultMealView?: 'journal' | 'foods' | 'goals'
schemaVersion?: number
createdAt: Date
updatedAt: Date
```

### 索引建议

```ts
{ owner: 1 } unique
```

### 设计建议

- 如果当前项目规模不大，可以先不拆
- 小项目也可以直接把这些偏好字段留在 `users`

---

## 4.8 `dailysummaries`（后期可选）

### 使用场景

只有在下面场景明显变慢时才建议新增：

- 月历视图
- 日统计图表
- 管理员聚合统计
- 用户长期趋势分析

### 建议字段

```ts
owner: ObjectId
date: Date

goalCycleId?: ObjectId | null
dailyLogId?: ObjectId | null

journalCount: number
totalCalories: number
totalProtein?: number | null
totalCarbs?: number | null
totalFat?: number | null

targetCalories?: number | null
remainingCalories?: number | null
hasDailyLog: boolean

schemaVersion?: number
createdAt: Date
updatedAt: Date
```

### 索引建议

```ts
{ owner: 1, date: 1 } unique
```

### 设计建议

- 这是典型“计算缓存表”
- 一开始不要急着建
- 先用聚合查询，性能不够再引入

---

## 5. 推荐的最小升级方案

如果现在只做一轮最实用、最省风险的升级，我建议：

### 必做

1. 给 `foods` 增加营养字段和 serving 字段
2. 给 `journalentries` 增加营养快照字段
3. 新增 `savedmeals`

### 暂缓

1. `userpreferences`
2. `dailysummaries`
3. 更复杂的健康追踪字段

---

## 6. 数据迁移建议

## 6.1 `foods`

旧数据可默认补：

```ts
protein = null
carbs = null
fat = null
fiber = null
sugar = null
sodium = null
brand = null
category = null
servingSize = null
servingUnit = null
gramsPerServing = null
isFavorite = false
usageCount = 0
lastUsedAt = null
source = 'manual'
archivedAt = null
schemaVersion = 2
```

## 6.2 `journalentries`

旧数据可默认补：

```ts
consumedAt = null
sourceType = foodId ? 'food' : 'manual'
savedMealId = null
unit = null
grams = null
protein = null
carbs = null
fat = null
foodSnapshot = {
  name: foodName
}
schemaVersion = 2
```

## 6.3 `users`

旧数据可默认补：

```ts
status = 'active'
timezone = null
locale = null
unitSystem = 'metric'
onboardingCompleted = true
deletedAt = null
schemaVersion = 2
```

---

## 7. 建模原则说明

### 嵌入优先

适合嵌入的：

- `savedmeals.items`
- `journalentries.foodSnapshot`

原因：

- 总是跟主文档一起读写
- 数据规模通常不会无限增长
- 能减少复杂 join / populate 依赖

### 引用保留

适合引用的：

- `foodId`
- `savedMealId`
- `goalCycleId`
- `owner`

原因：

- 这些是跨集合的核心关联
- 后续查询与管理仍需要保留关系

### 快照保留

建议对历史流水保留快照字段，避免：

- Food 改名后历史记录跟着变
- 热量、营养信息变更导致旧统计漂移

---

## 8. 推荐最终拍板方案

### 近期版本建议

```text
users
foods
journalentries
dailylogs
goalcycles
savedmeals
```

### 中期可选

```text
userpreferences
dailysummaries
```

### 当前不建议马上加

```text
recipes
mealplans
notifications
auditlogs
foodfavorites
```

这些表不是不能做，而是对你当前项目主线不是第一优先级。

---

## 9. 开发顺序建议

### 第 1 阶段

- 新增 `SavedMeal` model
- 增加 `saved meal` 的 CRUD
- 前端 `Saved Meals` 接真实数据

### 第 2 阶段

- 升级 `Food` 字段
- 升级 `JournalEntry` 字段
- 前端 Journal 支持更多营养信息

### 第 3 阶段

- 增加按日 / 周 / 月统计
- 评估是否需要 `dailysummaries`

---

## 10. 一句话结论

这套系统下一步最值得做的是：

- **保留现有五张核心表**
- **新增 `savedmeals`**
- **把 `foods` 和 `journalentries` 从“只有热量”升级到“营养 + 快照”**

这样最符合你当前项目的功能演进，也最容易平滑接到现有前后端结构里。

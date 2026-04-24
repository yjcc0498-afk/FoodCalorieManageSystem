# Food Calorie Management System v3 规划草案

更新日期：2026-04-23  
文档目的：基于你当前项目的用户界面与管理员界面，参考同类热量追踪 / 营养记录 / 管理后台项目的常见做法，整理一份更适合下一阶段扩展的 `v3` 方向草案。

## 1. 先说结论

你现在的项目已经不只是“后端练习接口”，它其实已经具备了一个小型产品的雏形：

- 有登录注册
- 有普通用户工作台
- 有管理员工作台
- 有数据隔离
- 有权限控制

但目前页面内容仍然主要围绕“食物 CRUD + 用户 CRUD”，所以会显得偏单一。  
参考同类项目后，我的判断是：

`v3` 不应该只继续加几个零散按钮，而是要把产品升级成“有导航结构的双工作台系统”：

- 用户端从“食物列表页”升级为“个人营养记录工作台”
- 管理端从“用户表格页”升级为“系统运营与审核后台”

也就是说，重点要从“单页操作”转向“多模块导航 + 数据视图 + 个人设置 + 进度反馈”。

---

## 2. 你当前项目的现状诊断

结合当前仓库里的 `public/index.html`、`public/app.ts`、`public/styles.css`，你目前前端已经具备这些基础：

- 登录 / 注册切换
- 用户端食物搜索、创建、更新、删除
- 用户端基础概览卡片
- 管理员端用户列表、筛选、详情、修改、删除
- 前端已具备单页路由思路：`/login`、`/app`、`/admin`

当前最大的限制不是“页面太丑”，而是“信息架构太薄”：

- 用户端只有一个主要任务：管理 food 记录
- 管理端只有一个主要任务：管理 users
- 还没有“设置中心 / 个人中心 / 安全中心 / 统计分析 / 历史记录”
- 列表还没有真正的分页、排序、批量操作、筛选面板
- 还没有把“食物定义”和“每日摄入日志”拆开

这也是为什么你会感觉“太单一”。

---

## 3. 网上类似项目都在怎么做

我把参考项目分成两类看：  
第一类是“热量/营养追踪类应用”，第二类是“后台管理 / 表格 / 导航类方案”。

### 3.1 热量 / 营养追踪类项目的共性

#### A. `kcal`

这个项目不是只做食物增删改查，而是把能力拆成多个内容域：

- foods
- meals
- recipes
- journal
- goals
- profile

这类拆法很值得借鉴，因为它把“食物库”和“吃了什么”分开了。  
你的项目现在更像“Food master data 管理”，但真正像产品的热量系统，通常还会有：

- 今日摄入日志
- 按餐次记录
- 目标值
- 历史统计
- 收藏模板

#### B. `OpenNutriTracker`

这类项目常见的不是单一列表，而是：

- food diary
- 自定义 meal
- 营养目标
- 图表或日历视图
- 更强的个人化配置

它提醒我们一件事：  
用户真正关心的通常不是“我数据库里有几个 food”，而是“我今天吃了多少、还差多少、这周趋势怎样”。

#### C. `Food You`

这类项目的特点是首页不是简单表格，而是“模块化入口”：

- 今日概览
- 快速添加
- 收藏食物 / 自定义食物
- 食谱或餐次
- 数据库搜索
- 每日目标追踪

这类结构非常适合你的用户端 `v3`。

#### D. `Calorific`

这类项目通常会加入：

- 按早餐 / 午餐 / 晚餐 / 加餐分组
- 搜索和过滤
- 当日总热量 / 目标热量对比
- 常用食物、保存组合餐
- 更方便的“重复录入”

这说明用户端如果只支持逐条新增 food，会越来越像“数据库录入系统”，而不是“记录体验好的产品”。

#### E. `wger`

这类健身/营养类系统很常见的扩展是：

- 历史记录
- 体重变化
- 进度照片
- 目标管理
- 时间维度查看

这给你的启发是：  
如果未来要让系统更像真实项目，“进度”一定比“单次 CRUD”更有产品感。

### 3.2 后台管理类项目的共性

#### A. 左侧导航栏是后台的默认结构

像 AdminLTE、CoreUI 这类后台方案，几乎都不是“一个页面堆所有功能”，而是：

- 左侧 sidebar 做一级导航
- 顶部 bar 放全局搜索、用户菜单、通知
- 中间内容区按模块切换

这很适合你现在的项目，因为你已经天然分成了：

- 用户端模块
- 管理端模块
- 个人设置模块
- 安全模块

#### B. 列表页一般不是只做搜索，而是做“数据表”

比较成熟的后台列表通常会包含：

- 分页
- 排序
- 关键字搜索
- 状态筛选
- 每页数量切换
- 详情面板 / 右侧详情卡
- 批量操作

你当前管理员页已经有“列表 + 详情”的雏形了，再往前一步就是标准后台工作台。

#### C. 用户设置通常会独立成 Profile / Security 两页

像 GitHub 这类成熟产品，都会把这些能力拆开：

- 个人资料
- 头像上传
- 密码修改
- 安全设置

这说明你提到的“修改密码、上传头像、默认头像”是非常合理且常见的下一步，不是额外点缀，而是用户工作台的标准组成部分。

---

## 4. 我建议你的 v3 目标长什么样

## 4.1 用户端：从“食物 CRUD 页”升级为“个人营养工作台”

建议把用户端改成左侧导航结构。

### 用户端导航建议

1. `Dashboard`
2. `Food Journal`
3. `My Foods`
4. `Saved Meals`
5. `Goals & Progress`
6. `Profile`
7. `Security`

### 每个导航项建议放什么

#### 1. `Dashboard`

用于展示“登录后第一屏”的信息，不直接堆表格。

建议内容：

- 今日总摄入 kcal
- 今日目标 kcal
- 剩余 kcal
- 最近 7 天趋势
- 今日餐次概览
- 快速添加入口
- 最近新增 food

这样用户一登录就能看到“当前状态”，不是立刻进入录入表单。

#### 2. `Food Journal`

这是最值得新增的模块。  
它和现在的 `My Foods` 不一样。

`Food Journal` 记录的是“我今天吃了什么”，建议支持：

- 日期切换
- 早餐 / 午餐 / 晚餐 / 加餐分组
- 每条摄入记录可关联一个 food
- 支持份量 / 数量
- 自动汇总当天总热量

这样你的系统就不再只是“维护食物表”，而是“记录实际摄入”。

#### 3. `My Foods`

这个模块保留你现在的 food CRUD，但升级为真正的数据表页：

- 分页
- 排序
- 搜索
- 按热量范围筛选
- 按创建时间筛选
- 批量删除
- 收藏 / 常用标记

这里很适合做成标准 Data Table。

#### 4. `Saved Meals`

这个功能很适合真实使用场景。

例如用户经常吃固定搭配：

- 鸡胸肉 + 米饭 + 西兰花
- 牛奶 + 面包 + 鸡蛋

可以把一组 food 保存为一个 meal template，后续一键加入日志。  
这能明显提升“重复记录”效率。

#### 5. `Goals & Progress`

建议新增：

- 每日热量目标
- 当前体重
- 目标体重
- 每周体重记录
- 热量趋势图

未来如果你想继续扩展，还可以加：

- 蛋白质 / 碳水 / 脂肪目标
- BMI / 进度分析

#### 6. `Profile`

这里正好可以放你提到的用户资料能力：

- 用户名
- 邮箱
- 默认头像
- 上传头像
- 个人简介（可选）
- 性别 / 身高 / 体重 / 年龄（可选，后续用于更完整目标计算）

建议一开始支持“默认头像 + 上传头像 + 删除恢复默认头像”。

#### 7. `Security`

这里建议单独放安全相关，而不是塞进 profile：

- 修改密码
- 最近登录时间
- 当前角色
- Token 失效提示
- 未来可扩展：登录设备 / 登录日志

如果后端暂时不做邮件找回密码，也完全可以先只做：

- 输入旧密码
- 输入新密码
- 确认新密码

---

## 4.2 管理端：从“用户列表页”升级为“系统管理后台”

建议管理员端也用左侧导航，而不是只有一个用户表。

### 管理端导航建议

1. `Overview`
2. `Users`
3. `Foods`
4. `Security`
5. `System`

### 每个导航项建议放什么

#### 1. `Overview`

管理员首页不要直接进入用户列表，可以先看系统概览：

- 总用户数
- 管理员数 / 普通用户数
- 总 food 数
- 最近 7 天注册人数
- 最近 7 天 food 新增数
- 登录失败次数统计
- 最近操作概览

这样管理员页更像“运营后台”。

#### 2. `Users`

在你当前基础上升级：

- 分页
- 搜索用户名 / 邮箱
- 按角色筛选
- 按创建时间排序
- 用户详情侧栏 / 抽屉
- 重置密码
- 启用 / 禁用状态（后续可选）
- 头像显示

这里也可以保留“管理员不能删除自己”的规则。

#### 3. `Foods`

管理员除了管理 users，也可以有 food 维度的内容治理：

- 查看所有用户的 food
- 按 owner 查询
- 搜索重复 food
- 查看热量异常值
- 删除明显错误数据
- 统计最常录入的 food

这会让管理员不只是在“管账号”，而是在“管系统数据质量”。

#### 4. `Security`

可以做一个基础安全运营页：

- 登录失败统计
- 限流触发次数
- 最近被拒绝的请求
- 管理员操作记录

如果暂时不做完整审计日志，也可以先做简化版的：

- 用户删除记录
- 用户角色修改记录
- 密码重置记录

#### 5. `System`

这一页放系统层面信息：

- 当前环境摘要
- JWT 过期时间展示
- 登录限流配置展示
- MongoDB 连接状态
- 管理员初始化账号说明

注意这里只展示“配置摘要”，不要把敏感值明文展示出来。

---

## 5. 最值得优先加的功能清单

如果你不想一下子做太大，我建议按下面优先级走。

### 第一优先级：最划算，改完马上不单一

1. 左侧导航栏
2. 用户端 `Profile`
3. 用户端 `Security`
4. 用户端 / 管理端分页表格
5. 管理端 `Overview`
6. 用户端 `Dashboard`

这 6 个加上之后，界面层次会立刻提升很多。

### 第二优先级：让产品真正像“热量管理系统”

1. `Food Journal`
2. `Saved Meals`
3. `Goals & Progress`
4. 体重 / 趋势图
5. 日期维度查看

这一层会把项目从“管理系统练习”推向“真实场景产品”。

### 第三优先级：体验和运营增强

1. 头像上传
2. 默认头像生成
3. 批量操作
4. CSV 导出
5. 审计日志
6. 软删除 / 回收站

---

## 6. 数据层与接口层可以怎样扩展

为了不把功能继续挤在现有 `Food` 上，建议在 `v3` 引入“数据分层”的思路。

## 6.1 现有 `Food` 最适合保留为“食物主数据”

当前 `Food` 更像用户自己的 food library，可以继续保留：

- `name`
- `calories`
- `owner`

后续可以补充：

- `category`
- `isFavorite`
- `unit`
- `notes`
- `imageUrl`

## 6.2 新增 `FoodLog` 或 `JournalEntry`

这是 `v3` 最关键的新模型之一。  
建议把“食物定义”和“摄入记录”拆开。

建议字段：

- `owner`
- `food`
- `mealType`：`breakfast | lunch | dinner | snack`
- `quantity`
- `consumedAt`
- `caloriesSnapshot`
- `notes`

这样做的好处：

- 修改 `Food` 基础信息时，不会影响历史日志
- 可以按日期做统计
- 可以做趋势图和日报
- 可以支持一键复制昨天饮食

## 6.3 扩展 `User`

建议给 `User` 加一组轻量个人资料字段：

- `avatarUrl`
- `avatarType`：`default | uploaded`
- `avatarSeed`
- `bio`
- `height`
- `weight`
- `targetWeight`
- `dailyCalorieGoal`
- `lastLoginAt`

其中最值得先加的是：

- `avatarUrl`
- `avatarType`
- `avatarSeed`
- `dailyCalorieGoal`
- `lastLoginAt`

## 6.4 可选新增 `AuditLog`

如果管理员页要更完整，建议新增：

- `actor`
- `action`
- `targetType`
- `targetId`
- `detail`
- `createdAt`

适合记录：

- 管理员删除用户
- 管理员修改角色
- 管理员重置密码

---

## 7. API 扩展建议

下面这些接口很适合 `v3`。

### 7.1 分页与筛选

当前 food / users 列表建议统一支持：

```text
GET /foods?page=1&limit=10&keyword=chicken&sortBy=createdAt&order=desc
GET /users?page=1&limit=10&role=user&keyword=alice&sortBy=createdAt&order=desc
```

响应建议统一成：

```json
{
  "message": "ok",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 57,
    "totalPages": 6
  }
}
```

### 7.2 用户资料

```text
GET /profile
PATCH /profile
PATCH /profile/avatar
DELETE /profile/avatar
PATCH /profile/password
```

建议职责划分：

- `GET /profile` 返回安全用户资料
- `PATCH /profile` 修改用户名、邮箱、简介、目标值等
- `PATCH /profile/password` 单独修改密码
- `PATCH /profile/avatar` 单独处理头像

### 7.3 日志与目标

```text
GET /journal?date=2026-04-23
POST /journal
PATCH /journal/:id
DELETE /journal/:id

GET /goals
PATCH /goals
GET /progress?range=7d
POST /weight-logs
GET /weight-logs
```

### 7.4 管理端扩展

```text
GET /admin/overview
GET /admin/foods?page=1&limit=20&keyword=rice
GET /admin/security
GET /admin/audit-logs
```

如果你暂时不想额外再开 `/admin/*`，也可以继续复用现有 `/users` 风格，但从可维护性上看，独立成管理员资源域会更清晰。

---

## 8. 页面结构建议

下面是一个更适合你项目的页面组织方式。

## 8.1 用户端

```text
/login
/app/dashboard
/app/journal
/app/foods
/app/meals
/app/goals
/app/profile
/app/security
```

## 8.2 管理端

```text
/admin/overview
/admin/users
/admin/foods
/admin/security
/admin/system
```

## 8.3 布局建议

```text
+-------------------------------------------------------------+
| Sidebar | Topbar                                            |
|         |---------------------------------------------------|
| Nav     | Breadcrumb / Search / User Menu                   |
|         |---------------------------------------------------|
| Links   | Cards / Charts / Tables / Detail Panel            |
|         |                                                   |
|         |                                                   |
+-------------------------------------------------------------+
```

这比现在“顶部栏 + 单屏内容”更适合继续扩展。

---

## 9. 头像与密码功能怎么设计更合理

你特别提到了这部分，我单独给一个建议。

## 9.1 默认头像

建议不要一开始就强依赖真实图片上传，先做两层：

### 第一层

- 新用户自动获得默认头像
- 默认头像可基于 `username` 生成颜色或字母头像
- 后端只需保存 `avatarType=default` 和 `avatarSeed`

### 第二层

- 支持上传头像文件
- 用户可以恢复默认头像

这样好处是：

- 没有上传也不会显得页面空
- UI 马上更完整
- 技术复杂度可分阶段推进

## 9.2 修改密码

建议不要让“修改资料”和“修改密码”混在一个接口里。

更合理的方式：

- `PATCH /profile` 只改公开资料
- `PATCH /profile/password` 只改密码

密码修改建议校验：

- 旧密码必须正确
- 新密码长度至少 6 位
- 新旧密码不能相同
- 修改成功后提醒重新登录

如果你愿意做得更完整，还可以：

- 修改密码后让旧 token 失效
- 记录 `lastPasswordChangedAt`

---

## 10. 推荐的 v3 分阶段实施方案

## Phase 1：界面升级，不大改业务模型

目标：先让项目看起来像一个完整系统。

建议做：

- 左侧导航栏
- 用户端 dashboard
- 用户端 profile
- 用户端 security
- 管理端 overview
- food / users 分页、排序、筛选
- 用户头像默认态

这一阶段对现有架构冲击最小，收益最大。

## Phase 2：引入真实“记录”能力

目标：让系统从 food CRUD 升级为饮食记录系统。

建议做：

- `FoodLog` / `JournalEntry`
- 餐次分组
- 日期切换
- 每日目标
- 趋势统计
- 保存常用 meal

## Phase 3：强化管理员运营能力

目标：让后台不只是 CRUD 页面。

建议做：

- admin food review
- 审计日志
- 安全统计
- 异常数据治理
- 导出报表

---

## 11. 最适合你当前项目的“精简版 v3”

如果你只想先做一个“明显升级但可控”的版本，我最推荐下面这个组合：

### 用户端

- 左侧导航
- Dashboard
- My Foods 分页表格
- Profile
- Security
- 默认头像

### 管理端

- 左侧导航
- Overview
- Users 分页表格
- Foods 全局查看
- Security 简报

### 后端

- food / users 分页查询
- profile 修改
- password 修改
- avatar 字段
- admin overview 接口

这套组合已经足够让项目从“练习版”升级到“v3 预览版”。

---

## 12. 我给你的最终建议

不要继续只在当前 food CRUD 页面上加零散功能。  
更好的方向是：

1. 先把界面升级成“带侧边导航的双后台”
2. 再补“用户资料 / 安全中心 / 管理概览 / 分页表格”
3. 再把“Food”扩展为“Food + Journal + Goals + Progress”

一句话总结：

你这个项目下一步最该做的，不是“再多一个 CRUD”，而是“让系统形成完整的信息架构”。

---

## 13. 参考来源

以下内容基于 2026-04-23 的在线检索整理，重点参考的是这些项目 / 文档的公开说明页：

1. `kcal`
   https://github.com/kcal-app/kcal

2. `OpenNutriTracker`
   https://github.com/simonoppowa/OpenNutriTracker

3. `Food You`
   https://github.com/maksimowiczm/FoodYou

4. `Calorific`
   https://github.com/xdpirate/calorific

5. `wger features`
   https://wger.de/he/software/features

6. `AdminLTE Layout Docs`
   https://adminlte.io/docs/3.1/layout.html

7. `CoreUI`
   https://coreui.io/

8. `MUI Data Grid - Server-side pagination`
   https://mui.com/x/react-data-grid/pagination/

9. `GitHub Docs - Changing your profile picture`
   https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-user-account-settings/changing-your-profile-picture

10. `GitHub Docs - Updating your password`
    https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/updating-your-github-access-credentials

---

如果你认同这份方向，下一步我可以继续帮你出一版：

- `v3` 页面信息架构图
- 数据库字段增量设计
- API 清单
- 前端页面模块拆分建议
- 或者直接开始改你的用户端 / 管理端 UI

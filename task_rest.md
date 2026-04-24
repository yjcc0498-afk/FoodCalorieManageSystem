# Goals + Journal 推进看板

更新时间：2026-04-24

## 当前总体进度
- 已完成：后端 `GoalCycle / DailyLog / JournalEntry` 模型、控制器、路由与 `server.ts` 挂载。
- 已完成：管理员删除用户时，新增域数据会一起级联清理。
- 已完成：`public/user.html` 与 `public/styles.css` 的 Goals + Journal 页面骨架与样式钩子。
- 已完成：`tests/auth-food-admin.test.ts` 与 `README.md` 的新增覆盖和文档更新。
- 进行中：`public/app.ts` 的前端状态管理与 API 接线。
- 待验证：完整 `npm.cmd run build` 与 `npm.cmd test` 回归。

## 已落地内容

### 1. 后端主线
- 新增 `models/GoalCycle.ts`
- 新增 `models/DailyLog.ts`
- 新增 `models/JournalEntry.ts`
- 新增 `controllers/goalsController.ts`
- 新增 `controllers/dailyLogController.ts`
- 新增 `controllers/journalController.ts`
- 新增 `routes/goalsRoutes.ts`
- 新增 `routes/dailyLogRoutes.ts`
- 新增 `routes/journalRoutes.ts`
- 更新 `server.ts`
- 更新 `controllers/userController.ts`
- 新增 `utils/date.ts`

### 2. 页面骨架
- `public/user.html` 已替换 Journal/Goals 占位区，加入真实 DOM hooks：
  - 日历月份切换
  - 选中日期摘要
  - Goal cycle 表单
  - Daily log 表单
  - Journal 列表
  - Journal 新增/编辑表单
  - Food quick-pick 区
  - Saved Meals 继续保留占位

### 3. 测试与文档
- `tests/auth-food-admin.test.ts` 已新增：
  - Goal cycle 创建与单激活周期行为
  - Daily log 同日 upsert
  - Journal owner 隔离
  - `/goals/day` 聚合热量摘要
- `README.md` 已补充 Goals + Journal API 与 `.env` 说明

## Agent 分工状态

### 我（主控）
- 负责整体进度推进、任务分派、结果合并、最终验收。
- 当前主任务：整合 `public/app.ts`、合并其他 Agent 产出、跑最终验证。

### Agent `Bernoulli`
- 状态：已完成
- 负责文件：
  - `public/user.html`
  - `public/styles.css`
- 交付结果：Goals + Journal UI 结构与样式钩子已完成。

### Agent `Harvey`
- 状态：已完成
- 负责文件：
  - `tests/auth-food-admin.test.ts`
  - `README.md`
- 交付结果：测试覆盖与文档更新已完成，并反馈 `npm.cmd test` 在其分支通过。

### Agent `Poincare`
- 状态：进行中
- 负责文件：
  - `public/app.ts`
- 目标：
  - 接入 `/goals/day`
  - 接入 `/daily-log`
  - 接入 `/journal`
  - 实现 Goals/Journal 日期联动
  - 保持 Foods/Profile/Security 现有流程不退化

## 剩余任务

### 高优先级
- 完成 `public/app.ts` 的 Goals + Journal 前端控制器重写
- 合并 `Bernoulli` 的 `public/user.html` / `public/styles.css` 改动
- 合并 `Harvey` 的测试与 README 改动

### 中优先级
- 校验 `public/app.ts` 与新 DOM ids 是否一致
- 检查 `GET /goals/day` 返回结构与前端类型映射是否一致
- 检查兼容字段 `User.weight / targetWeight / dailyCalorieGoal` 的前端回退逻辑

### 验证阶段
- 运行 `npm.cmd run build`
- 运行 `npm.cmd test`
- 修复构建或类型回归（仅限本轮改动相关）

## 风险点
- `public/app.ts` 体量大，合并时最容易引入类型或 DOM id 不匹配问题。
- `public/user.html` 目前存在部分历史中文乱码，后续若继续清理需单独控 scope。
- 日历状态与 Journal 编辑态联动较多，需重点验证：
  - 切日期
  - 编辑 entry
  - 删除 entry
  - Daily log 保存后摘要刷新

## 下一步执行顺序
1. 等待并审阅 `Poincare` 的 `public/app.ts` 结果
2. 合并三个 Agent 的产出
3. 本地执行构建与测试
4. 若有回归，主控统一修正
5. 向用户汇报最终结果与可继续扩展项

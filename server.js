/**
 * =========================================================
 *  Server Entry File (Application Bootstrap)
 * =========================================================
 *  职责：
 *  1. 加载环境变量
 *  2. 初始化 Express 应用
 *  3. 注册全局中间件
 *  4. 挂载路由模块
 *  5. 初始化数据库连接
 *  6. 初始化系统基础数据（Admin 用户）
 *  7. 启动 HTTP Server
 * =========================================================
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const connectDB = require('./config/db');
// 系统初始化：确保管理员账号存在
const { ensureAdminUser } = require('./config/bootstrapAdmin');
// 运行时配置校验（防止 .env 缺失关键字段）
const { validateRuntimeConfig } = require('./config/runtime');
const authRoutes = require('./routes/authRoutes');
const foodRoutes = require('./routes/foodRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

//通用挂载器（最重要） 接所有 HTTP 方法（GET/POST/PATCH/DELETE） 挂载中间件  挂载路由模块
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 首页路由（返回静态 HTML 页面） 只处理 GET/ 请求，其他 API 路由在后面挂载
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Keep server wiring thin: mount each route module here, while request logic stays in middleware/controllers.
// Auth & Food 模块挂载在根路径
app.use('/', authRoutes);
app.use('/', foodRoutes);
// User 模块挂载在 /users 命名空间（管理员系统）
app.use('/users', userRoutes);
// 路由只负责“分发请求”，真正业务在 controllers 中

const startServer = async () => {
  try {
    // 检查 .env 是否完整（PORT / DB / JWT 等）
    validateRuntimeConfig();
    await connectDB();
    // 确保管理员用户存在（系统初始化行为）
    await ensureAdminUser();

    return await new Promise((resolve, reject) => {
      const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}.`);
        resolve(server);
      });

      server.on('error', reject);
    });
  } catch (error) {
    if (require.main === module) {
      console.error('Failed to start server:', error.message);
      process.exit(1);
    }

    throw error;
  }
};

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer
};

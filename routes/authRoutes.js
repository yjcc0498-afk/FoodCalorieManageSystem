// ===============================
// Auth Routes（认证相关路由）
// ===============================
// 职责：
// 1. 用户注册
// 2. 用户登录（带限流保护）
// 3. 获取当前登录用户信息（需要 JWT 验证）
//
// 注意：
// - 该模块是“公开 + 半保护接口”
// - register/login 不需要登录
// - /me 需要登录态
// ===============================


const express = require('express');
const {
  register,
  login,
  getCurrentUser
} = require('../controllers/authController');
// JWT 鉴权中间件（解析 token -> req.user）
const authMiddleware = require('../middleware/authMiddleware');
// 登录限流中间件（防暴力破解）
const { loginRateLimitMiddleware } = require('../middleware/loginRateLimitMiddleware');

const router = express.Router();


//定义不同接口的路由，并将它们连接到对应的控制器函数和中间件。
router.post('/auth/register', register);
router.post('/auth/login', loginRateLimitMiddleware, login);
router.get('/auth/me', authMiddleware, getCurrentUser);

module.exports = router;

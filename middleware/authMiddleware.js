//认证中间件，验证你是不是已登录用户

//request
//   ↓
// 取 token
//   ↓
// 验证 token
//   ↓
// 解析 userId
//   ↓
// 查数据库
//   ↓
// 挂 req.user
//   ↓
// next()

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { getJwtConfig } = require('../config/runtime');

//从请求头取 token
const getTokenFromHeader = (authorizationHeader) => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};
//从 token 里拿 userId
const getUserIdFromPayload = (payload) => {
  //因为不同系统 token 格式不同,兼容性设计
  return payload.id || payload.userId || payload._id || payload.sub || null;
};
//获取 User 模型
const getUserModel = () => {
  //避免重复注册模型(mongoose 常见坑)
  if (mongoose.models.User) {
    return mongoose.models.User;
  }

  const userModelPath = path.join(__dirname, '..', 'models', 'User.js');

  if (!fs.existsSync(userModelPath)) {
    return null;
  }

  return require(userModelPath);
};  

//认证流程
const authMiddleware = async (req, res, next) => {
  try {
    //解析token(从请求头拿)
    const token = getTokenFromHeader(req.headers.authorization);

    //没有token直接拒绝访问
    if (!token) {
      return res.status(401).json({
        message: 'Authorization token is required. Use Bearer <token>.'
      });
    }

    const { secret } = getJwtConfig();
    //验证 token
    const decoded = jwt.verify(token, secret);
    //解码 payload,解码 payload
    const userId = getUserIdFromPayload(decoded);

    if (!userId) {
      return res.status(401).json({
        message: 'Invalid token payload. User identifier is missing.'
      });
    }

    const User = getUserModel();

    if (!User) {
      return res.status(500).json({
        message: 'User model is not available for authentication.'
      });
    }

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(401).json({
        message: 'User associated with this token was not found.'
      });
    }


    //挂载req.user
    req.user = user;
    req.token = token;

    //放行
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token has expired. Please log in again.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid token.'
      });
    }

    return res.status(500).json({
      message: 'Authentication failed.',
      error: error.message
    });
  }
};

module.exports = authMiddleware;

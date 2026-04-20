const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { getJwtConfig } = require('../config/runtime');

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

const getUserIdFromPayload = (payload) => {
  return payload.id || payload.userId || payload._id || payload.sub || null;
};

const getUserModel = () => {
  if (mongoose.models.User) {
    return mongoose.models.User;
  }

  const userModelPath = path.join(__dirname, '..', 'models', 'User.js');

  if (!fs.existsSync(userModelPath)) {
    return null;
  }

  return require(userModelPath);
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        message: 'Authorization token is required. Use Bearer <token>.'
      });
    }

    const { secret } = getJwtConfig();
    const decoded = jwt.verify(token, secret);
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

    req.user = user;
    req.token = token;

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

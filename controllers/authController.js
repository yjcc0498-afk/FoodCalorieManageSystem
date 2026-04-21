const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtConfig } = require('../config/runtime');
const {
  clearLoginRateLimit,
  recordFailedLoginAttempt
} = require('../middleware/loginRateLimitMiddleware');

//工具函数

//1️⃣ normalize：统一输入格式
const getNormalizedValue = (value) => String(value || '').trim().toLowerCase();

// 2️⃣ 提取错误信息
// 把 MongoDB/Mongoose 的复杂错误变成一句话
const getValidationMessage = (error) => { 
  const messages = Object.values(error.errors || {}).map((item) => item.message);
  return messages[0] || 'Validation failed.';
};

// 3️⃣ 创建 JWT Token
// 作用：
// 👉 给用户签发登录凭证（token）

const createToken = (user) => {
  const { secret, expiresIn } = getJwtConfig();

  return jwt.sign(
    { userId: user._id.toString() },
    secret,
    { expiresIn }
  );
};

//4️⃣ 过滤敏感信息（重点）
const toSafeUser = (user) => {
  if (!user) {
    return null;
  }

  if (typeof user.toSafeObject === 'function') {
    return user.toSafeObject();
  }

  //删除密码，返回前端
  const safeUser = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete safeUser.password;
  return safeUser;
};

//注册总结流程：
// 输入 → 校验 → 查重 → 创建 → token → 返回
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: 'Username, email, and password are required.',
        error: 'Missing required registration fields.'
      });
    }

    // 3️⃣ 标准化输入
    const normalizedUsername = getNormalizedValue(username);
    const normalizedEmail = getNormalizedValue(email);

    // 4️⃣ 查重（关键）检测请求的用户名或邮箱是否已存在，不能注册一样的信息
    const existingUser = await User.findOne({
      $or: [
        { username: normalizedUsername },
        { email: normalizedEmail }
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'Username or email already exists.',
        error: 'Duplicate user credentials.'
      });
    }

    // 5️⃣ 创建用户（核心）把用户信息存到数据库
    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password
    });

    const token = createToken(user);

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      safeUser: toSafeUser(user)
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: getValidationMessage(error),
        error: error.message
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Username or email already exists.',
        error: 'Duplicate user credentials.'
      });
    }

    return res.status(500).json({
      message: 'Failed to register user.',
      error: error.message
    });
  }
};

// 输入
//  ↓
// 查用户
//  ↓
// 密码验证
//  ↓
// 成功 → 清空限流 + 发 token
// 失败 → 记录失败 + 限流
const login = async (req, res) => {
  // Step 0：获取限流 key
  const rateLimitKey = req.loginRateLimitKey;

  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      recordFailedLoginAttempt(rateLimitKey);
      return res.status(400).json({
        message: 'Identifier and password are required.',
        error: 'Missing login credentials.'
      });
    }

    const normalizedIdentifier = getNormalizedValue(identifier);

    /*
      支持 用户名 / 邮箱 都能登录
      找到用户后，拿出密码和用户输入的密码比对 
    */
    const user = await User.findOne({
      $or: [
        { username: normalizedIdentifier },
        { email: normalizedIdentifier }
      ]
    }).select('+password');

    if (!user) {
      recordFailedLoginAttempt(rateLimitKey);
      return res.status(401).json({
        message: 'Invalid credentials.',
        error: 'Username/email or password is incorrect.'
      });
    }

    //Step 6：密码校验
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      recordFailedLoginAttempt(rateLimitKey);
      return res.status(401).json({
        message: 'Invalid credentials.',
        error: 'Username/email or password is incorrect.'
      });
    }
    //登录成功，清楚登录失败记录
    clearLoginRateLimit(rateLimitKey);
    //生成 token
    const token = createToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      safeUser: toSafeUser(user)
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to log in.',
      error: error.message
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    return res.status(200).json({
      message: 'Current user fetched successfully.',
      safeUser: toSafeUser(req.user)
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch current user.',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser
};

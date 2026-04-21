const { getLoginRateLimitConfig } = require('../config/runtime');

//1. Map 存储
const attemptsStore = new Map();


//识别用户（key）
// 作用
// 生成唯一用户标识：
// IP（防止同账号多IP攻击）
// identifier（用户名/邮箱）
const getKey = (req) => { 
  const identifier = typeof req.body?.identifier === 'string'
    ? req.body.identifier.trim().toLowerCase()
    : 'unknown';

  return `${req.ip}:${identifier}`;
};

// 作用

// 判断是否过期：

// 👉 如果超过时间窗口 → 直接清空记录
const pruneExpiredEntry = (entry, now, windowMs) => {
  if (!entry) {
    return null;
  }

  if (now - entry.firstAttemptAt >= windowMs) {
    return null;
  }

  return entry;
};
//限制登录失败次数
const loginRateLimitMiddleware = (req, res, next) => {
  const { windowMs, maxAttempts } = getLoginRateLimitConfig();
  const now = Date.now();
  const key = getKey(req);
  //读取当前记录
  const currentEntry = pruneExpiredEntry(attemptsStore.get(key), now, windowMs);

  if (!currentEntry) {
    req.loginRateLimitKey = key;
    return next();
  }

  if (currentEntry.count >= maxAttempts) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - currentEntry.firstAttemptAt)) / 1000));
    res.set('Retry-After', String(retryAfterSeconds));

    return res.status(429).json({
      message: 'Too many login attempts. Please try again later.',
      error: 'Login rate limit exceeded.'
    });
  }

  req.loginRateLimitKey = key;
  return next();
};

//记录失败次数（Map 存储）
const recordFailedLoginAttempt = (key) => {
  if (!key) {
    return;
  }

  const { windowMs } = getLoginRateLimitConfig();
  const now = Date.now();
  const currentEntry = pruneExpiredEntry(attemptsStore.get(key), now, windowMs);

  if (!currentEntry) {
    attemptsStore.set(key, {
      count: 1,
      firstAttemptAt: now
    });
    return;
  }

  attemptsStore.set(key, {
    count: currentEntry.count + 1,
    firstAttemptAt: currentEntry.firstAttemptAt
  });
};

const clearLoginRateLimit = (key) => {
  if (!key) {
    return;
  }

  attemptsStore.delete(key);
};

module.exports = {
  loginRateLimitMiddleware,
  recordFailedLoginAttempt,
  clearLoginRateLimit
};

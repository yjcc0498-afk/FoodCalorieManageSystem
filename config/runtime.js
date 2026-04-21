// 统一管理运行时配置 + 做安全校验 + 提供给其他模块使用
//所有 .env 配置的“读取 + 校验中心”

// 解析正整数的环境变量，如果未定义则使用默认值
const parsePositiveInteger = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }

  //字符串转成整数，并且必须是正整数
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// 获取 JWT 配置(秘钥过期时间)，并进行必要的校验
const getJwtConfig = () => {
  //JWT 密钥（必须配置且不能为空）
  const secret = String(process.env.JWT_SECRET || '').trim();
  //过期时间（默认7天）
  const expiresIn = String(process.env.JWT_EXPIRES_IN || '7d').trim();

  if (!secret) {
    throw new Error('JWT_SECRET is not configured. Please check your .env file.');
  }

  if (!expiresIn) {
    throw new Error('JWT_EXPIRES_IN cannot be empty when provided.');
  }

  return {
    secret,
    expiresIn
  };
};

// 获取登录接口的速率限制配置，并进行必要的校验
const getLoginRateLimitConfig = () => {
  return {
    windowMs: parsePositiveInteger(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
    maxAttempts: parsePositiveInteger(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 5)
  };
};

// 统一的配置校验函数，确保所有关键配置在应用启动时都得到验证
const validateRuntimeConfig = () => {
  getJwtConfig();
  getLoginRateLimitConfig();
};

module.exports = {
  getJwtConfig,
  getLoginRateLimitConfig,
  validateRuntimeConfig
};

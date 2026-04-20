const parsePositiveInteger = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getJwtConfig = () => {
  const secret = String(process.env.JWT_SECRET || '').trim();
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

const getLoginRateLimitConfig = () => {
  return {
    windowMs: parsePositiveInteger(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
    maxAttempts: parsePositiveInteger(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 5)
  };
};

const validateRuntimeConfig = () => {
  getJwtConfig();
  getLoginRateLimitConfig();
};

module.exports = {
  getJwtConfig,
  getLoginRateLimitConfig,
  validateRuntimeConfig
};

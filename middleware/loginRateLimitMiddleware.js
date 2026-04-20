const { getLoginRateLimitConfig } = require('../config/runtime');

const attemptsStore = new Map();

const getKey = (req) => {
  const identifier = typeof req.body?.identifier === 'string'
    ? req.body.identifier.trim().toLowerCase()
    : 'unknown';

  return `${req.ip}:${identifier}`;
};

const pruneExpiredEntry = (entry, now, windowMs) => {
  if (!entry) {
    return null;
  }

  if (now - entry.firstAttemptAt >= windowMs) {
    return null;
  }

  return entry;
};

const loginRateLimitMiddleware = (req, res, next) => {
  const { windowMs, maxAttempts } = getLoginRateLimitConfig();
  const now = Date.now();
  const key = getKey(req);
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

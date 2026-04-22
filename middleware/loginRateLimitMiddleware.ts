import type { NextFunction, Request, Response } from 'express';
const { getLoginRateLimitConfig } = require('../config/runtime');

interface LoginAttemptEntry {
  count: number;
  firstAttemptAt: number;
}

interface LoginRequestBody {
  identifier?: unknown;
}

const attemptsStore = new Map<string, LoginAttemptEntry>();

const getKey = (req: Request<object, object, LoginRequestBody>): string => {
  const identifier = typeof req.body?.identifier === 'string'
    ? req.body.identifier.trim().toLowerCase()
    : 'unknown';

  return `${req.ip}:${identifier}`;
};

const pruneExpiredEntry = (
  entry: LoginAttemptEntry | undefined,
  now: number,
  windowMs: number
): LoginAttemptEntry | null => {
  if (!entry) {
    return null;
  }

  if (now - entry.firstAttemptAt >= windowMs) {
    return null;
  }

  return entry;
};

const loginRateLimitMiddleware = (
  req: Request<object, object, LoginRequestBody>,
  res: Response,
  next: NextFunction
) => {
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

const recordFailedLoginAttempt = (key?: string) => {
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

const clearLoginRateLimit = (key?: string) => {
  if (!key) {
    return;
  }

  attemptsStore.delete(key);
};

export = {
  loginRateLimitMiddleware,
  recordFailedLoginAttempt,
  clearLoginRateLimit
};

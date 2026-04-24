import type { SignOptions } from 'jsonwebtoken';

type JwtConfig = {
  secret: string;
  expiresIn: SignOptions['expiresIn'];
};

type AvatarUploadConfig = {
  maxBytes: number;
  allowedMimeTypes: string[];
  publicBasePath: string;
};

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getJwtConfig = (): JwtConfig => {
  const secret = String(process.env.JWT_SECRET || '').trim();
  const expiresIn = String(process.env.JWT_EXPIRES_IN || '7d').trim() as SignOptions['expiresIn'];

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

const getAvatarUploadConfig = (): AvatarUploadConfig => {
  const maxBytes = parsePositiveInteger(process.env.AVATAR_UPLOAD_MAX_BYTES, 1024 * 1024);

  return {
    maxBytes,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ],
    publicBasePath: '/uploads/avatars'
  };
};

const getJsonBodyLimit = (): string => {
  const { maxBytes } = getAvatarUploadConfig();
  const limitBytes = Math.max(256 * 1024, Math.ceil(maxBytes * 1.5));
  return `${limitBytes}b`;
};

const validateRuntimeConfig = () => {
  getJwtConfig();
  getLoginRateLimitConfig();
  getAvatarUploadConfig();
};

export {
  getJwtConfig,
  getLoginRateLimitConfig,
  getAvatarUploadConfig,
  getJsonBodyLimit,
  validateRuntimeConfig
};

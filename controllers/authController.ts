import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { getJwtConfig } from '../config/runtime';
import loginRateLimitModule = require('../middleware/loginRateLimitMiddleware');

type RequestWithUser = Request & {
  user?: any;
  loginRateLimitKey?: string;
};

const {
  clearLoginRateLimit,
  recordFailedLoginAttempt
} = loginRateLimitModule;

class RequestValidationError extends Error {}

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const getNormalizedValue = (value: unknown): string => String(value || '').trim().toLowerCase();

const createAvatarSeed = (value: unknown): string => {
  const normalizedValue = String(value || 'user').trim().toLowerCase();
  const sanitizedValue = normalizedValue
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitizedValue || 'user';
};

const getValidationMessage = (error: any): string => {
  const messages = Object.values(error.errors || {}).map((item: any) => item.message);
  return messages[0] || 'Validation failed.';
};

const createToken = (user: any): string => {
  const { secret, expiresIn } = getJwtConfig();

  return jwt.sign(
    { userId: user._id.toString() },
    secret,
    { expiresIn }
  );
};

const toSafeUser = (user: any): any => {
  if (!user) {
    return null;
  }

  if (typeof user.toSafeObject === 'function') {
    return user.toSafeObject();
  }

  const safeUser = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete safeUser.password;
  return safeUser;
};

const parseOptionalTextField = (value: unknown, fieldLabel: string): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new RequestValidationError(`${fieldLabel} must be a string.`);
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
};

const parseOptionalNonNegativeNumber = (value: unknown, fieldLabel: string): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new RequestValidationError(`${fieldLabel} must be a valid number.`);
  }

  if (parsedValue < 0) {
    throw new RequestValidationError(`${fieldLabel} cannot be negative.`);
  }

  return parsedValue;
};

const buildRegistrationProfileInput = (body: Record<string, unknown>, normalizedUsername: string) => {
  const profileInput: Record<string, unknown> = {};
  const bio = parseOptionalTextField(body.bio, 'Bio');
  const height = parseOptionalNonNegativeNumber(body.height, 'Height');
  const age = parseOptionalNonNegativeNumber(body.age, 'Age');
  const weight = parseOptionalNonNegativeNumber(body.weight, 'Weight');
  const targetWeight = parseOptionalNonNegativeNumber(body.targetWeight, 'Target weight');
  const dailyCalorieGoal = parseOptionalNonNegativeNumber(body.dailyCalorieGoal, 'Daily calorie goal');
  const avatarUrl = parseOptionalTextField(body.avatarUrl, 'Avatar URL');
  const rawAvatarType = body.avatarType === undefined
    ? undefined
    : String(body.avatarType).trim().toLowerCase();

  if (rawAvatarType !== undefined && !['default', 'uploaded'].includes(rawAvatarType)) {
    throw new RequestValidationError('Avatar type must be default or uploaded.');
  }

  if (bio !== undefined) {
    profileInput.bio = bio;
  }

  if (height !== undefined) {
    profileInput.height = height;
  }

  if (age !== undefined) {
    profileInput.age = age;
  }

  if (weight !== undefined) {
    profileInput.weight = weight;
  }

  if (targetWeight !== undefined) {
    profileInput.targetWeight = targetWeight;
  }

  if (dailyCalorieGoal !== undefined) {
    profileInput.dailyCalorieGoal = dailyCalorieGoal;
  }

  const requestedAvatarSeed = body.avatarSeed === undefined
    ? undefined
    : createAvatarSeed(body.avatarSeed || normalizedUsername);

  if (rawAvatarType === 'uploaded' || (rawAvatarType === undefined && avatarUrl)) {
    if (!avatarUrl) {
      throw new RequestValidationError('Avatar URL is required when avatar type is uploaded.');
    }

    profileInput.avatarType = 'uploaded';
    profileInput.avatarUrl = avatarUrl;

    if (requestedAvatarSeed) {
      profileInput.avatarSeed = requestedAvatarSeed;
    }
  } else if (rawAvatarType === 'default' || requestedAvatarSeed !== undefined) {
    profileInput.avatarType = 'default';
    profileInput.avatarUrl = null;
    profileInput.avatarSeed = requestedAvatarSeed || createAvatarSeed(normalizedUsername);
  }

  return profileInput;
};

const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: 'Username, email, and password are required.',
        error: 'Missing required registration fields.'
      });
    }

    const normalizedUsername = getNormalizedValue(username);
    const normalizedEmail = getNormalizedValue(email);
    const profileInput = buildRegistrationProfileInput(req.body || {}, normalizedUsername);

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

    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password,
      ...profileInput
    });

    const token = createToken(user);

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      safeUser: toSafeUser(user)
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError instanceof RequestValidationError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid registration input.'
      });
    }

    if (typedError.name === 'ValidationError') {
      return res.status(400).json({
        message: getValidationMessage(typedError),
        error: getErrorMessage(typedError)
      });
    }

    if (typedError.code === 11000) {
      return res.status(409).json({
        message: 'Username or email already exists.',
        error: 'Duplicate user credentials.'
      });
    }

    return res.status(500).json({
      message: 'Failed to register user.',
      error: getErrorMessage(typedError)
    });
  }
};

const login = async (req: RequestWithUser, res: Response) => {
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

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      recordFailedLoginAttempt(rateLimitKey);
      return res.status(401).json({
        message: 'Invalid credentials.',
        error: 'Username/email or password is incorrect.'
      });
    }

    clearLoginRateLimit(rateLimitKey);
    const lastLoginAt = new Date();
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt } }
    );
    user.lastLoginAt = lastLoginAt;
    const token = createToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      safeUser: toSafeUser(user)
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to log in.',
      error: getErrorMessage(error)
    });
  }
};

const getCurrentUser = async (req: RequestWithUser, res: Response) => {
  try {
    return res.status(200).json({
      message: 'Current user fetched successfully.',
      safeUser: toSafeUser(req.user)
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to fetch current user.',
      error: getErrorMessage(error)
    });
  }
};

export {
  register,
  login,
  getCurrentUser
};

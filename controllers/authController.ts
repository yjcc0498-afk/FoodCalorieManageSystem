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

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const getNormalizedValue = (value: unknown): string => String(value || '').trim().toLowerCase();

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
      password
    });

    const token = createToken(user);

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      safeUser: toSafeUser(user)
    });
  } catch (error: unknown) {
    const typedError = error as any;

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

import fs = require('fs');
import path = require('path');
import jwt = require('jsonwebtoken');
import mongoose = require('mongoose');
import type { NextFunction, Request, Response } from 'express';
const { getJwtConfig } = require('../config/runtime');

const getTokenFromHeader = (authorizationHeader?: string | string[]): string | null => {
  if (!authorizationHeader || Array.isArray(authorizationHeader)) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

const getUserIdFromPayload = (payload: string | jwt.JwtPayload): string | null => {
  if (typeof payload === 'string') {
    return null;
  }

  const candidate = payload.id || payload.userId || payload._id || payload.sub || null;
  return typeof candidate === 'string' ? candidate : null;
};

type UserModelLike = {
  findById: (id: string) => {
    select: (selection: string) => Promise<unknown>;
  };
};

const getUserModel = (): UserModelLike | null => {
  if (mongoose.models.User) {
    return mongoose.models.User as unknown as UserModelLike;
  }

  const userModelJsPath = path.join(__dirname, '..', 'models', 'User.js');
  const userModelTsPath = path.join(__dirname, '..', 'models', 'User.ts');

  if (fs.existsSync(userModelJsPath)) {
    return require(userModelJsPath) as UserModelLike;
  }

  if (fs.existsSync(userModelTsPath)) {
    return require(userModelTsPath) as UserModelLike;
  }

  return null;
};

const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
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

    req.user = user as Record<string, unknown>;
    req.token = token;
    return next();
  } catch (error) {
    const errorName = error instanceof Error ? error.name : '';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error.';

    if (errorName === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token has expired. Please log in again.'
      });
    }

    if (errorName === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid token.'
      });
    }

    return res.status(500).json({
      message: 'Authentication failed.',
      error: errorMessage
    });
  }
};

export = authMiddleware;

import type { NextFunction, Request, Response } from 'express';
const { isAdminUser } = require('../utils/permissions');

const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication is required before admin authorization.'
    });
  }

  if (!isAdminUser(req.user)) {
    return res.status(403).json({
      message: 'Admin access required.'
    });
  }

  return next();
};

export = adminMiddleware;

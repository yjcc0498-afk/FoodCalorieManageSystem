import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { readAdminConfig } from '../config/bootstrapAdmin';
import { getJwtConfig, getLoginRateLimitConfig } from '../config/runtime';
import Food from '../models/Food';
import User from '../models/User';

class RequestValidationError extends Error {}

const FOOD_COLLECTION = 'foods';
const USER_COLLECTION = 'users';
const DEMO_VERSION = 'Food Calorie Management System v3';

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const parsePage = (value: unknown): number => {
  const parsedValue = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 1;
};

const parseLimit = (value: unknown): number => {
  const parsedValue = Number.parseInt(String(value || ''), 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return 20;
  }

  return Math.min(parsedValue, 100);
};

const parseNonNegativeNumber = (value: unknown): number | null => {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return Number.NaN;
  }

  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue) || parsedValue < 0) {
    return Number.NaN;
  }

  return parsedValue;
};

const parseOrder = (value: unknown): 1 | -1 => {
  return String(value || 'desc').trim().toLowerCase() === 'asc' ? 1 : -1;
};

type RecentActivityItem = {
  type: 'user_registered' | 'food_created' | 'user_login';
  title: string;
  detail: string;
  timestamp: string;
};

const normalizeTimestamp = (value: unknown): string | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value !== 'string' || !value) {
    return null;
  }

  const parsedValue = new Date(value);
  return Number.isNaN(parsedValue.getTime()) ? null : parsedValue.toISOString();
};

const formatDurationMs = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return 'configured';
  }

  if (value % (60 * 60 * 1000) === 0) {
    return `${value / (60 * 60 * 1000)}h`;
  }

  if (value % (60 * 1000) === 0) {
    return `${value / (60 * 1000)}m`;
  }

  if (value % 1000 === 0) {
    return `${value / 1000}s`;
  }

  return `${value}ms`;
};

const getMongoSummary = (mongoUri: string | undefined) => {
  const value = String(mongoUri || '').trim();
  const normalized = value.toLowerCase();

  return {
    mongoExpectedLocal: normalized.includes('127.0.0.1') || normalized.includes('localhost'),
    database:
      normalized.includes('127.0.0.1') || normalized.includes('localhost')
        ? 'MongoDB (local connection expected)'
        : value
          ? 'MongoDB (custom connection configured)'
          : 'MongoDB (not configured)'
  };
};

const buildRecentActivity = (
  recentUsers: any[],
  recentFoodItems: any[]
): RecentActivityItem[] => {
  const events: RecentActivityItem[] = [];

  recentUsers.forEach((user) => {
    const safeUser = typeof user.toSafeObject === 'function' ? user.toSafeObject() : user;
    const createdAt = normalizeTimestamp(safeUser?.createdAt);
    const lastLoginAt = normalizeTimestamp(safeUser?.lastLoginAt);

    if (createdAt) {
      events.push({
        type: 'user_registered',
        title: `${safeUser.username || 'User'} registered`,
        detail: `${safeUser.email || 'No email available'}`,
        timestamp: createdAt
      });
    }

    if (lastLoginAt) {
      events.push({
        type: 'user_login',
        title: `${safeUser.username || 'User'} logged in`,
        detail: 'Successful authenticated session recorded',
        timestamp: lastLoginAt
      });
    }
  });

  recentFoodItems.forEach((food) => {
    const createdAt = normalizeTimestamp(food?.createdAt);

    if (!createdAt) {
      return;
    }

    const ownerName = food?.owner?.username || food?.owner?.email || 'Unknown owner';
    events.push({
      type: 'food_created',
      title: `${food?.name || 'Food'} created`,
      detail: `Owner: ${ownerName}`,
      timestamp: createdAt
    });
  });

  return events
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 8);
};

const getAdminFoodSort = (req: Request): {
  sortBy: string;
  order: 'asc' | 'desc';
  stage: Record<string, 1 | -1>;
} => {
  const sortFieldMap: Record<string, string> = {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    name: 'name',
    calories: 'calories',
    ownerUsername: 'ownerUser.username',
    ownerEmail: 'ownerUser.email'
  };
  const requestedSortBy = String(req.query.sortBy || 'createdAt').trim();
  const resolvedSortBy = sortFieldMap[requestedSortBy] ? requestedSortBy : 'createdAt';
  const direction = parseOrder(req.query.order);
  const stage: Record<string, 1 | -1> = {
    [sortFieldMap[resolvedSortBy]]: direction
  };

  if (resolvedSortBy !== 'createdAt') {
    stage.createdAt = -1;
  }

  stage._id = 1;

  return {
    sortBy: resolvedSortBy,
    order: direction === 1 ? 'asc' : 'desc',
    stage
  };
};

const getAdminOverview = async (_req: Request, res: Response) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const loginRateLimitConfig = getLoginRateLimitConfig();
    const jwtConfig = getJwtConfig();
    const adminConfig = readAdminConfig();
    const adminBootstrapEnabled = Boolean(adminConfig.username && adminConfig.email && adminConfig.password);
    const mongoSummary = getMongoSummary(process.env.MONGODB_URI);

    const [
      totalUsers,
      totalAdmins,
      totalFoods,
      recentRegistrations,
      recentFoods,
      usersWithLastLogin,
      recentUsers,
      recentFoodItems,
      topUsersByFoodCount
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      Food.countDocuments(),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Food.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      User.countDocuments({ lastLoginAt: { $ne: null } }),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5),
      Food.aggregate([
        {
          $lookup: {
            from: USER_COLLECTION,
            localField: 'owner',
            foreignField: '_id',
            as: 'ownerUser'
          }
        },
        {
          $unwind: {
            path: '$ownerUser',
            preserveNullAndEmptyArrays: true
          }
        },
        { $sort: { createdAt: -1, _id: 1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 1,
            name: 1,
            calories: 1,
            createdAt: 1,
            updatedAt: 1,
            owner: {
              _id: '$ownerUser._id',
              username: '$ownerUser.username',
              email: '$ownerUser.email',
              role: '$ownerUser.role'
            }
          }
        }
      ]),
      User.aggregate([
        {
          $lookup: {
            from: FOOD_COLLECTION,
            localField: '_id',
            foreignField: 'owner',
            as: 'ownedFoods'
          }
        },
        {
          $addFields: {
            foodCount: { $size: '$ownedFoods' }
          }
        },
        {
          $project: {
            ownedFoods: 0,
            password: 0,
            __v: 0
          }
        },
        { $sort: { foodCount: -1, createdAt: -1, _id: 1 } },
        { $limit: 5 }
      ])
    ]);

    const recentActivity = buildRecentActivity(recentUsers, recentFoodItems);

    return res.status(200).json({
      message: 'Admin overview fetched successfully.',
      data: {
        counts: {
          totalUsers,
          totalAdmins,
          totalRegularUsers: totalUsers - totalAdmins,
          totalFoods,
          recentRegistrations,
          recentFoods,
          usersWithLastLogin
        },
        security: {
          loginRateLimitWindowMs: loginRateLimitConfig.windowMs,
          loginRateLimitMaxAttempts: loginRateLimitConfig.maxAttempts,
          jwtExpiresIn: String(jwtConfig.expiresIn),
          auditStatus: recentActivity.length
            ? 'summary-only (derived from current admin overview data)'
            : 'summary-only (no recent activity yet)'
        },
        system: {
          runtime: 'Node.js + Express 5',
          database: mongoSummary.database,
          odm: 'Mongoose',
          auth: 'JWT + bcryptjs',
          adminBootstrapEnabled,
          envSource: '.env / process.env'
        },
        health: {
          apiReady: true,
          mongoExpectedLocal: mongoSummary.mongoExpectedLocal,
          adminBootstrapEnabled,
          demoVersion: DEMO_VERSION
        },
        recentActivity,
        recentUsers: recentUsers.map((user: any) => user.toSafeObject()),
        recentFoods: recentFoodItems,
        topUsersByFoodCount,
        generatedAt: new Date().toISOString(),
        meta: {
          databaseConnected: mongoose.connection.readyState === 1
        }
      }
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to fetch admin overview.',
      error: getErrorMessage(error)
    });
  }
};

const getAdminFoods = async (req: Request, res: Response) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const skip = (page - 1) * limit;
    const keyword = String(req.query.keyword || '').trim();
    const owner = String(req.query.owner || '').trim();
    const caloriesMin = parseNonNegativeNumber(req.query.caloriesMin);
    const caloriesMax = parseNonNegativeNumber(req.query.caloriesMax);
    const sort = getAdminFoodSort(req);
    const matchConditions: Record<string, unknown>[] = [];

    if (caloriesMin !== null && Number.isNaN(caloriesMin)) {
      throw new RequestValidationError('caloriesMin must be a valid non-negative number.');
    }

    if (caloriesMax !== null && Number.isNaN(caloriesMax)) {
      throw new RequestValidationError('caloriesMax must be a valid non-negative number.');
    }

    if (caloriesMin !== null && caloriesMax !== null && caloriesMin > caloriesMax) {
      throw new RequestValidationError('caloriesMin cannot be greater than caloriesMax.');
    }

    if (keyword) {
      matchConditions.push({
        name: new RegExp(escapeRegex(keyword), 'i')
      });
    }

    if (owner) {
      const ownerRegex = new RegExp(escapeRegex(owner), 'i');

      matchConditions.push({
        $or: [
          { 'ownerUser.username': ownerRegex },
          { 'ownerUser.email': ownerRegex }
        ]
      });
    }

    if (caloriesMin !== null || caloriesMax !== null) {
      const caloriesFilter: Record<string, number> = {};

      if (caloriesMin !== null) {
        caloriesFilter.$gte = caloriesMin;
      }

      if (caloriesMax !== null) {
        caloriesFilter.$lte = caloriesMax;
      }

      matchConditions.push({
        calories: caloriesFilter
      });
    }

    const matchStage = matchConditions.length
      ? { $match: matchConditions.length === 1 ? matchConditions[0] : { $and: matchConditions } }
      : null;
    const basePipeline: any[] = [
      {
        $lookup: {
          from: USER_COLLECTION,
          localField: 'owner',
          foreignField: '_id',
          as: 'ownerUser'
        }
      },
      {
        $unwind: {
          path: '$ownerUser',
          preserveNullAndEmptyArrays: false
        }
      }
    ];

    if (matchStage) {
      basePipeline.push(matchStage);
    }

    const dataPipeline = [
      ...basePipeline,
      { $sort: sort.stage },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          calories: 1,
          createdAt: 1,
          updatedAt: 1,
          owner: {
            _id: '$ownerUser._id',
            username: '$ownerUser.username',
            email: '$ownerUser.email',
            role: '$ownerUser.role',
            lastLoginAt: '$ownerUser.lastLoginAt'
          }
        }
      }
    ];
    const totalPipeline = [
      ...basePipeline,
      { $count: 'total' }
    ];

    const [foods, totalResult] = await Promise.all([
      Food.aggregate(dataPipeline),
      Food.aggregate(totalPipeline)
    ]);
    const total = totalResult[0]?.total || 0;

    return res.status(200).json({
      message: 'Admin foods fetched successfully.',
      data: foods,
      pagination: {
        page,
        limit,
        total,
        totalPages: total ? Math.ceil(total / limit) : 0
      },
      filters: {
        ...(keyword ? { keyword } : {}),
        ...(owner ? { owner } : {}),
        ...(caloriesMin !== null ? { caloriesMin } : {}),
        ...(caloriesMax !== null ? { caloriesMax } : {})
      },
      sort: {
        sortBy: sort.sortBy,
        order: sort.order
      }
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError instanceof RequestValidationError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid admin foods query.'
      });
    }

    return res.status(500).json({
      message: 'Failed to fetch admin foods.',
      error: getErrorMessage(typedError)
    });
  }
};

export {
  getAdminOverview,
  getAdminFoods
};

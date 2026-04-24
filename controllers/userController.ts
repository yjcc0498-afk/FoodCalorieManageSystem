import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import Food from '../models/Food';
import GoalCycle from '../models/GoalCycle';
import DailyLog from '../models/DailyLog';
import JournalEntry from '../models/JournalEntry';
import User from '../models/User';

type RequestWithUser = Request & {
  user?: any;
};

class RequestValidationError extends Error {}

const USER_COLLECTION = 'users';
const FOOD_COLLECTION = 'foods';

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const getValidationMessage = (error: any): string => {
  const messages = Object.values(error.errors || {}).map((item: any) => item.message);
  return messages[0] || 'Validation failed.';
};

const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const getNormalizedValue = (value: unknown): string => {
  return String(value || '').trim().toLowerCase();
};

const createAvatarSeed = (value: unknown): string => {
  const normalizedValue = String(value || 'user').trim().toLowerCase();
  const sanitizedValue = normalizedValue
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitizedValue || 'user';
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

const parsePage = (value: unknown): number => {
  const parsedValue = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 1;
};

const parseLimit = (value: unknown): number => {
  const parsedValue = Number.parseInt(String(value || ''), 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return 10;
  }

  return Math.min(parsedValue, 100);
};

const parseOrder = (value: unknown): 1 | -1 => {
  return String(value || 'desc').trim().toLowerCase() === 'asc' ? 1 : -1;
};

const parseNullableTextField = (value: unknown, fieldLabel: string): string | null | undefined => {
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

const parseRequiredNormalizedField = (value: unknown, fieldLabel: string): string => {
  const normalizedValue = getNormalizedValue(value);

  if (!normalizedValue) {
    throw new RequestValidationError(`${fieldLabel} cannot be empty.`);
  }

  return normalizedValue;
};

const parseNullableNonNegativeNumber = (value: unknown, fieldLabel: string): number | null | undefined => {
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

const getUserFilters = (req: Request): {
  match: Record<string, unknown>;
  filters: Record<string, unknown>;
} => {
  const keyword = String(req.query.keyword || '').trim();
  const role = String(req.query.role || '').trim().toLowerCase();
  const match: Record<string, unknown> = {};
  const filters: Record<string, unknown> = {};

  if (role) {
    if (!['user', 'admin'].includes(role)) {
      throw new RequestValidationError('Role filter must be user or admin.');
    }

    match.role = role;
    filters.role = role;
  }

  if (keyword) {
    const searchRegex = new RegExp(escapeRegex(keyword), 'i');
    match.$or = [
      { username: searchRegex },
      { email: searchRegex },
      { bio: searchRegex }
    ];
    filters.keyword = keyword;
  }

  return {
    match,
    filters
  };
};

const getUserSort = (req: Request): {
  sortBy: string;
  order: 'asc' | 'desc';
  stage: Record<string, 1 | -1>;
} => {
  const allowedSortFields = new Set([
    'createdAt',
    'updatedAt',
    'username',
    'email',
    'role',
    'lastLoginAt',
    'foodCount'
  ]);
  const requestedSortBy = String(req.query.sortBy || 'createdAt').trim();
  const resolvedSortBy = allowedSortFields.has(requestedSortBy) ? requestedSortBy : 'createdAt';
  const direction = parseOrder(req.query.order);
  const stage: Record<string, 1 | -1> = {
    [resolvedSortBy]: direction
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

const getUsers = async (req: RequestWithUser, res: Response) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const skip = (page - 1) * limit;
    const { match, filters } = getUserFilters(req);
    const sort = getUserSort(req);
    const pipeline: any[] = [
      { $match: match },
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
      { $sort: sort.stage },
      { $skip: skip },
      { $limit: limit }
    ];

    const [users, total] = await Promise.all([
      User.aggregate(pipeline),
      User.countDocuments(match)
    ]);

    return res.status(200).json({
      message: 'Users fetched successfully.',
      count: users.length,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: total ? Math.ceil(total / limit) : 0
      },
      filters,
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
        error: 'Invalid user list query.'
      });
    }

    return res.status(500).json({
      message: 'Failed to fetch users.',
      error: getErrorMessage(typedError)
    });
  }
};

const getUserById = async (req: RequestWithUser, res: Response) => {
  try {
    const id = String(req.params.id || '');

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid user ID.',
        error: 'The provided ID is not a valid MongoDB ObjectId.'
      });
    }

    const userData = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id)
        }
      },
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
      }
    ]);

    if (!userData.length) {
      return res.status(404).json({
        message: 'User not found.',
        error: 'No user record exists for the provided ID.'
      });
    }

    return res.status(200).json({
      message: 'User fetched successfully.',
      data: userData[0]
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to fetch user.',
      error: getErrorMessage(error)
    });
  }
};

const updateUser = async (req: RequestWithUser, res: Response) => {
  try {
    const id = String(req.params.id || '');

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid user ID.',
        error: 'The provided ID is not a valid MongoDB ObjectId.'
      });
    }

    const user = await User.findById(id).select('+password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
        error: 'No user record exists for the provided ID.'
      });
    }

    const updates: Record<string, unknown> = {};

    if (req.body.username !== undefined) {
      updates.username = parseRequiredNormalizedField(req.body.username, 'Username');
    }

    if (req.body.email !== undefined) {
      updates.email = parseRequiredNormalizedField(req.body.email, 'Email');
    }

    if (req.body.role !== undefined) {
      const normalizedRole = getNormalizedValue(req.body.role);

      if (!['user', 'admin'].includes(normalizedRole)) {
        return res.status(400).json({
          message: 'Role must be user or admin.',
          error: 'Invalid role value.'
        });
      }

      updates.role = normalizedRole;
    }

    if (req.body.password !== undefined) {
      const nextPassword = typeof req.body.password === 'string' ? req.body.password : '';

      if (!nextPassword) {
        return res.status(400).json({
          message: 'Password cannot be empty.',
          error: 'Invalid password value.'
        });
      }

      updates.password = nextPassword;
    }

    if (req.body.bio !== undefined) {
      updates.bio = parseNullableTextField(req.body.bio, 'Bio');
    }

    if (req.body.height !== undefined) {
      updates.height = parseNullableNonNegativeNumber(req.body.height, 'Height');
    }

    if (req.body.weight !== undefined) {
      updates.weight = parseNullableNonNegativeNumber(req.body.weight, 'Weight');
    }

    if (req.body.targetWeight !== undefined) {
      updates.targetWeight = parseNullableNonNegativeNumber(req.body.targetWeight, 'Target weight');
    }

    if (req.body.dailyCalorieGoal !== undefined) {
      updates.dailyCalorieGoal = parseNullableNonNegativeNumber(req.body.dailyCalorieGoal, 'Daily calorie goal');
    }

    const requestedAvatarType = req.body.avatarType === undefined
      ? undefined
      : String(req.body.avatarType).trim().toLowerCase();

    if (requestedAvatarType !== undefined && !['default', 'uploaded'].includes(requestedAvatarType)) {
      return res.status(400).json({
        message: 'Avatar type must be default or uploaded.',
        error: 'Invalid avatar type.'
      });
    }

    if (req.body.avatarType !== undefined || req.body.avatarUrl !== undefined || req.body.avatarSeed !== undefined) {
      const avatarUrl = parseNullableTextField(req.body.avatarUrl, 'Avatar URL');
      const avatarSeed = req.body.avatarSeed === undefined
        ? undefined
        : createAvatarSeed(req.body.avatarSeed || updates.username || user.username);

      if (requestedAvatarType === 'uploaded' || (requestedAvatarType === undefined && avatarUrl)) {
        if (!avatarUrl) {
          return res.status(400).json({
            message: 'Avatar URL is required when avatar type is uploaded.',
            error: 'Missing uploaded avatar URL.'
          });
        }

        updates.avatarType = 'uploaded';
        updates.avatarUrl = avatarUrl;

        if (avatarSeed !== undefined) {
          updates.avatarSeed = avatarSeed;
        }
      } else {
        updates.avatarType = 'default';
        updates.avatarUrl = null;
        updates.avatarSeed = avatarSeed || createAvatarSeed(updates.username || user.username);
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        message: 'No valid update fields provided.',
        error: 'Allowed fields: username, email, role, password, bio, height, weight, targetWeight, dailyCalorieGoal, avatarType, avatarUrl, avatarSeed.'
      });
    }

    const duplicateFilters: Record<string, unknown>[] = [];

    if (updates.username) {
      duplicateFilters.push({ username: updates.username });
    }

    if (updates.email) {
      duplicateFilters.push({ email: updates.email });
    }

    if (duplicateFilters.length) {
      const duplicateUser = await User.findOne({
        _id: { $ne: user._id },
        $or: duplicateFilters
      });

      if (duplicateUser) {
        return res.status(409).json({
          message: 'Username or email is already in use.',
          error: 'Duplicate user identity field.'
        });
      }
    }

    Object.entries(updates).forEach(([key, value]) => {
      user.set(key, value);
    });

    if (updates.username && user.avatarType === 'default' && req.body.avatarSeed === undefined) {
      user.avatarSeed = createAvatarSeed(updates.username);
    }

    await user.save();

    const foodCount = await Food.countDocuments({ owner: user._id });

    return res.status(200).json({
      message: 'User updated successfully.',
      data: {
        ...toSafeUser(user),
        foodCount
      }
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError instanceof RequestValidationError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid user update input.'
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
        message: 'Username or email is already in use.',
        error: 'Duplicate user identity field.'
      });
    }

    return res.status(500).json({
      message: 'Failed to update user.',
      error: getErrorMessage(typedError)
    });
  }
};

const deleteUser = async (req: RequestWithUser, res: Response) => {
  try {
    const id = String(req.params.id || '');

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid user ID.',
        error: 'The provided ID is not a valid MongoDB ObjectId.'
      });
    }

    if (req.user && String(req.user._id) === id) {
      return res.status(400).json({
        message: 'You cannot delete your own admin account.',
        error: 'Admin self-deletion is not allowed.'
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
        error: 'No user record exists for the provided ID.'
      });
    }

    const foodCount = await Food.countDocuments({ owner: user._id });

    await Promise.all([
      Food.deleteMany({ owner: user._id }),
      GoalCycle.deleteMany({ owner: user._id }),
      DailyLog.deleteMany({ owner: user._id }),
      JournalEntry.deleteMany({ owner: user._id })
    ]);
    await user.deleteOne();

    return res.status(200).json({
      message: 'User deleted successfully.',
      data: {
        ...toSafeUser(user),
        foodCount
      }
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to delete user.',
      error: getErrorMessage(error)
    });
  }
};

export {
  getUsers,
  getUserById,
  updateUser,
  deleteUser
};

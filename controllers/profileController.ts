import type { Request, Response } from 'express';
import User from '../models/User';
import { AvatarUploadError, removeLocalUploadedAvatar, saveUploadedAvatar } from '../utils/avatarUpload';

type RequestWithUser = Request & {
  user?: any;
};

class RequestValidationError extends Error {}

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const getValidationMessage = (error: any): string => {
  const messages = Object.values(error.errors || {}).map((item: any) => item.message);
  return messages[0] || 'Validation failed.';
};

const getCurrentUserId = (req: RequestWithUser): string => {
  return String(req.user?._id || '');
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

const parseRequiredNormalizedField = (value: unknown, fieldLabel: string): string => {
  const normalizedValue = getNormalizedValue(value);

  if (!normalizedValue) {
    throw new RequestValidationError(`${fieldLabel} cannot be empty.`);
  }

  return normalizedValue;
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

const ensureProfileUser = async (req: RequestWithUser, includePassword = false) => {
  const userId = getCurrentUserId(req);

  if (!userId) {
    return null;
  }

  const query = User.findById(userId);

  if (includePassword) {
    query.select('+password');
  }

  return query;
};

const getProfile = async (req: RequestWithUser, res: Response) => {
  try {
    const user = await ensureProfileUser(req);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
        error: 'No user record exists for the current token.'
      });
    }

    return res.status(200).json({
      message: 'Profile fetched successfully.',
      data: toSafeUser(user)
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to fetch profile.',
      error: getErrorMessage(error)
    });
  }
};

const updateProfile = async (req: RequestWithUser, res: Response) => {
  try {
    const user = await ensureProfileUser(req);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
        error: 'No user record exists for the current token.'
      });
    }

    const updates: Record<string, unknown> = {};

    if (req.body.username !== undefined) {
      updates.username = parseRequiredNormalizedField(req.body.username, 'Username');
    }

    if (req.body.email !== undefined) {
      updates.email = parseRequiredNormalizedField(req.body.email, 'Email');
    }

    if (req.body.bio !== undefined) {
      updates.bio = parseOptionalTextField(req.body.bio, 'Bio');
    }

    if (req.body.height !== undefined) {
      updates.height = parseOptionalNonNegativeNumber(req.body.height, 'Height');
    }

    if (req.body.age !== undefined) {
      updates.age = parseOptionalNonNegativeNumber(req.body.age, 'Age');
    }

    if (req.body.weight !== undefined) {
      updates.weight = parseOptionalNonNegativeNumber(req.body.weight, 'Weight');
    }

    if (req.body.targetWeight !== undefined) {
      updates.targetWeight = parseOptionalNonNegativeNumber(req.body.targetWeight, 'Target weight');
    }

    if (req.body.dailyCalorieGoal !== undefined) {
      updates.dailyCalorieGoal = parseOptionalNonNegativeNumber(req.body.dailyCalorieGoal, 'Daily calorie goal');
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        message: 'No valid profile fields provided.',
        error: 'Allowed fields: username, email, bio, height, age, weight, targetWeight, dailyCalorieGoal.'
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
          error: 'Duplicate profile identity field.'
        });
      }
    }

    Object.entries(updates).forEach(([key, value]) => {
      user.set(key, value);
    });

    if (updates.username && user.avatarType === 'default') {
      user.avatarSeed = createAvatarSeed(updates.username);
    }

    await user.save();

    return res.status(200).json({
      message: 'Profile updated successfully.',
      data: toSafeUser(user)
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError instanceof RequestValidationError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid profile input.'
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
        error: 'Duplicate profile identity field.'
      });
    }

    return res.status(500).json({
      message: 'Failed to update profile.',
      error: getErrorMessage(typedError)
    });
  }
};

const updateProfilePassword = async (req: RequestWithUser, res: Response) => {
  try {
    const user = await ensureProfileUser(req, true);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
        error: 'No user record exists for the current token.'
      });
    }

    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    const confirmPassword = req.body.confirmPassword;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Current password and new password are required.',
        error: 'Missing password update fields.'
      });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        message: 'Password confirmation does not match the new password.',
        error: 'Invalid password confirmation.'
      });
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        message: 'Current password is incorrect.',
        error: 'Password verification failed.'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: 'New password must be different from the current password.',
        error: 'Invalid new password.'
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      message: 'Password updated successfully.',
      data: toSafeUser(user)
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError.name === 'ValidationError') {
      return res.status(400).json({
        message: getValidationMessage(typedError),
        error: getErrorMessage(typedError)
      });
    }

    return res.status(500).json({
      message: 'Failed to update password.',
      error: getErrorMessage(typedError)
    });
  }
};

const updateProfileAvatar = async (req: RequestWithUser, res: Response) => {
  try {
    const user = await ensureProfileUser(req);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
        error: 'No user record exists for the current token.'
      });
    }

    const requestedType = req.body.avatarType === undefined
      ? undefined
      : String(req.body.avatarType).trim().toLowerCase();
    const avatarUrl = parseOptionalTextField(req.body.avatarUrl, 'Avatar URL');
    const avatarSeed = req.body.avatarSeed === undefined
      ? undefined
      : createAvatarSeed(req.body.avatarSeed || user.username);
    const avatarDataUrl = req.body.avatarDataUrl;

    if (requestedType !== undefined && !['default', 'uploaded'].includes(requestedType)) {
      return res.status(400).json({
        message: 'Avatar type must be default or uploaded.',
        error: 'Invalid avatar type.'
      });
    }

    if (
      requestedType === undefined &&
      avatarUrl === undefined &&
      avatarSeed === undefined &&
      avatarDataUrl === undefined
    ) {
      return res.status(400).json({
        message: 'No valid avatar fields provided.',
        error: 'Provide avatarType, avatarUrl, avatarSeed, or avatarDataUrl.'
      });
    }

    if (avatarDataUrl !== undefined) {
      const uploadedAvatar = await saveUploadedAvatar(user, avatarDataUrl);
      user.avatarType = uploadedAvatar.avatarType;
      user.avatarUrl = uploadedAvatar.avatarUrl;
      user.avatarSeed = avatarSeed || uploadedAvatar.avatarSeed;
    } else if (requestedType === 'uploaded' || (requestedType === undefined && avatarUrl)) {
      if (!avatarUrl) {
        return res.status(400).json({
          message: 'Avatar URL is required when avatar type is uploaded.',
          error: 'Missing uploaded avatar URL.'
        });
      }

      if (user.avatarType === 'uploaded' && user.avatarUrl && user.avatarUrl !== avatarUrl) {
        await removeLocalUploadedAvatar(user.avatarUrl);
      }

      user.avatarType = 'uploaded';
      user.avatarUrl = avatarUrl;

      if (avatarSeed !== undefined) {
        user.avatarSeed = avatarSeed;
      }
    } else {
      if (user.avatarType === 'uploaded' && user.avatarUrl) {
        await removeLocalUploadedAvatar(user.avatarUrl);
      }

      user.avatarType = 'default';
      user.avatarUrl = null;
      user.avatarSeed = avatarSeed || createAvatarSeed(user.username);
    }

    await user.save();

    return res.status(200).json({
      message: 'Avatar updated successfully.',
      data: toSafeUser(user)
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError instanceof AvatarUploadError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid avatar upload.'
      });
    }

    if (typedError instanceof RequestValidationError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid avatar input.'
      });
    }

    if (typedError.name === 'ValidationError') {
      return res.status(400).json({
        message: getValidationMessage(typedError),
        error: getErrorMessage(typedError)
      });
    }

    return res.status(500).json({
      message: 'Failed to update avatar.',
      error: getErrorMessage(typedError)
    });
  }
};

const deleteProfileAvatar = async (req: RequestWithUser, res: Response) => {
  try {
    const user = await ensureProfileUser(req);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
        error: 'No user record exists for the current token.'
      });
    }

    if (user.avatarType === 'uploaded' && user.avatarUrl) {
      await removeLocalUploadedAvatar(user.avatarUrl);
    }

    user.avatarType = 'default';
    user.avatarUrl = null;
    user.avatarSeed = createAvatarSeed(user.username);

    await user.save();

    return res.status(200).json({
      message: 'Avatar reset successfully.',
      data: toSafeUser(user)
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to delete avatar.',
      error: getErrorMessage(error)
    });
  }
};

export {
  getProfile,
  updateProfile,
  updateProfilePassword,
  updateProfileAvatar,
  deleteProfileAvatar
};

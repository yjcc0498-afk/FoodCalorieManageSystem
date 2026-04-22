import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Food from '../models/Food';
import User from '../models/User';

type RequestWithUser = Request & {
  user?: any;
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const normalizeUsername = (username: unknown): string => {
  return typeof username === 'string' ? username.trim().toLowerCase() : '';
};

const normalizeEmail = (email: unknown): string => {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
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

const getUsers = async (_req: RequestWithUser, res: Response) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    return res.status(200).json({
      count: users.length,
      data: users.map((user: any) => toSafeUser(user))
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to fetch users.',
      error: getErrorMessage(error)
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

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
        error: 'No user record exists for the provided ID.'
      });
    }

    return res.status(200).json({
      data: toSafeUser(user)
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

    const updates: Record<string, any> = {};

    if (req.body.username !== undefined) {
      updates.username = normalizeUsername(req.body.username);

      if (!updates.username) {
        return res.status(400).json({
          message: 'Username cannot be empty.',
          error: 'Invalid username value.'
        });
      }
    }

    if (req.body.email !== undefined) {
      updates.email = normalizeEmail(req.body.email);

      if (!updates.email) {
        return res.status(400).json({
          message: 'Email cannot be empty.',
          error: 'Invalid email value.'
        });
      }
    }

    if (req.body.role !== undefined) {
      updates.role = String(req.body.role).trim().toLowerCase();

      if (!['user', 'admin'].includes(updates.role)) {
        return res.status(400).json({
          message: 'Role must be user or admin.',
          error: 'Invalid role value.'
        });
      }
    }

    if (req.body.password !== undefined) {
      const nextPassword = typeof req.body.password === 'string' ? req.body.password : '';

      if (!nextPassword) {
        return res.status(400).json({
          message: 'Password cannot be empty.',
          error: 'Invalid password value.'
        });
      }

      updates.password = await bcrypt.hash(nextPassword, 10);
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        message: 'No valid update fields provided.',
        error: 'Allowed fields: username, email, role, password.'
      });
    }

    if (updates.username || updates.email) {
      const duplicateFilters: Record<string, any>[] = [];

      if (updates.username) {
        duplicateFilters.push({ username: updates.username });
      }

      if (updates.email) {
        duplicateFilters.push({ email: updates.email });
      }

      const duplicateUser = await User.findOne({
        _id: { $ne: id },
        $or: duplicateFilters
      });

      if (duplicateUser) {
        return res.status(409).json({
          message: 'Username or email is already in use.',
          error: 'Duplicate user identity field.'
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!updatedUser) {
      return res.status(404).json({
        message: 'User not found.',
        error: 'No user record exists for the provided ID.'
      });
    }

    return res.status(200).json({
      message: 'User updated successfully.',
      data: toSafeUser(updatedUser)
    });
  } catch (error: unknown) {
    const typedError = error as any;

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

    await Food.deleteMany({ owner: user._id });
    await user.deleteOne();

    return res.status(200).json({
      message: 'User deleted successfully.',
      data: toSafeUser(user)
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

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Food = require('../models/Food');
const User = require('../models/User');

const normalizeUsername = (username) => {
  return typeof username === 'string' ? username.trim().toLowerCase() : '';
};

const normalizeEmail = (email) => {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

const toSafeUser = (user) => {
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

const getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    return res.status(200).json({
      count: users.length,
      data: users.map((user) => toSafeUser(user))
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch users.',
      error: error.message
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

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
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch user.',
      error: error.message
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid user ID.',
        error: 'The provided ID is not a valid MongoDB ObjectId.'
      });
    }

    const updates = {};

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
      const duplicateFilters = [];

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
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Username or email is already in use.',
        error: 'Duplicate user identity field.'
      });
    }

    return res.status(500).json({
      message: 'Failed to update user.',
      error: error.message
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

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
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to delete user.',
      error: error.message
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateUser,
  deleteUser
};

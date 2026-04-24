import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import Food from '../models/Food';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'name', 'calories']);

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const parsePositiveInteger = (value: unknown): number | null => {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return Number.NaN;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return Number.NaN;
  }

  return parsedValue;
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

const createFood = async (req: Request, res: Response) => {
  try {
    const { name, calories } = req.body;

    if (!name) {
      return res.status(400).json({
        message: 'Name is required.',
        error: 'Missing required field: name.'
      });
    }

    if (calories !== undefined && (Number.isNaN(Number(calories)) || Number(calories) < 0)) {
      return res.status(400).json({
        message: 'Calories must be a valid non-negative number.',
        error: 'Invalid calories value.'
      });
    }

    const payload: Record<string, unknown> = {
      name,
      owner: req.user._id
    };

    if (calories !== undefined) {
      payload.calories = Number(calories);
    }

    const food = await Food.create(payload);

    return res.status(201).json({
      message: 'Food created successfully.',
      data: food
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to create food.',
      error: getErrorMessage(error)
    });
  }
};

const getAllFoods = async (req: Request, res: Response) => {
  try {
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '';
    const rawPage = parsePositiveInteger(req.query.page);
    const rawLimit = parsePositiveInteger(req.query.limit);
    const rawCaloriesMin = parseNonNegativeNumber(req.query.caloriesMin);
    const rawCaloriesMax = parseNonNegativeNumber(req.query.caloriesMax);
    const sortBy = typeof req.query.sortBy === 'string' && req.query.sortBy.trim()
      ? req.query.sortBy.trim()
      : 'createdAt';
    const order = typeof req.query.order === 'string' && req.query.order.trim()
      ? req.query.order.trim().toLowerCase()
      : 'desc';

    if (rawPage !== null && Number.isNaN(rawPage)) {
      return res.status(400).json({
        message: 'Page must be a positive integer.',
        error: 'Invalid page query value.'
      });
    }

    if (rawLimit !== null && Number.isNaN(rawLimit)) {
      return res.status(400).json({
        message: 'Limit must be a positive integer.',
        error: 'Invalid limit query value.'
      });
    }

    if (rawCaloriesMin !== null && Number.isNaN(rawCaloriesMin)) {
      return res.status(400).json({
        message: 'caloriesMin must be a valid non-negative number.',
        error: 'Invalid caloriesMin query value.'
      });
    }

    if (rawCaloriesMax !== null && Number.isNaN(rawCaloriesMax)) {
      return res.status(400).json({
        message: 'caloriesMax must be a valid non-negative number.',
        error: 'Invalid caloriesMax query value.'
      });
    }

    if (!ALLOWED_SORT_FIELDS.has(sortBy)) {
      return res.status(400).json({
        message: 'sortBy must be one of: createdAt, updatedAt, name, calories.',
        error: 'Invalid sortBy query value.'
      });
    }

    if (order !== 'asc' && order !== 'desc') {
      return res.status(400).json({
        message: 'order must be either asc or desc.',
        error: 'Invalid order query value.'
      });
    }

    if (
      rawCaloriesMin !== null &&
      rawCaloriesMax !== null &&
      rawCaloriesMin > rawCaloriesMax
    ) {
      return res.status(400).json({
        message: 'caloriesMin cannot be greater than caloriesMax.',
        error: 'Invalid calories range.'
      });
    }

    const filter: Record<string, any> = {
      owner: req.user._id
    };

    if (keyword) {
      filter.name = {
        $regex: escapeRegex(keyword.toLowerCase()),
        $options: 'i'
      };
    }

    if (rawCaloriesMin !== null || rawCaloriesMax !== null) {
      filter.calories = {};

      if (rawCaloriesMin !== null) {
        filter.calories.$gte = rawCaloriesMin;
      }

      if (rawCaloriesMax !== null) {
        filter.calories.$lte = rawCaloriesMax;
      }
    }

    const page = rawPage ?? DEFAULT_PAGE;
    const total = await Food.countDocuments(filter);
    const usesExplicitPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const limit = rawLimit ?? (usesExplicitPagination ? DEFAULT_LIMIT : total || DEFAULT_LIMIT);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder
    };

    if (sortBy !== 'createdAt') {
      sort.createdAt = -1;
    }

    const foods = await Food.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json({
      keyword,
      count: foods.length,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: totalPages > 0 && page < totalPages,
        hasPrevPage: page > 1 && total > 0
      },
      data: foods
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to fetch foods.',
      error: getErrorMessage(error)
    });
  }
};

const updateFoodCalories = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const { calories } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid food ID.',
        error: 'The provided ID is not a valid MongoDB ObjectId.'
      });
    }

    if (calories === undefined || Number.isNaN(Number(calories)) || Number(calories) < 0) {
      return res.status(400).json({
        message: 'Calories must be a valid non-negative number.',
        error: 'Invalid calories value.'
      });
    }

    const updatedFood = await Food.findOneAndUpdate(
      {
        _id: id,
        owner: req.user._id
      },
      { calories: Number(calories) },
      { new: true, runValidators: true }
    );

    if (!updatedFood) {
      return res.status(404).json({
        message: 'Food not found.',
        error: 'No owned food record exists for the provided ID.'
      });
    }

    return res.status(200).json({
      message: 'Food calories updated successfully.',
      data: updatedFood
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to update food calories.',
      error: getErrorMessage(error)
    });
  }
};

const deleteFood = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid food ID.',
        error: 'The provided ID is not a valid MongoDB ObjectId.'
      });
    }

    const deletedFood = await Food.findOneAndDelete({
      _id: id,
      owner: req.user._id
    });

    if (!deletedFood) {
      return res.status(404).json({
        message: 'Food not found.',
        error: 'No owned food record exists for the provided ID.'
      });
    }

    return res.status(200).json({
      message: 'Food deleted successfully.',
      data: deletedFood
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to delete food.',
      error: getErrorMessage(error)
    });
  }
};

export {
  createFood,
  getAllFoods,
  updateFoodCalories,
  deleteFood
};

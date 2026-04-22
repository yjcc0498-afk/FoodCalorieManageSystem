import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import Food from '../models/Food';

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
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
    const { keyword } = req.query;
    const filter: Record<string, any> = {
      owner: req.user._id
    };

    if (typeof keyword === 'string' && keyword.trim()) {
      filter.name = {
        $regex: keyword.trim().toLowerCase(),
        $options: 'i'
      };
    }

    const foods = await Food.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      keyword: typeof keyword === 'string' ? keyword.trim() : '',
      count: foods.length,
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

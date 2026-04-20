const mongoose = require('mongoose');
const Food = require('../models/Food');

const createFood = async (req, res) => {
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

    const payload = {
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
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to create food.',
      error: error.message
    });
  }
};

const getAllFoods = async (req, res) => {
  try {
    const { keyword } = req.query;
    const filter = {
      owner: req.user._id
    };

    if (keyword && keyword.trim()) {
      filter.name = {
        $regex: keyword.trim().toLowerCase(),
        $options: 'i'
      };
    }

    const foods = await Food.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      keyword: keyword ? keyword.trim() : '',
      count: foods.length,
      data: foods
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch foods.',
      error: error.message
    });
  }
};

const updateFoodCalories = async (req, res) => {
  try {
    const { id } = req.params;
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
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update food calories.',
      error: error.message
    });
  }
};

const deleteFood = async (req, res) => {
  try {
    const { id } = req.params;

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
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to delete food.',
      error: error.message
    });
  }
};

module.exports = {
  createFood,
  getAllFoods,
  updateFoodCalories,
  deleteFood
};

// This file defines the Food model and its schema validation rules.
//数据模型

const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Food name is required.'],
      trim: true,
      lowercase: true
    },
    calories: {
      type: Number,
      default: 0,
      min: [0, 'Calories cannot be negative.']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Food', foodSchema);

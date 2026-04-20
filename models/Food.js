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
    },
    // Keep ownership in the model layer so request handlers can safely scope data per user.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Food owner is required.']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Food', foodSchema);

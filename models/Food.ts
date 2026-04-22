import mongoose = require('mongoose');

interface IFood {
  name: string;
  calories: number;
  owner: mongoose.Types.ObjectId;
}

const foodSchema = new mongoose.Schema<IFood>(
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

const Food = mongoose.model<IFood>('Food', foodSchema);

export = Food;

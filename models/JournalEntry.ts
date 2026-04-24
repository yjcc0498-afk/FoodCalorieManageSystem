import mongoose = require('mongoose');

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface IJournalEntry {
  owner: mongoose.Types.ObjectId;
  date: Date;
  mealType: MealType;
  foodName: string;
  calories: number;
  quantity: number;
  foodId?: mongoose.Types.ObjectId | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const journalEntrySchema = new mongoose.Schema<IJournalEntry>(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Journal entry owner is required.'],
      index: true
    },
    date: {
      type: Date,
      required: [true, 'Journal entry date is required.'],
      index: true
    },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      required: [true, 'Meal type is required.']
    },
    foodName: {
      type: String,
      required: [true, 'Food name is required.'],
      trim: true
    },
    calories: {
      type: Number,
      required: [true, 'Calories are required.'],
      min: [0, 'Calories cannot be negative.']
    },
    quantity: {
      type: Number,
      default: 1,
      min: [0, 'Quantity cannot be negative.']
    },
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Food',
      default: null
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters.'],
      default: null
    }
  },
  {
    timestamps: true
  }
);

journalEntrySchema.pre('validate', function normalizeJournalEntry(next) {
  if (typeof this.foodName === 'string') {
    this.foodName = this.foodName.trim();
  }

  return next();
});

const JournalEntry = mongoose.model<IJournalEntry>('JournalEntry', journalEntrySchema);

export = JournalEntry;

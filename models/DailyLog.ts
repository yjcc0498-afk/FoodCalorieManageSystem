import mongoose = require('mongoose');

interface IDailyLog {
  owner: mongoose.Types.ObjectId;
  date: Date;
  weight?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const dailyLogSchema = new mongoose.Schema<IDailyLog>(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Daily log owner is required.'],
      index: true
    },
    date: {
      type: Date,
      required: [true, 'Daily log date is required.'],
      index: true
    },
    weight: {
      type: Number,
      min: [0, 'Weight cannot be negative.'],
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

dailyLogSchema.index({ owner: 1, date: 1 }, { unique: true });

const DailyLog = mongoose.model<IDailyLog>('DailyLog', dailyLogSchema);

export = DailyLog;

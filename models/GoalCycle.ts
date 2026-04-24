import mongoose = require('mongoose');

type GoalCycleStatus = 'active' | 'completed' | 'archived';

interface IGoalCycle {
  owner: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  startWeight: number;
  targetWeight: number;
  dailyCalorieGoal: number;
  status: GoalCycleStatus;
  createdAt: Date;
  updatedAt: Date;
}

const goalCycleSchema = new mongoose.Schema<IGoalCycle>(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Goal cycle owner is required.'],
      index: true
    },
    startDate: {
      type: Date,
      required: [true, 'Goal cycle start date is required.']
    },
    endDate: {
      type: Date,
      required: [true, 'Goal cycle end date is required.']
    },
    startWeight: {
      type: Number,
      required: [true, 'Goal cycle start weight is required.'],
      min: [0, 'Start weight cannot be negative.']
    },
    targetWeight: {
      type: Number,
      required: [true, 'Goal cycle target weight is required.'],
      min: [0, 'Target weight cannot be negative.']
    },
    dailyCalorieGoal: {
      type: Number,
      required: [true, 'Goal cycle daily calorie goal is required.'],
      min: [0, 'Daily calorie goal cannot be negative.']
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      default: 'active',
      index: true
    }
  },
  {
    timestamps: true
  }
);

goalCycleSchema.index(
  { owner: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'active'
    }
  }
);

goalCycleSchema.pre('validate', function validateGoalCycle(next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    return next(new Error('Goal cycle end date cannot be earlier than start date.'));
  }

  return next();
});

const GoalCycle = mongoose.model<IGoalCycle>('GoalCycle', goalCycleSchema);

export = GoalCycle;

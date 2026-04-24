import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import GoalCycle from '../models/GoalCycle';
import DailyLog from '../models/DailyLog';
import JournalEntry from '../models/JournalEntry';
import User from '../models/User';
import {
  formatDateKey,
  getTodayDateKey,
  getUtcDayRange,
  getUtcMonthRange,
  parseDateKey,
  parseMonthKey
} from '../utils/date';

type RequestWithUser = Request & {
  user?: any;
};

class RequestValidationError extends Error {}

const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const toObjectIdString = (value: unknown) => String(value || '');

const getCurrentUserId = (req: RequestWithUser) => toObjectIdString(req.user?._id);

const parseRequiredDate = (value: unknown, fieldLabel: string): Date => {
  const parsedDate = parseDateKey(value);

  if (!parsedDate) {
    throw new RequestValidationError(`${fieldLabel} must be in YYYY-MM-DD format.`);
  }

  return parsedDate;
};

const parseRequiredNonNegativeNumber = (value: unknown, fieldLabel: string): number => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new RequestValidationError(`${fieldLabel} must be a valid non-negative number.`);
  }

  return parsedValue;
};

const resolveWeightProgress = (
  goalCycle: any | null,
  dailyLog: any | null,
  selectedDate: Date
) => {
  if (!goalCycle) {
    return null;
  }

  const startTime = new Date(goalCycle.startDate).getTime();
  const endTime = new Date(goalCycle.endDate).getTime();
  const selectedTime = selectedDate.getTime();
  const totalDuration = Math.max(1, endTime - startTime);
  const clampedProgress = Math.min(1, Math.max(0, (selectedTime - startTime) / totalDuration));
  const expectedWeight = goalCycle.startWeight + ((goalCycle.targetWeight - goalCycle.startWeight) * clampedProgress);
  const actualWeight = dailyLog?.weight ?? null;
  const variance = actualWeight === null ? null : Number((actualWeight - expectedWeight).toFixed(2));
  const totalWeightDelta = goalCycle.targetWeight - goalCycle.startWeight;

  let actualProgressRatio: number | null = null;

  if (actualWeight !== null) {
    if (totalWeightDelta === 0) {
      actualProgressRatio = actualWeight === goalCycle.targetWeight ? 1 : 0;
    } else {
      const rawActualProgress = (actualWeight - goalCycle.startWeight) / totalWeightDelta;
      actualProgressRatio = Number(Math.min(1, Math.max(0, rawActualProgress)).toFixed(4));
    }
  }

  return {
    expectedWeight: Number(expectedWeight.toFixed(2)),
    actualWeight,
    variance,
    progressRatio: Number(clampedProgress.toFixed(4)),
    actualProgressRatio
  };
};

const buildGoalDayPayload = async (userId: string, dateKey: string, monthKey?: string | null) => {
  const selectedDate = parseDateKey(dateKey);

  if (!selectedDate) {
    throw new RequestValidationError('date must be in YYYY-MM-DD format.');
  }

  const { start, end } = getUtcDayRange(selectedDate);

  const goalCycle = await GoalCycle.findOne({
    owner: userId,
    status: 'active'
  }).sort({ updatedAt: -1 });

  const dailyLog = await DailyLog.findOne({
    owner: userId,
    date: {
      $gte: start,
      $lt: end
    }
  });

  const journalEntries = await JournalEntry.find({
    owner: userId,
    date: {
      $gte: start,
      $lt: end
    }
  }).sort({ date: 1, mealType: 1, createdAt: 1 });

  const actualCalories = journalEntries.reduce((sum, item) => sum + Number(item.calories || 0), 0);
  const targetCalories = goalCycle ? Number(goalCycle.dailyCalorieGoal || 0) : 0;
  const remainingCalories = targetCalories - actualCalories;
  const weightProgress = resolveWeightProgress(goalCycle, dailyLog, selectedDate);

  let monthIndicators: Array<Record<string, unknown>> = [];

  if (monthKey) {
    const parsedMonth = parseMonthKey(monthKey);

    if (!parsedMonth) {
      throw new RequestValidationError('month must be in YYYY-MM format.');
    }

    const monthRange = getUtcMonthRange(parsedMonth.year, parsedMonth.month);
    const [monthLogs, monthEntries] = await Promise.all([
      DailyLog.find({
        owner: userId,
        date: {
          $gte: monthRange.start,
          $lt: monthRange.end
        }
      }).select('date weight'),
      JournalEntry.aggregate([
        {
          $match: {
            owner: new mongoose.Types.ObjectId(userId),
            date: {
              $gte: monthRange.start,
              $lt: monthRange.end
            }
          }
        },
        {
          $group: {
            _id: '$date',
            actualCalories: { $sum: '$calories' },
            entryCount: { $sum: 1 }
          }
        }
      ])
    ]);

    const logMap = new Map(monthLogs.map((item) => [formatDateKey(item.date), item]));
    const entryMap = new Map(monthEntries.map((item) => [formatDateKey(item._id), item]));
    const monthStatusKeys = new Set<string>([
      ...logMap.keys(),
      ...entryMap.keys()
    ]);

    monthIndicators = Array.from(monthStatusKeys).sort().map((key) => {
      const log = logMap.get(key);
      const entrySummary = entryMap.get(key);
      const actual = Number(entrySummary?.actualCalories || 0);

      return {
        date: key,
        hasDailyLog: Boolean(log),
        hasJournalEntries: Number(entrySummary?.entryCount || 0) > 0,
        actualCalories: actual,
        overGoal: targetCalories > 0 ? actual > targetCalories : false
      };
    });
  }

  return {
    date: dateKey,
    goalCycle,
    dailyLog,
    journalEntries,
    monthIndicators,
    summary: {
      actualCalories,
      targetCalories,
      remainingCalories,
      weightProgress
    }
  };
};

const syncCompatibilityGoalFields = async (userId: string, goalCycle: any) => {
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        targetWeight: goalCycle.targetWeight,
        dailyCalorieGoal: goalCycle.dailyCalorieGoal,
        ...(goalCycle.startWeight !== undefined ? { weight: goalCycle.startWeight } : {})
      }
    }
  );
};

const getActiveGoalCycle = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const goalCycle = await GoalCycle.findOne({
      owner: userId,
      status: 'active'
    }).sort({ updatedAt: -1 });

    return res.status(200).json({
      message: 'Active goal cycle fetched successfully.',
      data: goalCycle
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to fetch active goal cycle.',
      error: getErrorMessage(error)
    });
  }
};

const createGoalCycle = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const startDate = parseRequiredDate(req.body.startDate, 'Start date');
    const endDate = parseRequiredDate(req.body.endDate, 'End date');
    const startWeight = parseRequiredNonNegativeNumber(req.body.startWeight, 'Start weight');
    const targetWeight = parseRequiredNonNegativeNumber(req.body.targetWeight, 'Target weight');
    const dailyCalorieGoal = parseRequiredNonNegativeNumber(req.body.dailyCalorieGoal, 'Daily calorie goal');

    await GoalCycle.updateMany(
      {
        owner: userId,
        status: 'active'
      },
      {
        $set: {
          status: 'archived'
        }
      }
    );

    const goalCycle = await GoalCycle.create({
      owner: userId,
      startDate,
      endDate,
      startWeight,
      targetWeight,
      dailyCalorieGoal,
      status: 'active'
    });

    await syncCompatibilityGoalFields(userId, goalCycle);

    return res.status(201).json({
      message: 'Goal cycle created successfully.',
      data: goalCycle
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError instanceof RequestValidationError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid goal cycle input.'
      });
    }

    if (typedError.name === 'ValidationError') {
      return res.status(400).json({
        message: typedError.message,
        error: getErrorMessage(typedError)
      });
    }

    return res.status(500).json({
      message: 'Failed to create goal cycle.',
      error: getErrorMessage(typedError)
    });
  }
};

const updateGoalCycle = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const id = String(req.params.id || '');

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid goal cycle ID.',
        error: 'The provided goal cycle ID is not a valid MongoDB ObjectId.'
      });
    }

    const goalCycle = await GoalCycle.findOne({
      _id: id,
      owner: userId
    });

    if (!goalCycle) {
      return res.status(404).json({
        message: 'Goal cycle not found.',
        error: 'No owned goal cycle exists for the provided ID.'
      });
    }

    if (req.body.startDate !== undefined) {
      goalCycle.startDate = parseRequiredDate(req.body.startDate, 'Start date');
    }

    if (req.body.endDate !== undefined) {
      goalCycle.endDate = parseRequiredDate(req.body.endDate, 'End date');
    }

    if (req.body.startWeight !== undefined) {
      goalCycle.startWeight = parseRequiredNonNegativeNumber(req.body.startWeight, 'Start weight');
    }

    if (req.body.targetWeight !== undefined) {
      goalCycle.targetWeight = parseRequiredNonNegativeNumber(req.body.targetWeight, 'Target weight');
    }

    if (req.body.dailyCalorieGoal !== undefined) {
      goalCycle.dailyCalorieGoal = parseRequiredNonNegativeNumber(req.body.dailyCalorieGoal, 'Daily calorie goal');
    }

    if (req.body.status !== undefined) {
      const nextStatus = String(req.body.status).trim().toLowerCase();

      if (!['active', 'completed', 'archived'].includes(nextStatus)) {
        throw new RequestValidationError('Status must be active, completed, or archived.');
      }

      if (nextStatus === 'active') {
        await GoalCycle.updateMany(
          {
            owner: userId,
            status: 'active',
            _id: { $ne: goalCycle._id }
          },
          {
            $set: {
              status: 'archived'
            }
          }
        );
      }

      goalCycle.status = nextStatus as 'active' | 'completed' | 'archived';
    }

    await goalCycle.save();

    if (goalCycle.status === 'active') {
      await syncCompatibilityGoalFields(userId, goalCycle);
    }

    return res.status(200).json({
      message: 'Goal cycle updated successfully.',
      data: goalCycle
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError instanceof RequestValidationError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid goal cycle input.'
      });
    }

    if (typedError.name === 'ValidationError') {
      return res.status(400).json({
        message: typedError.message,
        error: getErrorMessage(typedError)
      });
    }

    return res.status(500).json({
      message: 'Failed to update goal cycle.',
      error: getErrorMessage(typedError)
    });
  }
};

const getGoalDaySummary = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const dateKey = typeof req.query.date === 'string' && req.query.date.trim()
      ? req.query.date.trim()
      : getTodayDateKey();
    const monthKey = typeof req.query.month === 'string' && req.query.month.trim()
      ? req.query.month.trim()
      : null;

    const payload = await buildGoalDayPayload(userId, dateKey, monthKey);

    return res.status(200).json({
      message: 'Goal day summary fetched successfully.',
      data: payload
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError instanceof RequestValidationError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid goal day query.'
      });
    }

    return res.status(500).json({
      message: 'Failed to fetch goal day summary.',
      error: getErrorMessage(typedError)
    });
  }
};

export {
  getActiveGoalCycle,
  createGoalCycle,
  updateGoalCycle,
  getGoalDaySummary
};

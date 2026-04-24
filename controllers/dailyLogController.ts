import type { Request, Response } from 'express';
import DailyLog from '../models/DailyLog';
import User from '../models/User';
import { getTodayDateKey, getUtcDayRange, parseDateKey } from '../utils/date';

type RequestWithUser = Request & {
  user?: any;
};

class RequestValidationError extends Error {}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const parseDateFromQuery = (value: unknown): Date => {
  const fallbackValue = typeof value === 'string' && value.trim() ? value.trim() : getTodayDateKey();
  const parsedDate = parseDateKey(fallbackValue);

  if (!parsedDate) {
    throw new RequestValidationError('date must be in YYYY-MM-DD format.');
  }

  return parsedDate;
};

const parseOptionalNonNegativeNumber = (value: unknown, fieldLabel: string): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new RequestValidationError(`${fieldLabel} must be a valid non-negative number.`);
  }

  return parsedValue;
};

const parseOptionalNotes = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new RequestValidationError('Notes must be a string.');
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
};

const getDailyLog = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = String(req.user?._id || '');
    const selectedDate = parseDateFromQuery(req.query.date);
    const { start, end } = getUtcDayRange(selectedDate);

    const dailyLog = await DailyLog.findOne({
      owner: userId,
      date: {
        $gte: start,
        $lt: end
      }
    });

    return res.status(200).json({
      message: 'Daily log fetched successfully.',
      data: dailyLog
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError instanceof RequestValidationError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid daily log query.'
      });
    }

    return res.status(500).json({
      message: 'Failed to fetch daily log.',
      error: getErrorMessage(typedError)
    });
  }
};

const upsertDailyLog = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = String(req.user?._id || '');
    const selectedDate = parseDateFromQuery(req.query.date);
    const weight = parseOptionalNonNegativeNumber(req.body.weight, 'Weight');
    const notes = parseOptionalNotes(req.body.notes);

    if (weight === undefined && notes === undefined) {
      return res.status(400).json({
        message: 'No valid daily log fields provided.',
        error: 'Allowed fields: weight, notes.'
      });
    }

    const dailyLog = await DailyLog.findOneAndUpdate(
      {
        owner: userId,
        date: selectedDate
      },
      {
        $set: {
          ...(weight !== undefined ? { weight } : {}),
          ...(notes !== undefined ? { notes } : {}),
          owner: userId,
          date: selectedDate
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    if (weight !== undefined && weight !== null) {
      await User.updateOne(
        { _id: userId },
        { $set: { weight } }
      );
    }

    return res.status(200).json({
      message: 'Daily log saved successfully.',
      data: dailyLog
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError instanceof RequestValidationError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid daily log input.'
      });
    }

    if (typedError.name === 'ValidationError') {
      return res.status(400).json({
        message: typedError.message,
        error: getErrorMessage(typedError)
      });
    }

    return res.status(500).json({
      message: 'Failed to save daily log.',
      error: getErrorMessage(typedError)
    });
  }
};

export {
  getDailyLog,
  upsertDailyLog
};

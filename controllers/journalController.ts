import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import Food from '../models/Food';
import JournalEntry from '../models/JournalEntry';
import { getTodayDateKey, getUtcDayRange, parseDateKey } from '../utils/date';

type RequestWithUser = Request & {
  user?: any;
};

class RequestValidationError extends Error {}

const MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const parseDateFromQuery = (value: unknown): Date => {
  const fallbackValue = typeof value === 'string' && value.trim() ? value.trim() : getTodayDateKey();
  const parsedDate = parseDateKey(fallbackValue);

  if (!parsedDate) {
    throw new RequestValidationError('date must be in YYYY-MM-DD format.');
  }

  return parsedDate;
};

const parseRequiredDate = (value: unknown): Date => {
  const parsedDate = parseDateKey(value);

  if (!parsedDate) {
    throw new RequestValidationError('date must be in YYYY-MM-DD format.');
  }

  return parsedDate;
};

const parseMealType = (value: unknown): 'breakfast' | 'lunch' | 'dinner' | 'snack' => {
  const mealType = String(value || '').trim().toLowerCase();

  if (!MEAL_TYPES.has(mealType)) {
    throw new RequestValidationError('mealType must be breakfast, lunch, dinner, or snack.');
  }

  return mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack';
};

const parseRequiredText = (value: unknown, fieldLabel: string): string => {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    throw new RequestValidationError(`${fieldLabel} is required.`);
  }

  return normalizedValue;
};

const parseRequiredNonNegativeNumber = (value: unknown, fieldLabel: string): number => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new RequestValidationError(`${fieldLabel} must be a valid non-negative number.`);
  }

  return parsedValue;
};

const parseOptionalNotes = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new RequestValidationError('notes must be a string.');
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
};

const parseOptionalFoodId = async (value: unknown, ownerId: string): Promise<string | null | undefined> => {
  if (value === undefined || value === null || value === '') {
    return value === undefined ? undefined : null;
  }

  const foodId = String(value);

  if (!mongoose.Types.ObjectId.isValid(foodId)) {
    throw new RequestValidationError('foodId must be a valid MongoDB ObjectId.');
  }

  const ownedFood = await Food.findOne({
    _id: foodId,
    owner: ownerId
  });

  if (!ownedFood) {
    throw new RequestValidationError('foodId must reference one of your foods.');
  }

  return foodId;
};

const listJournalEntries = async (req: RequestWithUser, res: Response) => {
  try {
    const ownerId = String(req.user?._id || '');
    const selectedDate = parseDateFromQuery(req.query.date);
    const { start, end } = getUtcDayRange(selectedDate);
    const journalEntries = await JournalEntry.find({
      owner: ownerId,
      date: {
        $gte: start,
        $lt: end
      }
    }).sort({ mealType: 1, createdAt: 1 });

    return res.status(200).json({
      message: 'Journal entries fetched successfully.',
      count: journalEntries.length,
      data: journalEntries
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError instanceof RequestValidationError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid journal query.'
      });
    }

    return res.status(500).json({
      message: 'Failed to fetch journal entries.',
      error: getErrorMessage(typedError)
    });
  }
};

const createJournalEntry = async (req: RequestWithUser, res: Response) => {
  try {
    const ownerId = String(req.user?._id || '');
    const date = parseRequiredDate(req.body.date);
    const mealType = parseMealType(req.body.mealType);
    const resolvedFoodId = await parseOptionalFoodId(req.body.foodId, ownerId);
    const foodName = parseRequiredText(req.body.foodName, 'foodName');
    const calories = parseRequiredNonNegativeNumber(req.body.calories, 'calories');
    const quantity = parseRequiredNonNegativeNumber(req.body.quantity ?? 1, 'quantity');
    const notes = parseOptionalNotes(req.body.notes);

    const journalEntry = await JournalEntry.create({
      owner: ownerId,
      date,
      mealType,
      foodName,
      calories,
      quantity,
      ...(resolvedFoodId !== undefined ? { foodId: resolvedFoodId } : {}),
      ...(notes !== undefined ? { notes } : {})
    });

    return res.status(201).json({
      message: 'Journal entry created successfully.',
      data: journalEntry
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError instanceof RequestValidationError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid journal entry input.'
      });
    }

    if (typedError.name === 'ValidationError') {
      return res.status(400).json({
        message: typedError.message,
        error: getErrorMessage(typedError)
      });
    }

    return res.status(500).json({
      message: 'Failed to create journal entry.',
      error: getErrorMessage(typedError)
    });
  }
};

const updateJournalEntry = async (req: RequestWithUser, res: Response) => {
  try {
    const ownerId = String(req.user?._id || '');
    const id = String(req.params.id || '');

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid journal entry ID.',
        error: 'The provided journal entry ID is not a valid MongoDB ObjectId.'
      });
    }

    const journalEntry = await JournalEntry.findOne({
      _id: id,
      owner: ownerId
    });

    if (!journalEntry) {
      return res.status(404).json({
        message: 'Journal entry not found.',
        error: 'No owned journal entry exists for the provided ID.'
      });
    }

    if (req.body.date !== undefined) {
      journalEntry.date = parseRequiredDate(req.body.date);
    }

    if (req.body.mealType !== undefined) {
      journalEntry.mealType = parseMealType(req.body.mealType);
    }

    if (req.body.foodName !== undefined) {
      journalEntry.foodName = parseRequiredText(req.body.foodName, 'foodName');
    }

    if (req.body.calories !== undefined) {
      journalEntry.calories = parseRequiredNonNegativeNumber(req.body.calories, 'calories');
    }

    if (req.body.quantity !== undefined) {
      journalEntry.quantity = parseRequiredNonNegativeNumber(req.body.quantity, 'quantity');
    }

    if (req.body.notes !== undefined) {
      journalEntry.notes = parseOptionalNotes(req.body.notes) ?? null;
    }

    if (req.body.foodId !== undefined) {
      const resolvedFoodId = await parseOptionalFoodId(req.body.foodId, ownerId);
      journalEntry.foodId = resolvedFoodId ? new mongoose.Types.ObjectId(resolvedFoodId) : null;
    }

    await journalEntry.save();

    return res.status(200).json({
      message: 'Journal entry updated successfully.',
      data: journalEntry
    });
  } catch (error: unknown) {
    const typedError = error as any;

    if (typedError instanceof RequestValidationError) {
      return res.status(400).json({
        message: typedError.message,
        error: 'Invalid journal entry input.'
      });
    }

    if (typedError.name === 'ValidationError') {
      return res.status(400).json({
        message: typedError.message,
        error: getErrorMessage(typedError)
      });
    }

    return res.status(500).json({
      message: 'Failed to update journal entry.',
      error: getErrorMessage(typedError)
    });
  }
};

const deleteJournalEntry = async (req: RequestWithUser, res: Response) => {
  try {
    const ownerId = String(req.user?._id || '');
    const id = String(req.params.id || '');

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid journal entry ID.',
        error: 'The provided journal entry ID is not a valid MongoDB ObjectId.'
      });
    }

    const deletedEntry = await JournalEntry.findOneAndDelete({
      _id: id,
      owner: ownerId
    });

    if (!deletedEntry) {
      return res.status(404).json({
        message: 'Journal entry not found.',
        error: 'No owned journal entry exists for the provided ID.'
      });
    }

    return res.status(200).json({
      message: 'Journal entry deleted successfully.',
      data: deletedEntry
    });
  } catch (error: unknown) {
    return res.status(500).json({
      message: 'Failed to delete journal entry.',
      error: getErrorMessage(error)
    });
  }
};

export {
  listJournalEntries,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry
};

import express from 'express';
import authMiddleware from '../middleware/authMiddleware';
import {
  createGoalCycle,
  getActiveGoalCycle,
  getGoalDaySummary,
  updateGoalCycle
} from '../controllers/goalsController';

const router = express.Router();

router.use(authMiddleware);

router.get('/active', getActiveGoalCycle);
router.get('/day', getGoalDaySummary);
router.post('/cycle', createGoalCycle);
router.patch('/cycle/:id', updateGoalCycle);

export default router;

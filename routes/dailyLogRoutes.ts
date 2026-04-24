import express from 'express';
import authMiddleware from '../middleware/authMiddleware';
import {
  getDailyLog,
  upsertDailyLog
} from '../controllers/dailyLogController';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getDailyLog);
router.put('/', upsertDailyLog);

export default router;

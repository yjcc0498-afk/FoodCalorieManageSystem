import express from 'express';
import authMiddleware from '../middleware/authMiddleware';
import adminMiddleware from '../middleware/adminMiddleware';
import {
  getAdminOverview,
  getAdminFoods
} from '../controllers/adminController';

const router = express.Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/overview', getAdminOverview);
router.get('/foods', getAdminFoods);

export default router;

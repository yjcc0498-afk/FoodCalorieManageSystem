import express from 'express';
import {
  createFood,
  getAllFoods,
  updateFoodCalories,
  deleteFood
} from '../controllers/foodController';
import authMiddleware from '../middleware/authMiddleware';

const router = express.Router();

router.use(authMiddleware);

router.post('/food', createFood);
router.get('/foods', getAllFoods);
router.patch('/food/:id', updateFoodCalories);
router.delete('/food/:id', deleteFood);

export default router;

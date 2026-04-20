const express = require('express');
const {
  createFood,
  getAllFoods,
  updateFoodCalories,
  deleteFood
} = require('../controllers/foodController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Food data is user-scoped, so every food request must pass JWT auth before reaching the controller.
router.use(authMiddleware);

router.post('/food', createFood);
router.get('/foods', getAllFoods);
router.patch('/food/:id', updateFoodCalories);
router.delete('/food/:id', deleteFood);

module.exports = router;

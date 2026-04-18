// This file maps food-related API routes to controller handlers.
//路由配置

const express = require('express');
const {
  createFood,
  getAllFoods,
  updateFoodCalories,
  deleteFood
} = require('../controllers/foodController');

const router = express.Router();

router.post('/food', createFood);
router.get('/foods', getAllFoods);
router.patch('/food/:id', updateFoodCalories);
router.delete('/food/:id', deleteFood);

module.exports = router;

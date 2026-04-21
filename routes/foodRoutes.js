//



const express = require('express');
const {
  createFood,
  getAllFoods,
  updateFoodCalories,
  deleteFood
} = require('../controllers/foodController');

// JWT 鉴权中间件（统一保护整个模块）
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Food data is user-scoped, so every food request must pass JWT auth before reaching the controller.
// ===============================
// 全局中间件（关键）
// ===============================
// 作用：
// 👉 下面所有路由都必须先通过 JWT 验证
//
// 等价于：
// router.post(...) → 先 authMiddleware → 再 controller
// ===============================
router.use(authMiddleware);

router.post('/food', createFood);
router.get('/foods', getAllFoods);
router.patch('/food/:id', updateFoodCalories);
router.delete('/food/:id', deleteFood);

module.exports = router;

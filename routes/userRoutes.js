const express = require('express');
const {
  getUsers,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/userController');
// JWT 鉴权（必须登录）
const authMiddleware = require('../middleware/authMiddleware');
// 管理员权限校验（role === admin）
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();


// ===============================
// 全局鉴权链（重点🔥）
// ===============================
//
// 请求必须满足：
// 1. 已登录（authMiddleware）
// 2. 是管理员（adminMiddleware）
// ===============================
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/', getUsers);
router.get('/:id', getUserById);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;

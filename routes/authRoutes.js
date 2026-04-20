const express = require('express');
const {
  register,
  login,
  getCurrentUser
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { loginRateLimitMiddleware } = require('../middleware/loginRateLimitMiddleware');

const router = express.Router();

router.post('/auth/register', register);
router.post('/auth/login', loginRateLimitMiddleware, login);
router.get('/auth/me', authMiddleware, getCurrentUser);

module.exports = router;

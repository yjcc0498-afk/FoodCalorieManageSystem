import express from 'express';
import {
  register,
  login,
  getCurrentUser
} from '../controllers/authController';
import authMiddleware from '../middleware/authMiddleware';
import loginRateLimitModule = require('../middleware/loginRateLimitMiddleware');

const router = express.Router();
const { loginRateLimitMiddleware } = loginRateLimitModule;

router.post('/auth/register', register);
router.post('/auth/login', loginRateLimitMiddleware, login);
router.get('/auth/me', authMiddleware, getCurrentUser);

export default router;

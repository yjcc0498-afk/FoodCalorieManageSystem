import express from 'express';
import authMiddleware from '../middleware/authMiddleware';
import {
  getProfile,
  updateProfile,
  updateProfilePassword,
  updateProfileAvatar,
  deleteProfileAvatar
} from '../controllers/profileController';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getProfile);
router.patch('/', updateProfile);
router.patch('/password', updateProfilePassword);
router.patch('/avatar', updateProfileAvatar);
router.delete('/avatar', deleteProfileAvatar);

export default router;

const express = require('express');
const {
  getUsers,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/', getUsers);
router.get('/:id', getUserById);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;

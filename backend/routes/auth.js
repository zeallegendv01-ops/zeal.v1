const express = require('express');
const { register, login, getMe, updateProfile, getAllUsers, getUserById, verifyEmail, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

// Admin routes
router.get('/users', protect, getAllUsers);
router.get('/users/:id', protect, getUserById);

module.exports = router;

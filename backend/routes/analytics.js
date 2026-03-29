const express = require('express');
const { getDashboardAnalytics, getUserAnalytics } = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Admin analytics - all products and orders
router.get('/dashboard', protect, getDashboardAnalytics);

// User analytics - personal transactions
router.get('/user', protect, getUserAnalytics);

module.exports = router;

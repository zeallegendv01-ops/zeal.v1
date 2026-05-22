const express = require('express');
const { getDashboardAnalytics, getUserAnalytics } = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public analytics endpoint for product dashboard charts
router.get('/dashboard', getDashboardAnalytics);

// User analytics - personal transactions
router.get('/user', protect, getUserAnalytics);

module.exports = router;

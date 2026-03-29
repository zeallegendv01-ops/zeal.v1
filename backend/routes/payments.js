const express = require('express');
const { initializePayment, verifyPayment, handleWebhook } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Webhook endpoint (no auth needed)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Protected routes
router.post('/initialize', protect, initializePayment);
router.get('/verify/:reference', protect, verifyPayment);

module.exports = router;
const express = require('express');
const { initializePayment, verifyPayment, handleWebhook, getOrderInvoice, handlePaymentSuccess } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Webhook endpoint (no auth needed)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Payment success callback (no auth needed - from Paystack redirect)
router.get('/success', handlePaymentSuccess);

// Protected routes
router.post('/initialize', protect, initializePayment);
router.get('/verify/:reference', protect, verifyPayment);
router.get('/invoice/:orderId', protect, getOrderInvoice);

module.exports = router;
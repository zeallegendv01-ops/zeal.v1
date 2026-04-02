const express = require('express');
const {
  subscribeNewsletter,
  unsubscribeNewsletter,
  getNewsletterStats,
  sendEmailToUser,
  sendBroadcastEmail,
  getAllSubscribers
} = require('../controllers/newsletterController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/subscribe', subscribeNewsletter);
router.post('/unsubscribe', unsubscribeNewsletter);

// Admin protected routes
router.get('/stats', protect, authorize('admin'), getNewsletterStats);
router.get('/subscribers', protect, authorize('admin'), getAllSubscribers);
router.post('/send-email', protect, authorize('admin'), sendEmailToUser);
router.post('/broadcast', protect, authorize('admin'), sendBroadcastEmail);

module.exports = router;

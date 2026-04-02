const Newsletter = require('../models/Newsletter');
const User = require('../models/User');
const emailService = require('../utils/emailService');

// Subscribe to newsletter
exports.subscribeNewsletter = async (req, res, next) => {
  try {
    const { email, firstName, lastName } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if already subscribed
    let subscriber = await Newsletter.findOne({ email: email.toLowerCase() });

    if (subscriber) {
      if (subscriber.subscribed) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email is already subscribed to our newsletter' 
        });
      }
      // Re-subscribe
      subscriber.subscribed = true;
      subscriber.unsubscribedAt = null;
      subscriber.subscribedAt = new Date();
      subscriber.firstName = firstName || subscriber.firstName;
      subscriber.lastName = lastName || subscriber.lastName;
      await subscriber.save();
    } else {
      // New subscriber
      subscriber = await Newsletter.create({
        email: email.toLowerCase(),
        firstName: firstName || '',
        lastName: lastName || '',
        user: req.user?.id || null,
        source: req.user ? 'user' : 'website'
      });
    }

    // Send welcome email
    try {
      await emailService.sendNewsletterWelcomeEmail(subscriber);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail subscription if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter!',
      data: subscriber
    });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    next(error);
  }
};

// Unsubscribe from newsletter
exports.unsubscribeNewsletter = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const subscriber = await Newsletter.findOneAndUpdate(
      { email: email.toLowerCase() },
      { 
        subscribed: false,
        unsubscribedAt: new Date()
      },
      { new: true }
    );

    if (!subscriber) {
      return res.status(404).json({ 
        success: false, 
        message: 'Email not found in newsletter' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Successfully unsubscribed from newsletter',
      data: subscriber
    });
  } catch (error) {
    console.error('Newsletter unsubscription error:', error);
    next(error);
  }
};

// Get newsletter statistics (admin only)
exports.getNewsletterStats = async (req, res, next) => {
  try {
    const totalSubscribers = await Newsletter.countDocuments({ subscribed: true });
    const totalUnsubscribed = await Newsletter.countDocuments({ subscribed: false });
    const totalSubscribers_all = await Newsletter.countDocuments();
    const recentSubscribers = await Newsletter.find({ subscribed: true })
      .sort({ subscribedAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        active: totalSubscribers,
        unsubscribed: totalUnsubscribed,
        total: totalSubscribers_all,
        recentSubscribers
      }
    });
  } catch (error) {
    console.error('Newsletter stats error:', error);
    next(error);
  }
};

// Send email to specific user (admin only)
exports.sendEmailToUser = async (req, res, next) => {
  try {
    const { userId, subject, message } = req.body;

    if (!userId || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId, subject, and message are required' 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await emailService.sendCustomEmail(user.email, subject, message);

    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email}`
    });
  } catch (error) {
    console.error('Send email error:', error);
    next(error);
  }
};

// Send broadcast email to all subscribers (admin only)
exports.sendBroadcastEmail = async (req, res, next) => {
  try {
    const { subject, message, tags } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'subject and message are required' 
      });
    }

    // Get all active subscribers with optional tag filtering
    let query = { subscribed: true };
    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }

    const subscribers = await Newsletter.find(query);

    if (subscribers.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No active subscribers found' 
      });
    }

    // Send emails in batches to avoid overwhelming the server
    const batchSize = 50;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      const emailPromises = batch.map(subscriber =>
        emailService.sendBroadcastEmail(subscriber, subject, message)
          .catch(err => {
            console.error(`Failed to send email to ${subscriber.email}:`, err);
            return { email: subscriber.email, error: err.message };
          })
      );

      await Promise.all(emailPromises);
    }

    res.status(200).json({
      success: true,
      message: `Broadcast email sent to ${subscribers.length} subscribers`,
      data: {
        recipientCount: subscribers.length
      }
    });
  } catch (error) {
    console.error('Broadcast email error:', error);
    next(error);
  }
};

// Get all subscribers (admin only)
exports.getAllSubscribers = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, subscribed = true } = req.query;

    const query = subscribed !== 'all' ? { subscribed: subscribed === 'true' } : {};

    const subscribers = await Newsletter.find(query)
      .sort({ subscribedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Newsletter.countDocuments(query);

    res.status(200).json({
      success: true,
      data: subscribers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get subscribers error:', error);
    next(error);
  }
};

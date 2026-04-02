const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/.+@.+\..+/, 'Please provide a valid email address']
  },
  firstName: String,
  lastName: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  subscribed: {
    type: Boolean,
    default: true
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  unsubscribedAt: {
    type: Date,
    default: null
  },
  source: {
    type: String,
    enum: ['website', 'import', 'bot'],
    default: 'website'
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for faster queries
newsletterSchema.index({ email: 1 });
newsletterSchema.index({ subscribed: 1 });
newsletterSchema.index({ user: 1 });

module.exports = mongoose.model('Newsletter', newsletterSchema);

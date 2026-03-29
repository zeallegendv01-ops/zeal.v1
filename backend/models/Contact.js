const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Guest'
  },
  email: {
    type: String,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    enum: ['whatsapp', 'form', 'telegram', 'email'],
    default: 'form'
  },
  status: {
    type: String,
    enum: ['pending', 'received', 'responded', 'resolved'],
    default: 'pending'
  },
  response: {
    type: String
  },
  respondedAt: {
    type: Date
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Auto-cleanup old unresponded contacts after 30 days (optional)
contactSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Contact', contactSchema);

const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    taxRate: {
      type: Number,
      default: 10, // 10% tax
      min: 0,
      max: 100,
      description: 'Tax percentage (0-100)'
    },
    shippingFee: {
      type: Number,
      default: 50, // ₦50 shipping
      min: 0,
      description: 'Flat shipping fee in Naira'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      description: 'User who last updated these settings'
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    collection: 'settings'
  }
);

module.exports = mongoose.model('Settings', settingsSchema);

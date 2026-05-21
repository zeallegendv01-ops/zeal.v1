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
    // ════════════════════════ DEALER CONTACT INFO ════════════════════════
    dealerContact: {
      phone: {
        type: String,
        default: '+2348123456789',
        description: 'Dealer phone number for real estate inquiries (land/apartments)'
      },
      whatsapp: {
        type: String,
        default: '2348123456789', // WhatsApp number without + prefix
        description: 'Dealer WhatsApp number'
      },
      email: {
        type: String,
        default: 'dealer@365extra.com',
        description: 'Dealer email address'
      },
      name: {
        type: String,
        default: 'Real Estate Specialist',
        description: 'Dealer name'
      }
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


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
    heroTitle: {
      type: String,
      default: 'Global Marketplace',
      trim: true,
      maxlength: 120,
      description: 'Headline text for the homepage hero section'
    },
    heroDescription: {
      type: String,
      default: 'Where premium food, real estate, drinks and lifestyle offerings come together in one curated destination for modern buyers and sellers.',
      trim: true,
      maxlength: 260,
      description: 'Subheading text beneath the hero headline'
    },
    heroVideos: {
      type: [
        {
          url: { type: String, required: true },
          caption: { type: String, default: '' },
          uploadedAt: { type: Date, default: Date.now }
        }
      ],
      default: [],
      description: 'Hero video playlist items for the homepage hero section'
    },
    aboutImage: {
      url: {
        type: String,
        default: '',
        trim: true,
        description: 'Optional about section image URL'
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
        description: 'Timestamp when the about image was last updated'
      }
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


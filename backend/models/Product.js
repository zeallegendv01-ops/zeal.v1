const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true
  },
  code: {
    type: String,
    unique: true,
    sparse: true
  },
  description: {
    type: String,
    required: [true, 'Please provide a description']
  },
  
  // Product Type: 'product' (weight-based) or 'land' (area-based)
  type: {
    type: String,
    enum: ['product', 'land'],
    default: 'product'
  },

  // ════════════════════════ FOR PRODUCTS (Weight-based) ════════════════════════
  pricePerKg: {
    type: Number,
    min: [0.01, 'pricePerKg must be greater than 0'],
    // Required only if type is 'product'
    validate: {
      validator: function(v) {
        // If type is 'product', pricePerKg must be defined and > 0
        if (this.type === 'product') {
          return v !== undefined && v !== null && v > 0;
        }
        // For non-product types, pricePerKg is optional
        return true;
      },
      message: 'pricePerKg is required for products and must be a positive number'
    }
  },

  category: {
    type: String,
    enum: ['Smoked Fish', 'Grains', 'Rice', 'Other', 'Land'],
    validate: {
      validator: function(v) {
        return this.type === 'land' ? v === 'Land' : v !== 'Land';
      }
    }
  },

  origin: {
    type: String,
    default: 'Nigeria'
  },

  // ════════════════════════ FOR LAND ════════════════════════
  // Land can be: 'fixed' (one complete plot at fixed price) or 'per-meter' (priced per sq meter)
  landPricingType: {
    type: String,
    enum: ['fixed', 'per-meter'],
    // Required only if type is 'land'
    validate: {
      validator: function(v) {
        return this.type !== 'land' || v;
      },
      message: 'landPricingType (fixed or per-meter) is required for land'
    }
  },

  // For fixed pricing: total price of the plot
  pricePerPlot: {
    type: Number,
    min: 0,
    validate: {
      validator: function(v) {
        return this.type !== 'land' || this.landPricingType !== 'fixed' || (v && v > 0);
      },
      message: 'pricePerPlot required for fixed land pricing'
    }
  },

  // For per-meter pricing: price per square meter
  pricePerSqMeter: {
    type: Number,
    min: 0,
    validate: {
      validator: function(v) {
        return this.type !== 'land' || this.landPricingType !== 'per-meter' || (v && v > 0);
      },
      message: 'pricePerSqMeter required for per-meter land pricing'
    }
  },

  // Land specific details
  location: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return this.type !== 'land' || v;
      },
      message: 'Location is required for land'
    }
  },

  areaSqMeters: {
    type: Number,
    min: 0,
    validate: {
      validator: function(v) {
        return this.type !== 'land' || (v && v > 0);
      },
      message: 'Area in square meters is required for land'
    }
  },

  legalStatus: {
    type: String,
    enum: ['freehold', 'leasehold', 'government', 'communal', 'unknown'],
    default: 'unknown',
    validate: {
      validator: function(v) {
        return this.type !== 'land' || v;
      },
      message: 'Legal status is required for land'
    }
  },

  accessibility: {
    type: String,
    enum: ['road-access', 'water-access', 'both', 'limited'],
    default: 'limited',
    validate: {
      validator: function(v) {
        return this.type !== 'land' || v;
      },
      message: 'Accessibility is required for land'
    }
  },

  // Number of plots available (for land)
  // Admin decides: 1 plot, 2 plots, or multiple plots
  numberOfPlots: {
    type: Number,
    min: 1,
    default: 1,
    validate: {
      validator: function(v) {
        return this.type !== 'land' || v;
      },
      message: 'Number of plots is required for land'
    }
  },

  // ════════════════════════ COMMON FIELDS ════════════════════════
  image: {
    type: String,
    required: true
  },

  // Secondary images for land
  images: [String],

  quantity: {
    type: Number,
    default: 0,
    min: 0
  },

  unit: {
    type: String,
    required: [true, 'Please specify the measurement unit'],
    trim: true,
    default: function() {
      return this.type === 'land' ? 'plots' : 'kg';
    }
  },

  minLimit: {
    type: Number,
    min: 0.1,
    required: [true, 'Minimum limit is required'],
    default: 1,
    description: 'Minimum quantity customers can order'
  },

  maxLimit: {
    type: Number,
    min: 0.1,
    required: [true, 'Maximum limit is required'],
    default: function() {
      return this.type === 'land' ? this.numberOfPlots : 100;
    },
    validate: {
      validator: function(v) {
        return !this.minLimit || v >= this.minLimit;
      },
      message: 'Maximum limit must be greater than or equal to minimum limit'
    },
    description: 'Maximum quantity customers can order'
  },

  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued', 'sold-out'],
    default: 'active'
  },

  tags: [String],

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema);

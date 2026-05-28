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
  
  // Product Type: 'product' (weight-based), 'land' (area-based), or 'apartment' (unit-based)
  type: {
    type: String,
    enum: ['product', 'land', 'apartment'],
    default: 'product'
  },

  // ════════════════════════ FOR APARTMENTS ════════════════════════
  // Apartment type: custom types allowed (e.g., room, self-contained, house, flat, studio, penthouse, duplex)
  apartmentType: {
    type: String,
    validate: {
      validator: function(v) {
        return this.type !== 'apartment' || v;
      },
      message: 'Apartment type is required for apartments'
    }
  },

  // Apartment listing type: 'rent' or 'sale'
  listingType: {
    type: String,
    enum: ['rent', 'sale'],
    validate: {
      validator: function(v) {
        return this.type !== 'apartment' || v;
      },
      message: 'Listing type (rent or sale) is required for apartments'
    }
  },

  // For rent: price per month, for sale: total price
  pricePerMonth: {
    type: Number,
    min: 0,
    validate: {
      validator: function(v) {
        return this.type !== 'apartment' || this.listingType !== 'rent' || (v && v > 0);
      },
      message: 'Monthly price required for apartment rentals'
    }
  },

  // Pricing unit for rent (e.g., "month", "day", "week", "night", "year")
  priceUnit: {
    type: String,
    default: 'month',
    validate: {
      validator: function(v) {
        return this.type !== 'apartment' || this.listingType !== 'rent' || (v && v.length > 0);
      },
      message: 'Price unit is required for apartment rentals'
    }
  },

  price: {
    type: Number,
    min: 0,
    validate: {
      validator: function(v) {
        return this.type !== 'apartment' || this.listingType !== 'sale' || (v && v > 0);
      },
      message: 'Sale price required for apartment sales'
    }
  },

  // Apartment specs
  bedrooms: {
    type: Number,
    min: 0,
    validate: {
      validator: function(v) {
        return this.type !== 'apartment' || (v !== undefined && v !== null);
      },
      message: 'Number of bedrooms is required for apartments'
    }
  },

  bathrooms: {
    type: Number,
    min: 0,
    validate: {
      validator: function(v) {
        return this.type !== 'apartment' || (v !== undefined && v !== null);
      },
      message: 'Number of bathrooms is required for apartments'
    }
  },

  furnished: {
    type: Boolean,
    default: false
  },

  apartmentAreaSqMeters: {
    type: Number,
    min: 0,
    validate: {
      validator: function(v) {
        return this.type !== 'apartment' || (v && v > 0);
      },
      message: 'Area in square meters is required for apartments'
    }
  },

  // Apartment location details (more detailed than land)
  apartmentAddress: {
    type: String,
    validate: {
      validator: function(v) {
        return this.type !== 'apartment' || v;
      },
      message: 'Address is required for apartments'
    }
  },

  apartmentFeatures: [String], // e.g., ["balcony", "parking", "garden", "security"]

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
    required: [true, 'Please provide a category'],
    trim: true,
    validate: {
      validator: function(v) {
        // For land products, category must be 'Land'
        // For apartments, category must be 'Apartment'
        // For regular products, category cannot be 'Land' or 'Apartment'
        if (this.type === 'land') return v === 'Land';
        if (this.type === 'apartment') return v === 'Apartment';
        return v !== 'Land' && v !== 'Apartment';
      },
      message: function() {
        if (this.type === 'land') return 'Land products must have category "Land"';
        if (this.type === 'apartment') return 'Apartment products must have category "Apartment"';
        return 'Regular products cannot use "Land" or "Apartment" as category';
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
  // Image field - for backwards compatibility
  image: {
    type: String,
    required: true
  },

  // Option 2: Base64 encoded image data (stored in database)
  // Used when images are uploaded to server
  imageData: {
    type: String,
    default: null
  },

  // Option 3: External image URL (like Telegram URLs or CDN links)
  // Used when users provide image URLs
  imageUrl: {
    type: String,
    default: null
  },

  // Image MIME type (for Base64 images)
  imageMimeType: {
    type: String,
    default: 'image/jpeg',
    enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
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

// Indexes for frequently queried fields
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ type: 1 });
productSchema.index({ supplier: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ category: 1, status: 1 });  // Compound index for filtering by category and status
productSchema.index({ type: 1, status: 1 });      // Compound index for filtering by type and status

productSchema.pre('save', function(next) {
  const product = this;
  const quantityField = product.type === 'land' ? product.numberOfPlots : product.quantity;

  if (typeof quantityField === 'number' && quantityField === 0) {
    product.status = 'sold-out';
  } else if (product.status === 'sold-out' && typeof quantityField === 'number' && quantityField > 0) {
    product.status = 'active';
  }

  next();
});

module.exports = mongoose.model('Product', productSchema);

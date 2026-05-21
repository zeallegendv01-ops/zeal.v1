const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/365extra', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Product = require('./models/Product');
const User = require('./models/User');

const sampleProducts = [
  {
    name: 'Artesian Smoked Catfish',
    description: 'Premium smoked catfish from the Niger Delta region with rich flavor and firm texture.',
    pricePerKg: 45000,
    category: 'Smoked Fish',
    image: '/dist/img/download.jfif',
    quantity: 100,
    unit: 'kg',
    minLimit: 5,
    maxLimit: 100,
    certification: { organic: true, fair_trade: true },
    tags: ['seafood', 'premium', 'export'],
    origin: 'Nigeria',
    status: 'active'
  },
  {
    name: 'Traditional Pure Garri',
    description: 'Authentic cassava garri processed using traditional methods for exceptional taste.',
    pricePerKg: 18000,
    category: 'Grains',
    image: '/dist/img/download.jfif',
    quantity: 200,
    unit: 'kg',
    minLimit: 10,
    maxLimit: 500,
    certification: { organic: true },
    tags: ['cassava', 'grain', 'food'],
    origin: 'Nigeria',
    status: 'active'
  },
  {
    name: 'Whole Exquisite Kola Nuts',
    description: 'Premium grade kola nuts with rich flavor, perfect for export and traditional use.',
    pricePerKg: 32000,
    category: 'Other',
    image: '/dist/img/download.jfif',
    quantity: 50,
    unit: 'kg',
    minLimit: 2,
    maxLimit: 50,
    certification: { organic: true },
    tags: ['nuts', 'traditional', 'export'],
    origin: 'Nigeria',
    status: 'active'
  },
  {
    name: 'Coastal Farmland Plot',
    description: 'A scenic coastal land plot ideal for commercial farming or resort development.',
    type: 'land',
    category: 'Land',
    image: '/dist/img/download.jfif',
    location: 'Lagos Coast',
    areaSqMeters: 2500,
    numberOfPlots: 2,
    legalStatus: 'freehold',
    accessibility: 'road-access',
    landPricingType: 'per-meter',
    pricePerSqMeter: 120000,
    unit: 'plots',
    minLimit: 1,
    maxLimit: 2,
    quantity: 2,
    tags: ['land', 'coastal', 'investment'],
    status: 'active'
  },
  {
    name: 'Lakeside Estate Plot',
    description: 'Prime lakeside parcel with road access and development-ready title.',
    type: 'land',
    category: 'Land',
    image: '/dist/img/download.jfif',
    location: 'Kaduna Lake',
    areaSqMeters: 1800,
    numberOfPlots: 1,
    legalStatus: 'leasehold',
    accessibility: 'both',
    landPricingType: 'fixed',
    pricePerPlot: 9500000,
    unit: 'plots',
    minLimit: 1,
    maxLimit: 1,
    quantity: 1,
    tags: ['land', 'estate', 'lake'],
    status: 'active'
  },
  {
    name: 'Garden View Self-Contained Apartment',
    description: 'A self-contained apartment with garden access and modern finishes.',
    type: 'apartment',
    category: 'Apartment',
    image: '/dist/img/download.jfif',
    apartmentType: 'self-contained',
    listingType: 'rent',
    pricePerMonth: 150000,
    bedrooms: 2,
    bathrooms: 1,
    furnished: true,
    apartmentAreaSqMeters: 85,
    apartmentAddress: 'Victoria Island, Lagos',
    apartmentFeatures: ['parking', 'balcony', '24/7 security'],
    unit: 'unit',
    minLimit: 1,
    maxLimit: 1,
    quantity: 1,
    tags: ['apartment', 'rent', 'urban'],
    status: 'active'
  },
  {
    name: 'Luxury Family Apartment',
    description: 'A spacious apartment available for sale in a secure residential tower.',
    type: 'apartment',
    category: 'Apartment',
    image: '/dist/img/download.jfif',
    apartmentType: 'flat',
    listingType: 'sale',
    price: 32000000,
    bedrooms: 3,
    bathrooms: 2,
    furnished: false,
    apartmentAreaSqMeters: 120,
    apartmentAddress: 'Ikoyi, Lagos',
    apartmentFeatures: ['gym', 'pool', 'parking'],
    unit: 'unit',
    minLimit: 1,
    maxLimit: 1,
    quantity: 1,
    tags: ['apartment', 'sale', 'luxury'],
    status: 'active'
  }
];

async function seedProducts() {
  try {
    console.log('🌾 Seeding 365extra products...');

    let supplier = await User.findOne({ email: 'supplier@365extra.com' });
    if (!supplier) {
      supplier = await User.create({
        firstName: '365extra',
        lastName: 'Supplier',
        email: 'supplier@365extra.com',
        password: 'supplier123',
        accountType: 'Producer',
        phone: '+2341234567890'
      });
      console.log('✅ Created supplier user');
    }

    for (const product of sampleProducts) {
      const existingProduct = await Product.findOne({ name: product.name });
      if (!existingProduct) {
        await Product.create({
          ...product,
          supplier: supplier._id
        });
        console.log(`✅ Created: ${product.name}`);
      } else {
        console.log(`⏭️  Skipped: ${product.name} (already exists)`);
      }
    }

    console.log('🎉 Product seeding completed!');
    console.log(`📦 Products are now available in your database!`);
    return true;
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    throw error;
  }
}

if (require.main === module) {
  seedProducts()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedProducts;

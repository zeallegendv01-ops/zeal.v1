const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agrocrown', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Product = require('./models/Product');
const User = require('./models/User');

const sampleProducts = [
  // {
  //   name: 'Artesian Smoked Catfish',
  //   description: 'Premium smoked catfish from the Niger Delta region',
  //   pricePerKg: 45000,
  //   category: 'Smoked Fish',
  //   image: 'https://images.unsplash.com/photo-1599056377759-3388006e62e0?auto=format&fit=crop&w=700&q=80',
  //   quantity: 100,
  //   unit: 'kg',
  //   certification: { organic: true, fair_trade: true },
  //   origin: 'Nigeria',
  //   minOrder: 5,
  //   maxOrder: 500
  // },
  // {
  //   name: 'Traditional Pure Garri',
  //   description: 'Authentic cassava garri processed using traditional methods',
  //   pricePerKg: 18000,
  //   category: 'Grains',
  //   image: 'https://images.unsplash.com/photo-1590540179852-2110a54f813a?auto=format&fit=crop&w=700&q=80',
  //   quantity: 200,
  //   unit: 'kg',
  //   certification: { organic: true },
  //   origin: 'Nigeria',
  //   minOrder: 10,
  //   maxOrder: 1000
  // },
  // {
  //   name: 'Whole Exquisite Kola Nuts',
  //   description: 'Premium grade kola nuts with rich flavor and aroma',
  //   pricePerKg: 32000,
  //   category: 'Other',
  //   image: 'https://images.unsplash.com/photo-1614701838030-f7034d61053f?auto=format&fit=crop&w=700&q=80',
  //   quantity: 50,
  //   unit: 'kg',
  //   certification: { organic: true },
  //   origin: 'Nigeria',
  //   minOrder: 2,
  //   maxOrder: 200
  // }
];

async function seedProducts() {
  try {
    console.log('🌾 Seeding AgroCrown products...');

    // First, create or find a supplier user
    let supplier = await User.findOne({ email: 'supplier@agrocrown.com' });
    if (!supplier) {
      supplier = await User.create({
        firstName: 'AgroCrown',
        lastName: 'Supplier',
        email: 'supplier@agrocrown.com',
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
    console.log(`🔗 API endpoint: http://localhost:4000/api/products`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    process.exit(1);
  }
}

seedProducts();
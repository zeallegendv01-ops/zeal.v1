const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');
const User = require('./models/User');

if (mongoose.connection.readyState === 0) {
  console.warn('⚠️  seed-products.js was loaded before the main MongoDB connection was established.');
  console.warn('    This file should be imported after connectDB() runs in server.js.');
}


const sampleProducts = [
  {
    name: 'No Product',
    description: 'Placeholder product created for development seed data.',
    pricePerKg: 1,
    category: 'Other',
    image: '/dist/img/download.jfif',
    quantity: 1,
    unit: 'kg',
    minLimit: 1,
    maxLimit: 1,
    certification: { organic: false, fair_trade: false },
    tags: ['placeholder'],
    origin: 'Unknown',
    status: 'inactive'
  }
];

async function seedProducts() {
  try {
    console.log('🌾 Seeding placeholder product: No Product...');

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

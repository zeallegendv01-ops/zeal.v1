require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('./models/Settings');

const checkSettings = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/365extra', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✓ Connected\n');

    console.log('All Settings documents:');
    const allSettings = await Settings.find();
    console.log(`Found ${allSettings.length} document(s)\n`);
    allSettings.forEach((s, i) => {
      console.log(`Document ${i}:`, JSON.stringify({
        _id: s._id,
        heroVideos: s.heroVideos,
        taxRate: s.taxRate
      }, null, 2));
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

checkSettings();

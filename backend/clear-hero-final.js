require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('./models/Settings');

const clearHeroVideos = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/365extra', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✓ Connected\n');

    // Find the settings
    let settings = await Settings.findOne();
    if (!settings) {
      console.log('No settings found');
      process.exit(0);
    }

    console.log('Current heroVideos:', settings.heroVideos);
    console.log('Setting heroVideos to empty array...');
    
    // Use Mongoose methods to ensure proper update
    settings.heroVideos = [];
    settings.markModified('heroVideos');
    await settings.save({ validateBeforeSave: false });
    
    console.log('✓ Saved');

    // Verify with fresh query
    const verified = await Settings.findOne();
    console.log('\nAfter save:');
    console.log('heroVideos:', verified.heroVideos);
    console.log('heroVideos.length:', verified.heroVideos?.length || 0);

    // Also verify with raw MongoDB query
    const db = mongoose.connection.db;
    const raw = await db.collection('settings').findOne({});
    console.log('\nRaw MongoDB check:');
    console.log('heroVideos:', raw.heroVideos);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
    process.exit(1);
  }
};

clearHeroVideos();

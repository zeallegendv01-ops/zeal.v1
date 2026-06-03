require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('./models/Settings');

const fixHeroVideos = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/365extra', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✓ Connected to MongoDB');

    const settings = await Settings.findOne();
    if (!settings) {
      console.log('No settings found in database');
      process.exit(0);
    }

    console.log('\nCurrent heroVideos:');
    console.log(JSON.stringify(settings.heroVideos, null, 2));

    if (settings.heroVideos && settings.heroVideos.length > 0) {
      console.log('\n⚠️  Clearing invalid heroVideos from database...');
      settings.heroVideos = [];
      await settings.save();
      console.log('✓ Cleared heroVideos');
    } else {
      console.log('✓ No heroVideos to clear');
    }

    console.log('\nUpdated settings:');
    console.log(JSON.stringify({
      taxRate: settings.taxRate,
      shippingFee: settings.shippingFee,
      heroTitle: settings.heroTitle,
      heroDescription: settings.heroDescription,
      heroVideos: settings.heroVideos,
      aboutImage: settings.aboutImage
    }, null, 2));

    console.log('\n✓ Fix complete! Hero videos will now fall back to default /dist/vid/...');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

fixHeroVideos();

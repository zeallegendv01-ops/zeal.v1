require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const connectDB = require('./backend/config/database');
const Settings = require('./backend/models/Settings');

async function main() {
  try {
    await connectDB();
    await new Promise(resolve => mongoose.connection.once('open', resolve));

    const uploadsDir = path.join(__dirname, 'backend', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      console.error('Uploads directory not found:', uploadsDir);
      process.exit(1);
    }

    const files = fs.readdirSync(uploadsDir).filter(f => f.startsWith('hero_'));
    if (!files.length) {
      console.error('No hero_ files found in uploads directory.');
      process.exit(1);
    }

    // Pick the newest hero_ file
    const file = files
      .map(f => ({ name: f, mtime: fs.statSync(path.join(uploadsDir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime)[0].name;

    const videoUrl = `/uploads/${file}`;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ taxRate: 10, shippingFee: 50, heroVideos: [] });
    }

    settings.heroVideos = settings.heroVideos || [];

    const already = settings.heroVideos.find(v => v.url === videoUrl);
    if (already) {
      console.log('Video already present in settings:', videoUrl);
    } else {
      settings.heroVideos.unshift({ url: videoUrl, caption: `Restored hero: ${file}`, uploadedAt: new Date() });
      // Keep up to 6
      settings.heroVideos = settings.heroVideos.slice(0, 6);
      await settings.save();
      console.log('Added hero video to settings:', videoUrl);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();

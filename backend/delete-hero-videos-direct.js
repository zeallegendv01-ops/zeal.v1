require('dotenv').config();
const mongoose = require('mongoose');

const deleteHeroVideos = async () => {
  try {
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/365extra', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✓ Connected\n');

    const db = conn.connection.db;

    // Update the settings document directly with $set to clear heroVideos
    const result = await db.collection('settings').updateOne(
      {},
      { $set: { heroVideos: [] } }
    );

    console.log('Update result:', result);

    // Verify
    const updated = await db.collection('settings').findOne({});
    console.log('\nAfter update:');
    console.log(JSON.stringify({
      heroVideos: updated.heroVideos,
      count: updated.heroVideos?.length || 0
    }, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

deleteHeroVideos();

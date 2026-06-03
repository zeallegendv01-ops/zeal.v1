require('dotenv').config();
const mongoose = require('mongoose');

const queryMongo = async () => {
  try {
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/365extra', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✓ Connected\n');

    // Get the database instance
    const db = conn.connection.db;

    // Query the settings collection directly (not via Mongoose)
    console.log('Querying Settings collection directly:');
    const settings = await db.collection('settings').find({}).toArray();
    console.log(`Found ${settings.length} document(s):\n`);
    
    settings.forEach((s, i) => {
      console.log(`Doc ${i}:`, JSON.stringify(s, null, 2));
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

queryMongo();

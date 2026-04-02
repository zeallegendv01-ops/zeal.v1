const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agrocrown', {
      serverSelectionTimeoutMS: 45000,    // Increased timeout for server selection
      socketTimeoutMS: 90000,             // Increased socket timeout to 90 seconds
      connectTimeoutMS: 45000,            // Increased connection timeout
      maxPoolSize: 10,                    // Connection pooling
      minPoolSize: 5,
      retryWrites: true,
      w: 'majority',
      maxIdleTimeMS: 60000,               // Max idle time before connection is closed
      bufferMaxEntries: 100,              // Allow some buffering but not unlimited
      serverAPI: { version: '1' }         // Use stable server API version
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agrocrown', {
      serverSelectionTimeoutMS: 30000,    // Increase timeout to 30 seconds
      socketTimeoutMS: 60000,             // Socket timeout to 60 seconds
      connectTimeoutMS: 30000,            // Connection timeout to 30 seconds
      maxPoolSize: 10,                    // Connection pooling
      minPoolSize: 5,
      retryWrites: true,
      w: 'majority'
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

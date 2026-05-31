const mongoose = require('mongoose');
const { URL } = require('url');

const connectDB = async () => {
  try {
    const defaultDb = process.env.MONGODB_DB_NAME || '365extra';
    let mongoUri = process.env.MONGODB_URI || `mongodb://localhost:27017/${defaultDb}`;

    try {
      const parsed = new URL(mongoUri);
      if (!parsed.pathname || parsed.pathname === '/') {
        parsed.pathname = `/${defaultDb}`;
        mongoUri = parsed.toString();
        console.warn(`MongoDB URI did not include a database name; defaulting to '${defaultDb}'`);
      }
    } catch (e) {
      // Fallback for URIs that cannot be parsed by URL
      if (!mongoUri.match(/mongodb(\+srv)?:\/\/[^/]+\//)) {
        mongoUri = `${mongoUri}/${defaultDb}`;
        console.warn(`MongoDB URI did not include a database name; appending default database '${defaultDb}'`);
      }
    }

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 45000,    // Increased timeout for server selection
      socketTimeoutMS: 90000,             // Increased socket timeout to 90 seconds
      connectTimeoutMS: 45000,            // Increased connection timeout
      maxPoolSize: 10,                    // Connection pooling
      minPoolSize: 5,
      retryWrites: true,
      w: 'majority',
      maxIdleTimeMS: 60000                // Max idle time before connection is closed
    });
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;


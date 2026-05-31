const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { URL } = require('url');
require('dotenv').config();

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
  if (!mongoUri.match(/mongodb(\+srv)?:\/\/[^/]+\//)) {
    mongoUri = `${mongoUri}/${defaultDb}`;
    console.warn(`MongoDB URI did not include a database name; appending default database '${defaultDb}'`);
  }
}

// Connect to MongoDB with timeout
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000, // 10 second timeout
  socketTimeoutMS: 10000
};

mongoose.connect(mongoUri, mongooseOptions);

// Set up connection event handlers
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

const User = require('./models/User');

async function createAdminUser() {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@365extra.com' });
    if (existingAdmin) {
      console.log('✅ Admin user already exists!');
      // Generate JWT token for existing admin
      const token = jwt.sign(
        { id: existingAdmin._id },
        process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production',
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );
      console.log('🔑 JWT Token:', token);
      console.log('👤 User ID:', existingAdmin._id);
      return;
    }

    // Create new admin user
    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@365extra.com',
      password: 'admin123',
      accountType: 'Distributor',
      phone: '1234567890'
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id },
      process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    console.log('✅ Admin user created successfully!');
    console.log('🔑 JWT Token:', token);
    console.log('👤 User ID:', admin._id);
    console.log('📧 Email: admin@365extra.com');
    console.log('🔒 Password: admin123');

  } catch (error) {
    console.log('❌ Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

createAdminUser();

// Set a max timeout to exit after 30 seconds
setTimeout(() => {
  console.error('❌ Script timed out - could not connect to MongoDB');
  process.exit(1);
}, 30000);

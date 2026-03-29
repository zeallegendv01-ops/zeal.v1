require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const contactRoutes = require('./routes/contact');
const analyticsRoutes = require('./routes/analytics');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();

// Initialize admin user if not exists
const initializeAdminUser = async () => {
  try {
    const User = require('./models/User');
    const existingAdmin = await User.findOne({ email: 'admin@agrocrown.com' });
    
    if (!existingAdmin) {
      console.log('📝 Creating admin user...');
      await User.create({
        firstName: 'Admin',
        lastName: 'User', 
        email: 'admin@agrocrown.com',
        password: 'admin123',
        accountType: 'Distributor',
        phone: '1234567890'
      });
      console.log('✅ Admin user created successfully');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('⚠️ Admin user initialization error:', error.message);
    // Don't exit - allow server to continue even if admin creation fails
  }
};

// Connect to database
connectDB();

// Wait for MongoDB connection before initializing admin user
mongoose.connection.once('open', async () => {
  console.log('🔗 Database connection ready, initializing admin user...');
  await initializeAdminUser();
  
  // Start server listening ONLY after database is connected
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Middleware
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(origin => origin.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed for: ' + origin));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '..')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Upload route
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.status(200).json({
    success: true,
    message: 'File uploaded successfully',
    data: { imageUrl }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

// Serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'agrocrown.html'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

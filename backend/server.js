require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
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
      console.log(' Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error(' Admin user initialization error:', error.message);
    // Don't exit - allow server to continue even if admin creation fails
  }
};

// Connect to database
connectDB();

// Wait for MongoDB connection before initializing admin user
mongoose.connection.once('open', async () => {
  console.log('🔗 Database connection ready, initializing admin user...');
  await initializeAdminUser();
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
const settingsRoutes = require('./routes/settings');
app.use('/api/settings', settingsRoutes);

// Upload route - with automatic image compression
app.post('/api/upload', upload.single('image'), async (req, res) => {
  const fs = require('fs');
  
  try {
    // Option 2: File upload - compress and convert to Base64
    if (req.file) {
      const inputPath = req.file.path;
      const filename = `compressed_${Date.now()}.jpg`;
      const outputPath = path.join(__dirname, 'uploads', filename);
      
      // Compress image: 500×650px (3:4 aspect ratio to match card design)
      // Optimized for desktop (640px), tablet (384px), and mobile (375px) displays
      await sharp(inputPath)
        .resize(500, 650, {
          fit: 'cover',
          position: 'center',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80, progressive: true })
        .toFile(outputPath);
      
      // Read compressed file and convert to Base64
      const compressedBuffer = fs.readFileSync(outputPath);
      const base64Data = compressedBuffer.toString('base64');
      const mimeType = 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      
      // Delete original uploaded file (keep compressed version in uploads/)
      fs.unlinkSync(inputPath);
      
      console.log(`✅ Image compressed: ${req.file.originalname} → ${filename} (${(compressedBuffer.length / 1024).toFixed(2)}KB)`);
      
      return res.status(200).json({
        success: true,
        message: 'File uploaded and compressed successfully',
        data: { 
          imageData: base64Data,
          mimeType: mimeType,
          dataUrl: dataUrl,
          filename: filename,
          size: compressedBuffer.length // Size in bytes
        }
      });
    }
    
    // Option 3: External URL input
    if (req.body.imageUrl) {
      const imageUrl = req.body.imageUrl;
      // Basic URL validation
      try {
        new URL(imageUrl);
        return res.status(200).json({
          success: true,
          message: 'Image URL registered successfully',
          data: { imageUrl }
        });
      } catch (error) {
        return res.status(400).json({ success: false, message: 'Invalid URL format' });
      }
    }
    
    // Neither file nor URL provided
    res.status(400).json({ success: false, message: 'No file or URL provided' });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Error processing image: ' + error.message });
  }
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

const PORT = process.env.PORT || 4000;

// Start server immediately (don't wait for DB)
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

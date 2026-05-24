require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const Product = require('./models/Product');
const ThreatLog = require('./models/ThreatLog');
const seedProducts = require('./seed-products');
const { sendThreatNotification, sendCriticalThreatAlert } = require('./utils/threatNotifier');

// Import routes
const authRoutes = require('./routes/auth');
const cartRoutes = require('./routes/cart');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const contactRoutes = require('./routes/contact');
const analyticsRoutes = require('./routes/analytics');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();

// Initialize Groq (optional - AI threat analysis)
let groq = null;
try {
  if (process.env.GROQ_API_KEY) {
    const Groq = require('groq-sdk');
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
} catch (e) {
  console.warn('[ShieldAI] Groq SDK not configured, AI threat analysis disabled');
}

// Initialize admin user if not exists
const initializeAdminUser = async () => {
  try {
    const User = require('./models/User');
    const existingAdmin = await User.findOne({ email: 'admin@365extra.com' });
    
    if (!existingAdmin) {
      console.log('📝 Creating admin user...');
      await User.create({
        firstName: 'Admin',
        lastName: 'User', 
        email: 'admin@365extra.com',
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

// Wait for MongoDB connection before initializing admin user and starting server
mongoose.connection.once('open', async () => {
  console.log(' Database connection ready, initializing admin user...');
  await initializeAdminUser();

  // Seed sample products only when explicitly allowed.
  try {
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      if (process.env.SEED_DB === 'true' || process.env.SEED_DB === '1') {
        console.log(' No products found in database. Seeding sample listings...');
        await seedProducts();
      } else {
        console.warn(' No products found in the current database.');
        console.warn(' If you want to populate sample listings for development, set SEED_DB=true in .env.');
        console.warn(' Otherwise, verify that MONGODB_URI points to the correct database containing your actual listings.');
      }
    }
  } catch (seedError) {
    console.error(' Error checking/seeding products:', seedError);
  }
  
  // Now start the server after database and admin are ready
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
    fileSize: 100 * 1024 * 1024 // 100MB limit
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
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000, http://localhost:4000').split(',').map(origin => origin.trim()).filter(Boolean);
if (process.env.FRONTEND_URL) {
  corsOrigins.push(...process.env.FRONTEND_URL.split(',').map(origin => origin.trim()).filter(Boolean));
}
const allowedOrigins = Array.from(new Set(corsOrigins));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      upgradeInsecureRequests: []
    }
  }
}));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests' }
});

const threatAnalysisLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Threat analysis rate limit exceeded' }
});

app.use(globalLimiter);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin server-side requests)
    if (!origin || origin === 'null') {
      return callback(null, true);
    }

    // Allow all origins when configured explicitly with wildcard
    if (allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('CORS not allowed for: ' + origin));
  },
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '..')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);

// =============================================================================
// SHIELDAI THREAT ANALYSIS ENDPOINT
// =============================================================================

// Get client IP from request
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.socket.remoteAddress ||
         req.connection.remoteAddress ||
         'unknown';
}

// Log threat to database and notify admin
async function logThreatAndNotify(threatData, req) {
  try {
    const ip = getClientIP(req);
    
    // Create threat log entry
    const threatLog = new ThreatLog({
      ip,
      userAgent: req.headers['user-agent'],
      referer: req.headers['referer'],
      threatLevel: threatData.threat,
      threatScore: threatData.score,
      threatType: threatData.threatType || 'unknown',
      reason: threatData.reason,
      details: threatData,
      activities: threatData.activities || {},
      behavioralScores: threatData.behavioralScores || {},
      fingerprint: threatData.fingerprint,
      targetUrl: threatData.url,
      actionTaken: threatData.action,
      sessionDuration: threatData.sessionDuration,
      timeOnPage: threatData.timeOnPage,
      suspiciousEvents: (threatData.recentSuspicious || []).slice(0, 20),
      requiresReview: threatData.score >= 70
    });

    await threatLog.save();
    console.log(`[ThreatLog] ✓ Threat logged (IP: ${ip}, Score: ${threatData.score})`);

    // Send Telegram notification for threats >= threshold
    if (threatData.score >= 50) {
      const adminIds = (process.env.ADMIN_TELEGRAM_ID || '')
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));

      if (process.env.TELEGRAM_BOT_TOKEN && adminIds.length > 0) {
        const notificationData = {
          ip,
          threatLevel: threatData.threat,
          threatScore: threatData.score,
          reason: threatData.reason,
          actionTaken: threatData.action,
          activities: threatData.activities,
          behavioralScores: threatData.behavioralScores,
          targetUrl: threatData.url,
          userAgent: req.headers['user-agent'],
          threatType: threatData.threatType
        };

        // Send to all admin IDs
        for (const adminId of adminIds) {
          await sendThreatNotification(notificationData, process.env.TELEGRAM_BOT_TOKEN, adminId);
        }

        // Critical alert for high scores
        if (threatData.score >= 85) {
          await sendCriticalThreatAlert(notificationData, process.env.TELEGRAM_BOT_TOKEN, adminIds);
        }
      }
    }

    return threatLog;
  } catch (error) {
    console.error('[ThreatLog] Error:', error.message);
    // Don't fail the request if logging fails
    return null;
  }
}

// Validate threat analysis payload
function validateThreatPayload(body) {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Invalid payload');
  }

  const required = ['localThreatScore', 'timeOnPage'];
  for (const field of required) {
    if (body[field] === undefined) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (
    typeof body.localThreatScore !== 'number' ||
    body.localThreatScore < 0 ||
    body.localThreatScore > 100
  ) {
    throw new Error('Invalid localThreatScore');
  }
}

// Server-side pre-scoring (instant, no AI needed)
function serverSideScore(body) {
  let score = body.localThreatScore || 0;

  if (body.headlessDetected) score = Math.max(score, 70);
  if (body.automationDetected) score = Math.max(score, 65);
  if (body.honeypotTriggered) score = Math.max(score, 90);
  if (body.devtoolsOpen) score = Math.max(score, 40);

  if ((body.mouseRoboticScore || 0) > 0.8) score += 15;
  if ((body.scrollRoboticScore || 0) > 0.8) score += 10;
  if ((body.keyRoboticScore || 0) > 0.8) score += 10;

  const suspCount = (body.recentSuspicious || []).length;
  if (suspCount > 5) score += 10;
  if (suspCount > 10) score += 15;

  if (body.timeOnPage < 1000 && (body.clicks > 0 || body.keypresses > 0)) {
    score += 20;
  }

  return Math.min(Math.round(score), 100);
}

// AI threat analysis via Groq LLM (if available)
async function analyzeWithAI(behavior) {
  if (!groq) {
    throw new Error('AI analysis not configured');
  }

  const prompt = `
You are a specialist bot and scraper detection AI. Your job is to analyze browser behavior telemetry and determine whether the session is from a human or an automated agent.

Scoring scale:
0–20 → Normal human. Action: allow.
21–50 → Mildly suspicious. Action: allow or slow.
51–74 → Suspicious. Action: challenge (present CAPTCHA).
75–89 → Likely bot/scraper. Action: block.
90–100 → Definite automation. Action: block immediately.

Key signals ranked by weight (highest → lowest):

1. honeypotTriggered — near-certain bot (fill in anything = 90+)
1. headlessDetected — strong bot signal (70+)
1. automationDetected — strong bot signal (65+)
1. mouseRoboticScore ≥0.8 — scripted mouse movement
1. scrollRoboticScore ≥0.8 — scripted scroll
1. keyRoboticScore ≥0.8 — scripted typing
1. mouseMoves=0, clicks=0, keypresses=0 on non-touch device = suspicious
1. Very short timeOnPage (<2s) with many interactions = scraper
1. devtoolsOpen — moderate signal (could be dev, could be scraper)
1. recentSuspicious count — correlates with threat level

Be fair to legitimate developers with DevTools open (lower penalty if that is the only signal).

Browser behavior telemetry:
${JSON.stringify(behavior, null, 2)}

Respond ONLY with a valid JSON object — no markdown, no preamble, no explanation:
{
"score": <integer 0-100>,
"threat": "<safe|suspicious|malicious>",
"action": "<allow|slow|challenge|block>",
"confidence": <float 0.0-1.0>,
"reason": "<concise explanation, max 100 chars>"
}
`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.1-70b-versatile',
    temperature: 0.1,
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: 'You are a security analyst. Respond only with a single JSON object.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const raw = response.choices[0].message.content.trim();
  const clean = raw.replace(/^`[a-z]*\n?/i, '').replace(/`$/i, '').trim();

  return JSON.parse(clean);
}

// Main threat analysis endpoint
app.post(
  '/api/threat-analysis',
  threatAnalysisLimiter,
  async (req, res) => {
    try {
      // Step 1: Validate payload structure
      validateThreatPayload(req.body);

      // Step 2: Fast server-side pre-score (no AI quota used)
      const preScore = serverSideScore(req.body);

      // Step 3: Short-circuit obvious extremes to save AI quota
      if (preScore >= 90) {
        const result = {
          score: preScore,
          threat: 'malicious',
          action: 'block',
          confidence: 1.0,
          reason: 'Definite automation signals detected server-side'
        };
        
        // Log threat
        await logThreatAndNotify({
          ...result,
          ...req.body,
          threatType: 'automation-detected',
          activities: {
            mouseMoves: req.body.mouseMoves,
            clicks: req.body.clicks,
            scrolls: req.body.scrolls,
            touches: req.body.touches,
            keypresses: req.body.keypresses,
            copies: req.body.copies,
            drags: req.body.drags,
            devtoolsOpen: req.body.devtoolsOpen,
            headlessDetected: req.body.headlessDetected,
            automationDetected: req.body.automationDetected,
            honeypotTriggered: req.body.honeypotTriggered
          },
          behavioralScores: {
            mouseRobotic: req.body.mouseRoboticScore,
            scrollRobotic: req.body.scrollRoboticScore,
            keystrokeRobotic: req.body.keyRoboticScore
          }
        }, req);

        return res.json(result);
      }

      if (preScore <= 10) {
        return res.json({
          score: preScore,
          threat: 'safe',
          action: 'allow',
          confidence: 0.95,
          reason: 'No threat signals detected'
        });
      }

      // Step 4: AI analysis for the ambiguous middle range (11–89)
      if (groq) {
        try {
          const aiResult = await analyzeWithAI({
            ...req.body,
            serverPreScore: preScore
          });

          // Step 5: Blend server pre-score and AI score
          const finalScore = Math.min(
            Math.round(preScore * 0.4 + aiResult.score * 0.6),
            100
          );

          // Log threat if score is significant
          if (finalScore >= 50) {
            await logThreatAndNotify({
              ...aiResult,
              score: finalScore,
              ...req.body,
              threatType: aiResult.threat === 'malicious' ? 'bot-detected' : 'suspicious-behavior',
              activities: {
                mouseMoves: req.body.mouseMoves,
                clicks: req.body.clicks,
                scrolls: req.body.scrolls,
                touches: req.body.touches,
                keypresses: req.body.keypresses,
                copies: req.body.copies,
                drags: req.body.drags,
                devtoolsOpen: req.body.devtoolsOpen,
                headlessDetected: req.body.headlessDetected,
                automationDetected: req.body.automationDetected,
                honeypotTriggered: req.body.honeypotTriggered
              },
              behavioralScores: {
                mouseRobotic: req.body.mouseRoboticScore,
                scrollRobotic: req.body.scrollRoboticScore,
                keystrokeRobotic: req.body.keyRoboticScore
              }
            }, req);
          }

          return res.json({
            ...aiResult,
            score: finalScore
          });
        } catch (aiErr) {
          console.error('[ShieldAI] AI analysis error:', aiErr.message);
          // Fall through to non-AI response
        }
      }

      // Fallback: return server pre-score if AI is unavailable
      return res.json({
        score: preScore,
        threat: preScore > 50 ? 'suspicious' : 'safe',
        action: preScore > 70 ? 'challenge' : 'allow',
        confidence: 0.7,
        reason: 'Server-side analysis only'
      });
    } catch (err) {
      console.error('[ShieldAI] Error:', err.message);

      // Graceful fallback: do NOT block users when analysis fails
      res.json({
        score: 0,
        threat: 'safe',
        action: 'allow',
        confidence: 0,
        reason: 'Analysis service temporarily unavailable'
      });
    }
  }
);

// Threat logs endpoint (for admin dashboard)
app.get('/api/threat-logs', async (req, res) => {
  try {
    const { limit = 50, offset = 0, threatLevel, ip, sortBy = '-createdAt' } = req.query;
    
    const query = {};
    if (threatLevel && ['safe', 'suspicious', 'malicious'].includes(threatLevel)) {
      query.threatLevel = threatLevel;
    }
    if (ip) {
      query.ip = ip;
    }

    const logs = await ThreatLog.find(query)
      .sort(sortBy)
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await ThreatLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (error) {
    console.error('[API] Threat logs error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching threat logs'
    });
  }
});

// Threat statistics endpoint
app.get('/api/threat-stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalThreats,
      threatsByLevel,
      threatsByAction,
      topThreats,
      topIPs
    ] = await Promise.all([
      ThreatLog.countDocuments({ createdAt: { $gte: startDate } }),
      ThreatLog.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$threatLevel', count: { $sum: 1 } } }
      ]),
      ThreatLog.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$actionTaken', count: { $sum: 1 } } }
      ]),
      ThreatLog.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$threatType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      ThreatLog.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$ip', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        totalThreats,
        threatsByLevel: Object.fromEntries(threatsByLevel.map(t => [t._id, t.count])),
        threatsByAction: Object.fromEntries(threatsByAction.map(t => [t._id, t.count])),
        topThreats: topThreats.map(t => ({ type: t._id, count: t.count })),
        topIPs: topIPs.map(t => ({ ip: t._id, count: t.count }))
      }
    });
  } catch (error) {
    console.error('[API] Threat stats error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching threat statistics'
    });
  }
});

// Health check endpoint for ShieldAI
app.get('/api/shield-health', (req, res) => {
  res.json({
    status: 'ok',
    shieldEnabled: true,
    aiEnabled: !!groq,
    ts: Date.now()
  });
});

// Health check endpoint - for bot to verify server is ready
app.get('/health', (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ status: 'unhealthy', message: 'Database not connected' });
    }
    res.json({ status: 'healthy', message: 'Server and database ready' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', message: error.message });
  }
});

// Routes
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
const settingsRoutes = require('./routes/settings');
app.use('/api/settings', settingsRoutes);
const newsletterRoutes = require('./routes/newsletter');
app.use('/api/newsletter', newsletterRoutes);

// Share page route for social previews
app.get('/share/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const validTypes = ['product', 'land', 'apartment'];
    if (!validTypes.includes(type)) {
      return res.redirect('/');
    }

    const product = await Product.findById(id).lean();
    const baseHtmlPath = path.resolve(__dirname, '..', '365extra.html');
    let html = fs.readFileSync(baseHtmlPath, 'utf8');

    const siteUrl = `${req.protocol}://${req.get('host')}`;
    const shareUrl = `${siteUrl}/share/${type}/${id}`;
    let title = '365extra - Premium Agricultural Exports';
    let description = 'Discover premium agricultural exports, land and apartments with 365extra.';
    let image = `${siteUrl}/dist/img/download.jfif`;

    if (product) {
      const itemName = product.name || '365extra listing';
      title = `${itemName} | 365extra`;
      const productDescription = product.description || '';

      if (type === 'product') {
        const priceInfo = product.pricePerKg ? `NGN ${Number(product.pricePerKg).toLocaleString()} / kg` : '';
        description = `${productDescription} ${priceInfo}`.trim();
      } else if (type === 'land') {
        const location = product.location ? `Location: ${product.location}.` : '';
        const plots = product.numberOfPlots ? `${product.numberOfPlots} plot${product.numberOfPlots === 1 ? '' : 's'} available.` : '';
        description = `${productDescription} ${location} ${plots}`.trim();
      } else if (type === 'apartment') {
        const location = product.apartmentAddress || product.location ? `Location: ${product.apartmentAddress || product.location}.` : '';
        description = `${productDescription} ${location}`.trim();
      }

      if (product.image && !product.image.startsWith('data:')) {
        image = product.image;
      }
    }

    const escapeHtml = (value) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
    html = html.replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${escapeHtml(title)}">`);
    html = html.replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${escapeHtml(description)}">`);
    html = html.replace(/<meta property="og:url" content=".*?">/, `<meta property="og:url" content="${escapeHtml(shareUrl)}">`);
    html = html.replace(/<meta property="og:image" content=".*?">/, `<meta property="og:image" content="${escapeHtml(image)}">`);
    html = html.replace(/<meta name="twitter:title" content=".*?">/, `<meta name="twitter:title" content="${escapeHtml(title)}">`);
    html = html.replace(/<meta name="twitter:description" content=".*?">/, `<meta name="twitter:description" content="${escapeHtml(description)}">`);
    html = html.replace(/<meta name="twitter:image" content=".*?">/, `<meta name="twitter:image" content="${escapeHtml(image)}">`);

    return res.send(html);
  } catch (error) {
    console.error('Share route error:', error);
    return res.redirect('/');
  }
});

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
      
      console.log(` Image compressed: ${req.file.originalname} → ${filename} (${(compressedBuffer.length / 1024).toFixed(2)}KB)`);
      
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
  res.sendFile(path.resolve(__dirname, '..', '365extra.html'));
});

// Serve blocked page
app.get('/blocked', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'blocked.html'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);


const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const FormData = require('form-data');
const http = require('http');
const https = require('https');
const jwt = require('jsonwebtoken');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api';

// Support multiple admin IDs - can be comma-separated in env
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_ID || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

// Token management
let currentToken = null;
let tokenExpiresAt = 0;

// Decode JWT without verification to check expiration
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

// Refresh token by calling login endpoint
const refreshToken = async () => {
  try {
    console.log('[Token Refresh] Attempting to login with:', process.env.ADMIN_EMAIL);
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    }, {
      timeout: 45000 // Increased timeout to 45 seconds for database operations
    });
    
    if (response.data.token) {
      currentToken = response.data.token;
      const decoded = decodeToken(currentToken);
      tokenExpiresAt = decoded?.exp ? decoded.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
      
      console.log('[Token Refresh]  Token refreshed successfully');
      return currentToken;
    }
  } catch (error) {
    console.error('[Token Refresh]  Failed to refresh token');
    if (error.response?.data) {
      console.error('[Token Refresh] Response error:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('[Token Refresh] Connection refused - server not ready yet');
    } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      console.error('[Token Refresh] Request timeout - database operation slow');
    } else if (error.code) {
      console.error('[Token Refresh] Error code:', error.code);
      console.error('[Token Refresh] Error message:', error.message);
    } else {
      console.error('[Token Refresh] Error:', error.toString());
    }
    throw error;
  }
};

// Initialize token on startup with retry logic
const initializeToken = async (maxRetries = 10) => {
  console.log('[Bot] Starting bot, waiting for server and database to be ready...');
  
  // First, wait for server to respond to health check
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const healthResponse = await axios.get(`${API_BASE_URL.replace('/api', '')}/health`, {
        timeout: 15000  // Increased timeout to allow database ping to complete
      });
      
      if (healthResponse.data.status === 'healthy') {
        console.log('[Bot] Server and database are ready');
        break;
      }
    } catch (error) {
      retries++;
      if (retries < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, retries - 1), 10000); // Exponential backoff
        console.log(`[Bot] Waiting for server ready... (attempt ${retries}/${maxRetries}, retrying in ${delayMs}ms)`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  if (retries >= maxRetries) {
    console.error('[Bot] Server health check failed after', maxRetries, 'attempts');
    process.exit(1);
  }
  
  // Now authenticate with the server
  retries = 0;
  while (retries < maxRetries) {
    try {
      await refreshToken();
      return; // Success
    } catch (error) {
      retries++;
      if (retries < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, retries - 1), 30000); // Exponential backoff, max 30s
        console.log(`[Bot] Token initialization failed, retrying in ${delayMs}ms... (attempt ${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  console.error('[Bot] Failed to initialize token after', maxRetries, 'attempts');
  process.exit(1);
};

// Setup connection pooling for better performance
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const api = axios.create({
  baseURL: API_BASE_URL,
  httpAgent: httpAgent,
  httpsAgent: httpsAgent,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to dynamically inject token
api.interceptors.request.use(
  config => {
    if (currentToken) {
      config.headers['Authorization'] = `Bearer ${currentToken}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Check token expiration and refresh if needed (check every 5 minutes)
setInterval(async () => {
  const now = Date.now();
  const timeUntilExpiry = tokenExpiresAt - now;
  
  // Refresh if token expires in less than 1 hour
  if (timeUntilExpiry < 60 * 60 * 1000) {
    try {
      await refreshToken();
    } catch (error) {
      console.error('[Token Refresh] Failed to refresh token:', error.message);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Add axios interceptor to handle 401 errors (token expired during request)
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        console.log('[Token Refresh] Detected 401 - Refreshing token...');
        await refreshToken();
        // Retry the original request with new token
        return api(originalRequest);
      } catch (refreshError) {
        console.error('[Token Refresh] Failed to refresh token:', refreshError.message);
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

// Add request throttling to prevent rate limiting
const requestQueue = [];
let isProcessing = false;
const MAX_CONCURRENT_REQUESTS = 100;

const queueRequest = async (fn) => {
  return new Promise((resolve, reject) => {
    requestQueue.push({ fn, resolve, reject });
    processQueue();
  });
};

const processQueue = async () => {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;

  while (requestQueue.length > 0) {
    const { fn, resolve, reject } = requestQueue.shift();
    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }

  isProcessing = false;
};

// Cache system with TTL
const cache = new Map();
const CACHE_DURATIONS = {
  products: 30000, // 30 seconds
  users: 60000, // 1 minute
  orders: 30000, // 30 seconds
  stats: 45000 // 45 seconds
};

const getCache = (key) => {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > cached.ttl) {
    cache.delete(key);
    return null;
  }
  return cached.data;
};

const setCache = (key, data, ttl = 30000) => {
  cache.set(key, { data, ttl, timestamp: Date.now() });
};

const SLIDER_IMAGES_MAX = 4;

const promptApartmentSliderImageCount = async (ctx, context) => {
  context.step = 'apartment_slider_image_count';
  return ctx.reply(` <b>Slider Image Count</b>

How many slider images do you want for this apartment? Enter a number between 1 and ${SLIDER_IMAGES_MAX}, or type SKIP to keep the current image only.`, { parse_mode: 'HTML' });
};

const finalizeApartmentSliderImages = async (ctx, context) => {
  const images = Array.isArray(context.sliderImages) && context.sliderImages.length > 0
    ? context.sliderImages.slice(0, SLIDER_IMAGES_MAX)
    : context.image
      ? [context.image]
      : [];

  context.images = images;
  if (images.length > 0) {
    context.image = images[0];
  }

  return saveApartmentListing(ctx, context);
};

const clearUserContext = (userId) => {
  delete userContext[userId];
};

const clearCache = (pattern) => {
  if (!pattern) {
    cache.clear();
  } else {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  }
};

// Rate limiting per user per command
const userRateLimits = new Map();
const RATE_LIMIT_WINDOW = 2000; // 2 seconds
const MAX_REQUESTS_PER_WINDOW = 3;

const checkRateLimit = (userId, command) => {
  const key = `${userId}:${command}`;
  const now = Date.now();
  
  if (!userRateLimits.has(key)) {
    userRateLimits.set(key, []);
  }
  
  const requests = userRateLimits.get(key);
  // Remove old requests outside window
  const validRequests = requests.filter(t => now - t < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  validRequests.push(now);
  userRateLimits.set(key, validRequests);
  return true;
};

// Store context for multi-step operations
const userContext = {};

// Cleanup old user contexts (prevent memory leaks)
setInterval(() => {
  const now = Date.now();
  for (const [userId, context] of Object.entries(userContext)) {
    if (now - (context.lastActivity || now) > 3600000) { // 1 hour
      delete userContext[userId];
    }
  }
}, 600000); // Every 10 minutes

// Safe editMessageText wrapper - handles "message not modified" error
const safeEditMessageText = async (ctx, text, options = {}) => {
  try {
    return await ctx.editMessageText(text, options);
  } catch (error) {
    if (error.message?.includes('message not modified')) {
      // Message content is identical, just acknowledge the callback
      return ctx.answerCbQuery('No changes', { show_alert: false }).catch(() => {});
    }
    throw error;
  }
};

// Global error wrapper for async handlers
const errorWrapper = (handler, command = '') => async (ctx) => {
  try {
    // Rate limiting check
    if (command && !checkRateLimit(ctx.from.id, command)) {
      return ctx.reply?.(' Please wait a moment before using this command again.');
    }
    
    // Mark user context as active
    if (userContext[ctx.from.id]) {
      userContext[ctx.from.id].lastActivity = Date.now();
    }
    
    return await handler(ctx);
  } catch (error) {
    console.error(`Handler error (${command}):`, error.message);
    try {
      // Only call answerCbQuery if this is a callback query
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery().catch(() => {});
      }
      if (error.message.includes('message not modified')) {
        return;
      }
      await ctx.reply?.(' Error processing request. Please try again.').catch(() => {});
    } catch (e) {
      console.error('Error sending error message:', e);
    }
  }
};

// Middleware to check admin
const isAdmin = (ctx) => {
  return ADMIN_IDS.includes(ctx.from.id);
};

const checkAdmin = async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply(' You are not authorized to use this bot.');
  }
};

// START COMMAND
bot.start(errorWrapper(async (ctx) => {
  // Admin users get the admin dashboard
  if (isAdmin(ctx)) {
    return ctx.reply(
      ' <b>365extra Admin Dashboard</b>\n\n' +
      ' <b>Available Commands:</b>\n\n' +
      ' <b>Products & Land:</b>\n' +
      ' /addproduct - Add product or land property\n' +
      ' /products - List all products & land\n' +
      ' /editproduct &lt;name&gt; - Edit product/land\n' +
      ' /deleteproduct &lt;name&gt; - Delete product/land\n\n' +
      ' <b>Categories:</b>\n' +
      ' /categories - List all categories\n' +
      ' /editcategory - Rename a category\n' +
      ' /deletecategory - Move products from one category to another\n\n' +
      ' <b>Users:</b>\n' +
      ' /users - List all users\n' +
      ' /user &lt;email&gt; - View user details\n\n' +
      ' <b>Orders:</b>\n' +
      ' /orders - List all orders\n' +
      ' /pendingorders - List pending orders\n' +
      ' /completedorders - List completed orders\n' +
      ' /order &lt;order_id&gt; - View order details\n\n' +
      ' <b>Stats:</b>\n' +
      ' /stats - View dashboard stats\n\n' +
      ' <b>Settings:</b>\n' +
      ' /settings - View & manage app settings (tax, shipping)\n\n' +
      'Or use the menu below:',
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback(' Products', 'products_menu')],
          [Markup.button.callback(' Land', 'land_menu')],
          [Markup.button.callback(' Apartments', 'apartment_menu')],
          [Markup.button.callback(' Orders', 'orders_menu')],
          [Markup.button.callback(' Users', 'users_menu')],
          [Markup.button.callback(' Stats', 'stats_menu')],
          [Markup.button.callback(' ⚙️ Settings', 'settings_menu')]
        ]).reply_markup
      }
    );
  }

  // Regular users get website access
  const websiteUrl = process.env.WEBSITE_URL || 'https://365extra.example.com';
  return ctx.reply(
    ' <b>Welcome to 365extra</b>\n\n' +
    'Premium Agricultural Exports from West Africa\n\n' +
    'Browse our collection of farm-fresh products, view analytics, and place orders on our website.',
    {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.url(' Open 365extra Website', websiteUrl)],
        [Markup.button.url(' View on Mobile', websiteUrl)]
      ]).reply_markup
    }
  );
}));

// COMMAND HANDLERS

// PRODUCTS COMMANDS
bot.command('products', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  // Check cache first
  let products = getCache('products');
  
  if (!products) {
    const response = await queueRequest(() => api.get('/products'));
    products = response.data.data || [];
    setCache('products', products, CACHE_DURATIONS.products);
  }

  if (products.length === 0) {
    return ctx.reply(' No products found.');
  }

  // Separate products, land, and apartments
  const agriProducts = products.filter(p => p.type !== 'land' && p.type !== 'apartment');
  const landProducts = products.filter(p => p.type === 'land');
  const apartments = products.filter(p => p.type === 'apartment');

  // Send agricultural products
  if (agriProducts.length > 0) {
    await ctx.reply(' <b>Agricultural Products</b>\n\nShowing up to 5 products:', { parse_mode: 'HTML' });
    
    for (let i = 0; i < Math.min(agriProducts.length, 5); i++) {
      const p = agriProducts[i];
      const caption = ` <b>${p.name}</b>\n\n` +
        ` Price: ${p.pricePerKg.toLocaleString()}/${p.unit || 'kg'}\n` +
        ` Stock: ${p.quantity}${p.unit || 'kg'}\n` +
        ` Unit: ${p.unit || 'kg'}\n` +
        ` Order Range: ${p.minLimit || 'N/A'} - ${p.maxLimit || 'N/A'} ${p.unit || 'kg'}\n` +
        ` Category: ${p.category || 'N/A'}\n` +
        ` ${p.description || 'No description'}\n` +
        ` ID: <code>${p._id}</code>`;

      if (p.image) {
        await ctx.replyWithPhoto(p.image, {
          caption: caption,
          parse_mode: 'HTML'
        });
      } else {
        await ctx.reply(caption, { parse_mode: 'HTML' });
      }
    }
  }

  // Send land products
  if (landProducts.length > 0) {
    await ctx.reply(' <b>Land Properties</b>\n\nShowing up to 5 properties:', { parse_mode: 'HTML' });
    
    for (let i = 0; i < Math.min(landProducts.length, 5); i++) {
      const land = landProducts[i];
      const pricePerUnit = land.landPricingType === 'fixed' 
        ? land.pricePerPlot 
        : (land.pricePerSqMeter * land.areaSqMeters);
      
      const caption = ` <b>${land.name}</b>\n\n` +
        ` Location: ${land.location}\n` +
        ` Area: ${land.areaSqMeters.toLocaleString()} m\n` +
        ` Plots: ${land.numberOfPlots}\n` +
        ` Legal Status: ${land.legalStatus}\n` +
        ` Access: ${land.accessibility.replace('-', ' ').toUpperCase()}\n` +
        ` Price: ${pricePerUnit.toLocaleString()}${land.landPricingType === 'per-meter' ? '/m' : '/plot'}\n` +
        ` Unit: ${land.unit || 'plots'}\n` +
        ` Order Range: ${land.minLimit || 'N/A'} - ${land.maxLimit || 'N/A'} ${land.unit || 'plots'}\n` +
        ` ${land.description || 'Premium land property'}\n` +
        ` ID: <code>${land._id}</code>`;

      if (land.image) {
        await ctx.replyWithPhoto(land.image, {
          caption: caption,
          parse_mode: 'HTML'
        });
      } else {
        await ctx.reply(caption, { parse_mode: 'HTML' });
      }
    }
  }

  // Send apartments
  if (apartments.length > 0) {
    await ctx.reply(' <b>Apartments</b>\n\nShowing up to 5 listings:', { parse_mode: 'HTML' });
    
    for (let i = 0; i < Math.min(apartments.length, 5); i++) {
      const apt = apartments[i];
      const typeLabel = {
        'room': '🏠 Single Room',
        'self-contained': '🏠 Self-Contained',
        'house': '🏡 House',
        'flat': '🏢 Flat'
      }[apt.apartmentType] || apt.apartmentType;
      
      const listingLabel = apt.listingType === 'rent' ? 'For Rent' : 'For Sale';
      const priceDisplay = apt.listingType === 'rent' 
        ? `${apt.pricePerMonth.toLocaleString()}/month`
        : `${apt.price.toLocaleString()} (total)`;
      
      const caption = ` <b>${apt.name}</b>\n\n` +
        ` Type: ${typeLabel}\n` +
        ` Location: ${apt.apartmentAddress}\n` +
        ` ${apt.bedrooms}BR / ${apt.bathrooms}BA • ${apt.apartmentAreaSqMeters}m²\n` +
        ` Status: ${apt.furnished ? '✓ Furnished' : '○ Unfurnished'}\n` +
        ` Listing: ${listingLabel}\n` +
        ` Price: ${priceDisplay}\n` +
        `${apt.apartmentFeatures && apt.apartmentFeatures.length > 0 ? ` Features: ${apt.apartmentFeatures.join(', ')}\n` : ''}` +
        ` ${apt.description || 'Premium apartment'}\n` +
        ` ID: <code>${apt._id}</code>`;

      if (apt.image) {
        await ctx.replyWithPhoto(apt.image, {
          caption: caption,
          parse_mode: 'HTML'
        });
      } else {
        await ctx.reply(caption, { parse_mode: 'HTML' });
      }
    }
  }

  // Send summary message
  const summaryMessage = ` <b>Products Summary</b>\n\n` +
    ` Agricultural Products: ${agriProducts.length}\n` +
    ` Land Properties: ${landProducts.length}\n` +
    ` Apartments: ${apartments.length}\n` +
    `\nTotal: ${products.length} items`;

  ctx.reply(summaryMessage, { parse_mode: 'HTML' });
}));

bot.command('addproduct', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  userContext[ctx.from.id] = { step: 'choose_product_type', command: 'addproduct' };
  ctx.reply(' <b>Add New Item</b>\n\nWhat would you like to add?', {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback(' Agricultural Product', 'add_product_type')],
      [Markup.button.callback(' Land Property', 'add_land_type')],
      [Markup.button.callback(' Apartment', 'add_apartment_type')]
    ]).reply_markup
  });
}));

bot.command('editproduct', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length === 0) {
    return ctx.reply(' Usage: /editproduct &lt;product_name&gt;\n\nExample: /editproduct "Rice Premium"', { parse_mode: 'HTML' });
  }

  const productName = args.join(' ');
  try {
    // Search for product by name
    const response = await api.get('/products');
    const products = response.data.data || [];
    const product = products.find(p => p.name.toLowerCase() === productName.toLowerCase());

    if (!product) {
      return ctx.reply(` Product "${productName}" not found.\n\nUse /products to see all available products.`);
    }

    userContext[ctx.from.id] = { step: 'edit_product_select_field', productId: product._id, command: 'editproduct' };

    ctx.reply(` <b>Edit Product: ${product.name}</b>\n\nWhat would you like to edit?\n\n1. Name\n2. Description\n3. Price\n4. Quantity\n5. Category\n6. Unit of Measurement\n7. Minimum Order Limit\n8. Maximum Order Limit\n\nReply with the number:`, { parse_mode: 'HTML' });
  } catch (error) {
    ctx.reply(' Error: ' + error.message);
  }
}));

bot.command('deleteproduct', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length === 0) {
    return ctx.reply(' Usage: /deleteproduct &lt;product_name&gt;\n\nExample: /deleteproduct "Rice Premium"', { parse_mode: 'HTML' });
  }

  const productName = args.join(' ');
  try {
    // Search for product by name
    const response = await api.get('/products');
    const products = response.data.data || [];
    const product = products.find(p => p.name.toLowerCase() === productName.toLowerCase());

    if (!product) {
      return ctx.reply(` Product "${productName}" not found.\n\nUse /products to see all available products.`);
    }

    userContext[ctx.from.id] = { step: 'delete_product_confirm', productId: product._id, command: 'deleteproduct' };

    ctx.reply(` <b>Delete Product: ${product.name}</b>\n\nAre you sure you want to delete this product?\n\nType "CONFIRM" to delete or "CANCEL" to abort:`, { parse_mode: 'HTML' });
  } catch (error) {
    ctx.reply(' Error: ' + error.message);
  }
}));

// CATEGORY COMMANDS
bot.command('categories', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  try {
    const response = await api.get('/products');
    const products = response.data.data || [];
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

    if (categories.length === 0) {
      return ctx.reply(' No categories found.');
    }

    let message = ' <b>All Categories</b>\n\n';
    categories.forEach((cat, i) => {
      const count = products.filter(p => p.category === cat).length;
      message += `${i + 1}. <b>${cat}</b> (${count} product${count !== 1 ? 's' : ''})\n`;
    });

    ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    ctx.reply(' Error: ' + error.message);
  }
}));

bot.command('editcategory', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  try {
    const response = await api.get('/products');
    const products = response.data.data || [];
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

    if (categories.length === 0) {
      return ctx.reply(' No categories found.');
    }

    userContext[ctx.from.id] = { step: 'edit_category_select', command: 'editcategory' };

    let message = ' <b>Rename Category</b>\n\nSelect a category to rename:\n\n';
    categories.forEach((cat, i) => {
      message += `${i + 1}. ${cat}\n`;
    });
    message += `\nReply with the number (1-${categories.length}):`;

    ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    ctx.reply(' Error: ' + error.message);
  }
}));

bot.command('deletecategory', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  try {
    const response = await api.get('/products');
    const products = response.data.data || [];
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

    if (categories.length === 0) {
      return ctx.reply(' No categories found.');
    }

    userContext[ctx.from.id] = { step: 'delete_category_select_source', command: 'deletecategory' };

    let message = ' <b>Move Products from Category</b>\n\nSelect the category to move from:\n\n';
    categories.forEach((cat, i) => {
      const count = products.filter(p => p.category === cat).length;
      message += `${i + 1}. ${cat} (${count} product${count !== 1 ? 's' : ''})\n`;
    });
    message += `\nReply with the number (1-${categories.length}):`;

    ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    ctx.reply(' Error: ' + error.message);
  }
}));

// USERS COMMANDS
bot.command('users', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  try {
    const response = await api.get('/auth/users'); // Assuming there's a users endpoint
    const users = response.data.data || [];


    if (users.length === 0) {
      return ctx.reply(' No users found.');
    }

    let message = ' <b>All Users</b>\n\n';
    users.slice(0, 20).forEach((u, i) => {
      message += `${i + 1}. <b>${u.firstName} ${u.lastName}</b>\n`;
      message += `   Email: ${u.email}\n`;
      message += `   Type: ${u.accountType}\n`;
      message += `   ID: <code>${u._id}</code>\n\n`;
    });

    if (users.length > 20) {
      message += `... and ${users.length - 20} more users`;
    }

    ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    ctx.reply(' Error: ' + error.message);
  }
}));

bot.command('user', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length === 0) {
    return ctx.reply(' Usage: /user &lt;email&gt;\n\nExample: /user john@example.com', { parse_mode: 'HTML' });
  }

  const userEmail = args[0];
  try {
    // Get all users and find by email
    const response = await api.get('/auth/users');
    const users = response.data.data || [];
    const user = users.find(u => u.email.toLowerCase() === userEmail.toLowerCase());

    if (!user) {
      return ctx.reply(` User with email "${userEmail}" not found.\n\nUse /users to see all registered users.`);
    }

    const message = ` <b>User Details</b>\n\n` +
      `Name: <b>${user.firstName} ${user.lastName}</b>\n` +
      `Email: ${user.email}\n` +
      `Phone: ${user.phone || 'N/A'}\n` +
      `Account Type: ${user.accountType}\n` +
      `Verified: ${user.isVerified ? '' : ''}\n` +
      `Joined: ${new Date(user.createdAt).toLocaleDateString()}\n` +
      `ID: <code>${user._id}</code>`;

    ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    ctx.reply(' Error: ' + error.message);
  }
}));

// ORDERS COMMANDS
bot.command('orders', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  try {
    const response = await api.get('/orders/all');
    const orders = response.data.data || [];

    if (orders.length === 0) {
      return ctx.reply(' No orders found.');
    }

    let message = ' <b>All Orders</b>\n\n';
    orders.slice(0, 10).forEach((o, i) => {
      message += `${i + 1}. Order <code>${o._id.slice(-8)}</code>\n`;
      message += `   Status: ${o.status}\n`;
      message += `   Total: ${o.total.toLocaleString()}\n`;
      message += `   Date: ${new Date(o.createdAt).toLocaleDateString()}\n\n`;
    });

    if (orders.length > 10) {
      message += `... and ${orders.length - 10} more orders`;
    }

    ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    ctx.reply(' Error: ' + error.message);
  }
}));

bot.command('pendingorders', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  try {
    const response = await api.get('/orders/all');
    const allOrders = response.data.data || [];
    const orders = allOrders.filter(o => o.status === 'pending');

    if (orders.length === 0) {
      return ctx.reply(' No pending orders found.');
    }

    let message = ' <b>Pending Orders</b>\n\n';
    orders.forEach((o, i) => {
      message += `${i + 1}. Order <code>${o._id.slice(-8)}</code>\n`;
      message += `   Total: ${o.total.toLocaleString()}\n`;
      message += `   Date: ${new Date(o.createdAt).toLocaleDateString()}\n\n`;
    });

    ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    ctx.reply(' Error: ' + error.message);
  }
}));

bot.command('completedorders', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  try {
    const response = await api.get('/orders/all');
    const allOrders = response.data.data || [];
    const orders = allOrders.filter(o => o.status === 'completed');

    if (orders.length === 0) {
      return ctx.reply(' No completed orders found.');
    }

    let message = ' <b>Completed Orders</b>\n\n';
    orders.forEach((o, i) => {
      message += `${i + 1}. Order <code>${o._id.slice(-8)}</code>\n`;
      message += `   Total: ${o.total.toLocaleString()}\n`;
      message += `   Date: ${new Date(o.createdAt).toLocaleDateString()}\n\n`;
    });

    ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    ctx.reply(' Error: ' + error.message);
  }
}));

bot.command('order', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length === 0) {
    return ctx.reply(' Usage: /order &lt;order_id&gt;\n\nExample: /order 507f1f77bcf86cd799439011\n\n Tip: You can use the short ID shown in /orders lists', { parse_mode: 'HTML' });
  }

  const orderId = args[0];
  try {
    const response = await api.get(`/orders/${orderId}`);
    const order = response.data.data;

    let message = ` <b>Order Details</b>\n\n` +
      `Order ID: <code>${order._id}</code>\n` +
      `Status: ${order.status}\n` +
      `Total: ${order.total.toLocaleString()}\n` +
      `Date: ${new Date(order.createdAt).toLocaleDateString()}\n\n` +
      ` <b>Customer:</b>\n${order.buyer.firstName} ${order.buyer.lastName}\n${order.buyer.email}\n\n` +
      ` <b>Items:</b>\n`;

    order.items.forEach((item, i) => {
      message += `${i + 1}. ${item.product.name}\n`;
      message += `   Quantity: ${item.quantity}kg\n`;
      message += `   Weight: ${item.weight}kg\n`;
      message += `   Price: ${item.pricePerUnit}/kg\n`;
      message += `   Subtotal: ${item.subtotal.toLocaleString()}\n\n`;
    });

    ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    ctx.reply(' Error: ' + error.message);
  }
}));

// STATS COMMAND
bot.command('stats', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  // Check cache first
  let statsData = getCache('stats');
  
  if (!statsData) {
    const [productsRes, ordersRes, usersRes] = await Promise.all([
      queueRequest(() => api.get('/products')),
      queueRequest(() => api.get('/orders/all')),
      queueRequest(() => api.get('/users'))
    ]);

    const products = productsRes.data.data || [];
    const orders = ordersRes.data.data || [];
    const users = usersRes.data.data || [];

    const totalRevenue = orders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + o.total, 0);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const completedOrders = orders.filter(o => o.status === 'completed').length;

    // Recent orders (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrders = orders.filter(o => new Date(o.createdAt) > thirtyDaysAgo).length;

    statsData = { products, orders, users, totalRevenue, pendingOrders, completedOrders, recentOrders };
    setCache('stats', statsData, CACHE_DURATIONS.stats);
  }

  const message = ` <b>365extra Statistics</b>\n\n` +
    ` Products: <b>${statsData.products.length}</b>\n` +
    ` Users: <b>${statsData.users.length}</b>\n` +
    ` Total Orders: <b>${statsData.orders.length}</b>\n` +
    ` Pending Orders: <b>${statsData.pendingOrders}</b>\n` +
    ` Completed Orders: <b>${statsData.completedOrders}</b>\n` +
    ` Total Revenue: <b>${statsData.totalRevenue.toLocaleString()}</b>\n` +
    ` Orders (30 days): <b>${statsData.recentOrders}</b>`;

  ctx.reply(message, { parse_mode: 'HTML' });
}));

// SETTINGS COMMAND
bot.command('settings', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  try {
    const settingsRes = await queueRequest(() => api.get('/settings'));
    const settings = settingsRes.data.data || { taxRate: 10, shippingFee: 2500 };

    const message = ` <b>Current Settings</b>\n\n` +
      ` <b>Tax Rate:</b> ${settings.taxRate}%\n` +
      ` <b>Shipping Fee:</b> ₦${settings.shippingFee.toLocaleString()}\n\n` +
      `Use the menu below to update:`;

    ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('📊 Set Tax Rate', 'settings_tax')],
        [Markup.button.callback('🚚 Set Shipping Fee', 'settings_shipping')],
        [Markup.button.callback(' Back', 'main_menu')]
      ]).reply_markup
    });
  } catch (error) {
    ctx.reply('Error fetching settings: ' + error.message);
  }
}));

// SETTINGS MENU
bot.action('settings_menu', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const settingsRes = await queueRequest(() => api.get('/settings'));
    const settings = settingsRes.data.data || { taxRate: 10, shippingFee: 2500 };

    const message = ` <b>Current Settings</b>\n\n` +
      ` <b>Tax Rate:</b> ${settings.taxRate}%\n` +
      ` <b>Shipping Fee:</b> ₦${settings.shippingFee.toLocaleString()}\n\n` +
      `Use the menu below to update:`;

    return safeEditMessageText(ctx, message, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('📊 Set Tax Rate', 'settings_tax')],
        [Markup.button.callback('🚚 Set Shipping Fee', 'settings_shipping')],
        [Markup.button.callback(' Back', 'main_menu')]
      ]).reply_markup
    });
  } catch (error) {
    ctx.reply('Error: ' + error.message);
  }
});

// SET TAX RATE
bot.action('settings_tax', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'update_tax_rate' };
  ctx.reply('📊 Enter new tax rate (0-100):');
});

// SET SHIPPING FEE
bot.action('settings_shipping', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'update_shipping_fee' };
  ctx.reply('🚚 Enter new shipping fee (in Naira):');
});

// Handle numeric input - for both settings and product/land creation
bot.hears(/^(\d+(?:\.\d{1,2})?)$/, errorWrapper(async (ctx) => {
  const userId = ctx.from.id;
  const userCtx = userContext[userId];
  
  // If in product/land creation, delegate to text handler logic
  if (userCtx && (userCtx.step?.includes('product') || userCtx.step?.includes('land'))) {
    console.log(`[Bot] Numeric input during ${userCtx.step} - delegating to text handler`);
    
    // Manually trigger the text handler logic for product/land prices
    const context = userCtx;
    if (context.step === 'create_product_price') {
      console.log(`[Bot] Processing price for user ${userId}, text: "${ctx.message.text}"`);
      context.pricePerKg = parseFloat(ctx.message.text);
      if (isNaN(context.pricePerKg)) {
        console.log(`[Bot] Invalid price: ${ctx.message.text}`);
        return ctx.reply(' Invalid price. Enter a number:');
      }
      console.log(`[Bot] Price set to ${context.pricePerKg}, moving to category step`);
      context.step = 'create_product_category';
      console.log(`[Bot] Sending category options...`);
      
      // Fetch categories dynamically from backend
      try {
        const categoriesResponse = await axios.get(`${API_BASE_URL}/products/categories`, { timeout: 5000 });
        let categories = categoriesResponse.data?.data || [];
        
        // Build keyboard with dynamic categories
        let keyboard = [];
        
        // Add up to 8 categories in rows of 2
        for (let i = 0; i < Math.min(categories.length, 8); i += 2) {
          const row = [];
          row.push(Markup.button.callback(categories[i], `cat_${categories[i]}`));
          if (i + 1 < categories.length) {
            row.push(Markup.button.callback(categories[i + 1], `cat_${categories[i + 1]}`));
          }
          keyboard.push(row);
        }
        
        // Always add custom category option
        keyboard.push([Markup.button.callback('➕ Custom Category', 'cat_custom')]);
        
        console.log('[Bot] Fetched categories:', categories);
        
        return ctx.reply('📂 <b>Select Category</b>\n\nChoose from existing categories or create a custom one:', {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
        }).then(() => {
          console.log(`[Bot] Dynamic category options sent successfully`);
        }).catch(err => {
          console.error(`[Bot] Failed to send category options:`, err.message);
        });
      } catch (error) {
        console.error('[Bot] Failed to fetch categories, using fallback:', error.message);
        
        // Fallback to hardcoded if API fails
        return ctx.reply('📂 <b>Select Category</b>\n\nChoose from available categories or create a custom one:', {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Smoked Fish', 'cat_Smoked Fish'), Markup.button.callback('Grains', 'cat_Grains')],
            [Markup.button.callback('Rice', 'cat_Rice'), Markup.button.callback('Other', 'cat_Other')],
            [Markup.button.callback('➕ Custom Category', 'cat_custom')]
          ]).reply_markup
        }).then(() => {
          console.log(`[Bot] Fallback category options sent`);
        }).catch(err => {
          console.error(`[Bot] Failed to send fallback category options:`, err.message);
        });
      }
    } else if (context.step === 'custom_category_input') {
      // Handle custom category input
      const customCategory = ctx.message.text?.trim();
      if (!customCategory || customCategory.length === 0) {
        return ctx.reply('❌ Category name cannot be empty. Please enter a category name:');
      }
      if (customCategory.length > 50) {
        return ctx.reply('❌ Category name is too long (max 50 characters). Please try again:');
      }
      context.category = customCategory;
      context.step = 'create_product_quantity';
      return ctx.reply(' <b>Stock Quantity</b>\n\nEnter the available quantity in kg (e.g., 1000):', { parse_mode: 'HTML' });
    } else if (context.step === 'create_product_quantity') {
      context.quantity = parseFloat(ctx.message.text);
      if (isNaN(context.quantity)) {
        return ctx.reply(' Invalid quantity. Enter a number:');
      }
      context.step = 'create_product_unit';
      return ctx.reply(' <b>Unit of Measurement</b>\n\nEnter the unit for this product:\n\n<b>Examples:</b> kg, pieces, plots, acres, hectares, boxes, bags, liters, tons, pack, cartons, bundles, etc.\n\n<i>You can use any custom unit!</i>', { parse_mode: 'HTML' });
    }
    
    // For other numeric steps during product/land creation, just return to let normal flow continue
    return;
  }
  
  // Otherwise handle as settings input (legacy - should not reach here now)
  if (!isAdmin(ctx)) return;

  const value = parseFloat(ctx.message.text);
  try {
    if (ctx.session?.awaitingInput === 'tax_rate') {
      if (value < 0 || value > 100) {
        return ctx.reply('❌ Tax rate must be between 0 and 100%');
      }
      await queueRequest(() => api.put('/settings', { taxRate: value }));
      ctx.reply(`✅ Tax rate updated to ${value}%`);
    } else if (ctx.session?.awaitingInput === 'shipping_fee') {
      if (value < 0) {
        return ctx.reply('❌ Shipping fee cannot be negative');
      }
      await queueRequest(() => api.put('/settings', { shippingFee: value }));
      ctx.reply(`✅ Shipping fee updated to ₦${value.toLocaleString()}`);
    }
    
    // Clear the awaiting input flag
    if (ctx.session) ctx.session.awaitingInput = null;
  } catch (error) {
    ctx.reply('❌ Error: ' + error.message);
  }
}));

// PRODUCTS MENU
bot.action('products_menu', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.editMessageText(
    ' Products Management\n\nSelect action:',
    Markup.inlineKeyboard([
      [Markup.button.callback('View All', 'products_list')],
      [Markup.button.callback('Create New', 'products_create')],
      [Markup.button.callback('Search Product', 'products_search')],
      [Markup.button.callback(' Back', 'main_menu')]
    ])
  );
});

// LAND MENU
bot.action('land_menu', async (ctx) => {
  await ctx.answerCbQuery();
  return safeEditMessageText(ctx,
    ' Land Properties Management\n\nSelect action:',
    Markup.inlineKeyboard([
      [Markup.button.callback('View All Land', 'land_list')],
      [Markup.button.callback('Create New', 'land_create')],
      [Markup.button.callback('Search Land', 'land_search')],
      [Markup.button.callback(' Back', 'main_menu')]
    ])
  );
});

bot.action('land_create', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'create_land_name', type: 'land', command: 'addland' };
  return ctx.editMessageText(' <b>Create New Land Property</b>\n\nEnter property name:', { parse_mode: 'HTML' });
});

bot.action('land_list', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const response = await api.get('/products');
    const products = response.data.data || [];
    const landProducts = products.filter(p => p.type === 'land');

    if (landProducts.length === 0) {
      return ctx.editMessageText(' No land properties found.');
    }

    await ctx.editMessageText(' <b>Land Properties</b>\n\nShowing available properties:', { parse_mode: 'HTML' });
    
    for (let i = 0; i < Math.min(landProducts.length, 5); i++) {
      const land = landProducts[i];
      const pricePerUnit = land.landPricingType === 'fixed' 
        ? land.pricePerPlot 
        : (land.pricePerSqMeter * land.areaSqMeters);
      
      const caption = ` <b>${land.name}</b>\n\n` +
        ` Location: ${land.location}\n` +
        ` Area: ${land.areaSqMeters.toLocaleString()} m\n` +
        ` Plots: ${land.numberOfPlots}\n` +
        ` Legal Status: ${land.legalStatus}\n` +
        ` Access: ${land.accessibility.replace('-', ' ').toUpperCase()}\n` +
        ` Price: ${pricePerUnit.toLocaleString()}${land.landPricingType === 'per-meter' ? '/m' : '/plot'}\n` +
        ` Unit: ${land.unit || 'plots'}\n` +
        ` Order Range: ${land.minLimit || 'N/A'} - ${land.maxLimit || 'N/A'} ${land.unit || 'plots'}\n` +
        ` ${land.description || 'Premium land property'}\n` +
        ` ID: <code>${land._id}</code>`;

      if (land.image) {
        await ctx.replyWithPhoto(land.image, {
          caption: caption,
          parse_mode: 'HTML'
        });
      } else {
        await ctx.reply(caption, { parse_mode: 'HTML' });
      }
    }

    return ctx.reply(` <b>Summary</b>\n\nTotal Properties: ${landProducts.length}`, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback(' Back', 'land_menu')]
      ]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error: ' + error.message);
  }
});

bot.action('land_search', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'search_land' };
  return ctx.editMessageText(' <b>Search Land Properties</b>\n\nEnter location or property name:', { parse_mode: 'HTML' });
});

// APARTMENT MENU
bot.action('apartment_menu', async (ctx) => {
  await ctx.answerCbQuery();
  return safeEditMessageText(ctx,
    ' Apartments Management\n\nSelect action:',
    Markup.inlineKeyboard([
      [Markup.button.callback('View All Apartments', 'apartment_list')],
      [Markup.button.callback('Create New', 'apartment_create')],
      [Markup.button.callback('Search Apartments', 'apartment_search')],
      [Markup.button.callback(' Back', 'main_menu')]
    ])
  );
});

bot.action('apartment_create', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'create_apartment_type_custom', type: 'apartment', command: 'addapartment' };
  return ctx.editMessageText(' <b>Create New Apartment</b>\n\nEnter apartment type:\n\n<b>Examples:</b> Room, Self-Contained, House, Flat, Studio, Penthouse, Duplex, Bungalow, Villa, etc.\n\n<i>You can use any custom type!</i>', { parse_mode: 'HTML' });
});

bot.action('apartment_list', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const response = await api.get('/products');
    const products = response.data.data || [];
    const apartments = products.filter(p => p.type === 'apartment');

    if (apartments.length === 0) {
      return ctx.editMessageText(' No apartments found.');
    }

    await ctx.editMessageText(' <b>Apartments</b>\n\nShowing available listings:', { parse_mode: 'HTML' });
    
    for (let i = 0; i < Math.min(apartments.length, 5); i++) {
      const apt = apartments[i];
      const typeLabel = {
        'room': '🏠 Single Room',
        'self-contained': '🏠 Self-Contained',
        'house': '🏡 House',
        'flat': '🏢 Flat'
      }[apt.apartmentType] || apt.apartmentType;
      
      const listingLabel = apt.listingType === 'rent' ? 'For Rent' : 'For Sale';
      const priceDisplay = apt.listingType === 'rent' 
        ? `${apt.pricePerMonth.toLocaleString()}/month`
        : `${apt.price.toLocaleString()} (total)`;
      
      const caption = ` <b>${apt.name}</b>\n\n` +
        ` Type: ${typeLabel}\n` +
        ` Location: ${apt.apartmentAddress}\n` +
        ` ${apt.bedrooms}BR / ${apt.bathrooms}BA\n` +
        ` Size: ${apt.apartmentAreaSqMeters}m²\n` +
        ` Status: ${apt.furnished ? '✓ Furnished' : '○ Unfurnished'}\n` +
        ` Listing: ${listingLabel}\n` +
        ` Price: ${priceDisplay}\n` +
        `${apt.apartmentFeatures && apt.apartmentFeatures.length > 0 ? ` Features: ${apt.apartmentFeatures.join(', ')}\n` : ''}` +
        ` ${apt.description || 'Premium apartment'}\n` +
        ` ID: <code>${apt._id}</code>`;

      if (apt.image) {
        await ctx.replyWithPhoto(apt.image, {
          caption: caption,
          parse_mode: 'HTML'
        });
      } else {
        await ctx.reply(caption, { parse_mode: 'HTML' });
      }
    }

    return ctx.reply(` <b>Summary</b>\n\nTotal Apartments: ${apartments.length}`, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback(' Back', 'apartment_menu')]
      ]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error: ' + error.message);
  }
});

bot.action('apartment_search', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'search_apartment' };
  return ctx.editMessageText(' <b>Search Apartments</b>\n\nEnter location, apartment name, or features:', { parse_mode: 'HTML' });
});

// First products_list handler (updated with land display)
bot.action('products_list', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const response = await api.get('/products');
    const products = response.data.data || [];

    if (products.length === 0) {
      return ctx.editMessageText(' No products found.');
    }

    // Separate products and land
    const agriProducts = products.filter(p => p.type !== 'land');
    const landProducts = products.filter(p => p.type === 'land');

    // Send agricultural products
    if (agriProducts.length > 0) {
      await ctx.editMessageText(' <b>Agricultural Products</b>\n\nShowing up to 5 products:', { parse_mode: 'HTML' });
      
      for (let i = 0; i < Math.min(agriProducts.length, 5); i++) {
        const p = agriProducts[i];
        const caption = ` <b>${p.name}</b>\n\n` +
          ` Price: ${p.pricePerKg}/${p.unit || 'kg'}\n` +
          ` Stock: ${p.quantity}${p.unit || 'kg'}\n` +
          ` Unit: ${p.unit || 'kg'}\n` +
          ` Order Range: ${p.minLimit || 'N/A'} - ${p.maxLimit || 'N/A'} ${p.unit || 'kg'}\n` +
          ` Category: ${p.category || 'N/A'}\n` +
          ` ${p.description || 'No description'}\n` +
          ` ID: <code>${p._id}</code>`;

        if (p.image) {
          await ctx.replyWithPhoto(p.image, {
            caption: caption,
            parse_mode: 'HTML'
          });
        } else {
          await ctx.reply(caption, { parse_mode: 'HTML' });
        }
      }
    }

    // Send land products
    if (landProducts.length > 0) {
      await ctx.reply(' <b>Land Properties</b>\n\nShowing up to 5 properties:', { parse_mode: 'HTML' });
      
      for (let i = 0; i < Math.min(landProducts.length, 5); i++) {
        const land = landProducts[i];
        const pricePerUnit = land.landPricingType === 'fixed' 
          ? land.pricePerPlot 
          : (land.pricePerSqMeter * land.areaSqMeters);
        
        const caption = ` <b>${land.name}</b>\n\n` +
          ` Location: ${land.location}\n` +
          ` Area: ${land.areaSqMeters.toLocaleString()} m\n` +
          ` Plots: ${land.numberOfPlots}\n` +
          ` Legal Status: ${land.legalStatus}\n` +
          ` Access: ${land.accessibility.replace('-', ' ').toUpperCase()}\n` +
          ` Price: ${pricePerUnit.toLocaleString()}${land.landPricingType === 'per-meter' ? '/m' : '/plot'}\n` +
          ` Unit: ${land.unit || 'plots'}\n` +
          ` Order Range: ${land.minLimit || 'N/A'} - ${land.maxLimit || 'N/A'} ${land.unit || 'plots'}\n` +
          ` ${land.description || 'Premium land property'}\n` +
          ` ID: <code>${land._id}</code>`;

        if (land.image) {
          await ctx.replyWithPhoto(land.image, {
            caption: caption,
            parse_mode: 'HTML'
          });
        } else {
          await ctx.reply(caption, { parse_mode: 'HTML' });
        }
      }
    }

    // Send summary
    let summaryMessage = ` <b>Inventory Summary</b>\n\n` +
      ` Agricultural Products: ${agriProducts.length}\n` +
      ` Land Properties: ${landProducts.length}\n` +
      `\nTotal: ${products.length} items`;

    return ctx.reply(summaryMessage, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback(' Back', 'products_menu')]
      ]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error: ' + error.message);
  }
});

bot.action('products_create', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'create_product_name' };
  return ctx.editMessageText(' Create New Product\n\nEnter product name:');
});

// Add product type selector actions
bot.action('add_product_type', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'create_product_name', type: 'product', command: 'addproduct' };
  console.log(`[Bot] Product creation started for user ${ctx.from.id}`);
  return ctx.editMessageText(' <b>Create New Product</b>\n\nEnter product name:', { parse_mode: 'HTML' });
});

bot.action('add_land_type', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'create_land_name', type: 'land', command: 'addland' };
  console.log(`[Bot] Land creation started for user ${ctx.from.id}`);
  return ctx.editMessageText(' <b>Create New Land Property</b>\n\nEnter property name:', { parse_mode: 'HTML' });
});

bot.action('add_apartment_type', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'apartment_type_select', type: 'apartment', command: 'addapartment' };
  console.log(`[Bot] Apartment creation started for user ${ctx.from.id}`);
  return ctx.editMessageText(' <b>Create New Apartment Listing</b>\n\nSelect apartment type:', {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('🏠 Room', 'apt_type_room')],
      [Markup.button.callback('🏠 Self-Contained', 'apt_type_selfcontained')],
      [Markup.button.callback('🏡 House', 'apt_type_house')],
      [Markup.button.callback('🏢 Flat', 'apt_type_flat')]
    ]).reply_markup
  });
});

// Apartment type selection callbacks
bot.action('apt_type_room', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id].type = 'apartment';
  userContext[ctx.from.id].apartmentType = 'room';
  userContext[ctx.from.id].step = 'apartment_listing_type';
  return ctx.editMessageText(' <b>Listing Type</b>\n\nIs this apartment for rent or sale?', {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('💰 For Rent', 'apt_listing_rent')],
      [Markup.button.callback('🏷️ For Sale', 'apt_listing_sale')]
    ]).reply_markup
  });
});

bot.action('apt_type_selfcontained', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id].type = 'apartment';
  userContext[ctx.from.id].apartmentType = 'self-contained';
  userContext[ctx.from.id].step = 'apartment_listing_type';
  return ctx.editMessageText(' <b>Listing Type</b>\n\nIs this apartment for rent or sale?', {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('💰 For Rent', 'apt_listing_rent')],
      [Markup.button.callback('🏷️ For Sale', 'apt_listing_sale')]
    ]).reply_markup
  });
});

bot.action('apt_type_house', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id].type = 'apartment';
  userContext[ctx.from.id].apartmentType = 'house';
  userContext[ctx.from.id].step = 'apartment_listing_type';
  return ctx.editMessageText(' <b>Listing Type</b>\n\nIs this apartment for rent or sale?', {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('💰 For Rent', 'apt_listing_rent')],
      [Markup.button.callback('🏷️ For Sale', 'apt_listing_sale')]
    ]).reply_markup
  });
});

bot.action('apt_type_flat', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id].type = 'apartment';
  userContext[ctx.from.id].apartmentType = 'flat';
  userContext[ctx.from.id].step = 'apartment_listing_type';
  return ctx.editMessageText(' <b>Listing Type</b>\n\nIs this apartment for rent or sale?', {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('💰 For Rent', 'apt_listing_rent')],
      [Markup.button.callback('🏷️ For Sale', 'apt_listing_sale')]
    ]).reply_markup
  });
});

// Apartment listing type selection
bot.action('apt_listing_rent', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id].listingType = 'rent';
  userContext[ctx.from.id].step = 'create_apartment_name';
  return ctx.editMessageText(' <b>Create New Apartment</b>\n\nEnter apartment name (e.g., "Luxury 2BR Lekki"):', { parse_mode: 'HTML' });
});

bot.action('apt_listing_sale', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id].listingType = 'sale';
  userContext[ctx.from.id].step = 'create_apartment_name';
  return ctx.editMessageText(' <b>Create New Apartment</b>\n\nEnter apartment name (e.g., "Luxury 2BR Lekki"):', { parse_mode: 'HTML' });
});

// Apartment furnished status
bot.action('apt_furnished_yes', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id].furnished = true;
  userContext[ctx.from.id].step = 'create_apartment_features';
  return ctx.editMessageText(' <b>Apartment Features</b> (Optional)\n\nEnter apartment features separated by commas:\n\n<b>Examples:</b> balcony, parking, garden, security, gym, pool, air conditioning, wifi\n\nOr type "none" to skip:', { parse_mode: 'HTML' });
});

bot.action('apt_furnished_no', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id].furnished = false;
  userContext[ctx.from.id].step = 'create_apartment_features';
  return ctx.editMessageText(' <b>Apartment Features</b> (Optional)\n\nEnter apartment features separated by commas:\n\n<b>Examples:</b> balcony, parking, garden, security, gym, pool, air conditioning, wifi\n\nOr type "none" to skip:', { parse_mode: 'HTML' });
});

// Apartment image handlers
bot.action('apartment_image_upload', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id].step = 'upload_apartment_image';
  return ctx.editMessageText(' 📸 <b>Upload Photo</b>\n\nSend a photo of the apartment:', { parse_mode: 'HTML' });
});

bot.action('apartment_image_url', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id].step = 'apartment_image_url_text';
  return ctx.editMessageText(' 🔗 <b>Image URL</b>\n\nEnter the image URL:', { parse_mode: 'HTML' });
});

bot.action('apartment_image_skip', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id].image = null;
  await saveApartmentListing(ctx, userContext[ctx.from.id]);
});

bot.on('text', errorWrapper(async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;

  console.log(`[Bot] Received text message from ${userId}: "${text}"`);
  
  const context = userContext[userId];
  console.log(`[Bot] Text from ${userId}: "${text}" (Context step: ${context?.step || 'none'})`);

  if (!context) {
    console.log(`[Bot] No context for user ${userId} - message not recognized`);
    // User sent a message without an active workflow
    if (!text.startsWith('/')) {
      return ctx.reply(' 📢 <b>I didn\'t catch that!</b>\n\nI\'m waiting for a specific input as part of a workflow.\n\n💡 <b>Tip:</b> Use /start to see available commands or /addproduct to create a new product.', { parse_mode: 'HTML' });
    }
    return;
  }

  console.log(`[Bot] Entering switch statement with step: ${context.step}`);

  switch (context.step) {
      case 'create_product_name':
        console.log(`[Bot] Setting product name: ${text}`);
        context.name = text;
        context.step = 'create_product_description';
        return ctx.reply('✏️ Enter product description:');

      case 'create_product_description':
        console.log(`[Bot] Processing description for user ${userId}`);
        context.description = ctx.message.text;
        context.step = 'create_product_price';
        console.log(`[Bot] Moving to price step, sending reply...`);
        return ctx.reply('Enter price per kg (e.g., 45):').then(() => {
          console.log(`[Bot] Price prompt sent successfully`);
        }).catch(err => {
          console.error(`[Bot] Failed to send price prompt:`, err.message);
        });

      case 'create_product_price':
        console.log(`[Bot] Processing price for user ${userId}, text: "${text}"`);
        context.pricePerKg = parseFloat(ctx.message.text);
        if (isNaN(context.pricePerKg)) {
          console.log(`[Bot] Invalid price: ${ctx.message.text}`);
          return ctx.reply(' Invalid price. Enter a number:');
        }
        console.log(`[Bot] Price set to ${context.pricePerKg}, moving to category step`);
        context.step = 'create_product_category';
        console.log(`[Bot] Sending category options...`);
        return ctx.reply('Select category or type a custom one:', {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Smoked Fish', 'cat_fish'), Markup.button.callback('Grains', 'cat_grains')],
            [Markup.button.callback('Rice', 'cat_rice'), Markup.button.callback('Other', 'cat_other')],
            [Markup.button.callback('Custom Category', 'cat_custom')]
          ]).reply_markup
        }).then(() => {
          console.log(`[Bot] Category options sent successfully`);
        }).catch(err => {
          console.error(`[Bot] Failed to send category options:`, err.message);
        });
        // Break here to prevent fall-through
        break;

      case 'custom_category_input':
        // Handle custom category input
        console.log(`[Bot] Processing custom category input for user ${userId}`);
        const customCat = ctx.message.text?.trim();
        console.log(`[Bot] Custom category text: "${customCat}"`);
        
        if (!customCat || customCat.length === 0) {
          console.log(`[Bot] Empty category input, requesting again`);
          return ctx.reply('❌ Category name cannot be empty. Please enter a category name:');
        }
        if (customCat.length > 50) {
          console.log(`[Bot] Category name too long: ${customCat.length} characters`);
          return ctx.reply('❌ Category name is too long (max 50 characters). Please try again:');
        }
        
        // Set the category
        context.category = customCat;
        console.log(`[Bot] Custom category set to: "${context.category}" for user ${userId}`);
        
        // Move to next step
        context.step = 'create_product_quantity';
        console.log(`[Bot] Moving to create_product_quantity step`);
        
        return ctx.reply(' <b>Stock Quantity</b>\n\nEnter the available quantity in kg (e.g., 1000):', { parse_mode: 'HTML' });
        break;

      case 'create_product_quantity':
      context.quantity = parseFloat(ctx.message.text);
      if (isNaN(context.quantity)) {
        return ctx.reply(' ⚠️ <b>Invalid quantity</b>\n\nPlease enter a valid number (e.g., 1000):\n\nExample: 500 kg of rice', { parse_mode: 'HTML' });
      }
      if (context.quantity <= 0) {
        return ctx.reply(' ⚠️ <b>Invalid quantity</b>\n\nQuantity must be greater than 0. Please try again.', { parse_mode: 'HTML' });
      }
      context.step = 'create_product_unit';
      return ctx.reply(' <b>Unit of Measurement</b>\n\nEnter the unit for this product:\n\n<b>Examples:</b> kg, pieces, plots, acres, hectares, boxes, bags, liters, tons, pack, cartons, bundles, etc.\n\n<i>You can use any custom unit!</i>', { parse_mode: 'HTML' });

    case 'create_product_unit':
      context.unit = ctx.message.text.trim().toLowerCase();
      if (!context.unit) {
        return ctx.reply(' Invalid unit. Please enter a unit:');
      }
      context.step = 'create_product_min_limit';
      return ctx.reply(` <b>Minimum Order Limit</b>\n\nEnter the minimum order quantity in <b>${context.unit}</b>:\n\n<i>Example: If unit is "kg", enter "50" for minimum 50kg</i>`, { parse_mode: 'HTML' });

    case 'create_product_min_limit':
      context.minLimit = parseFloat(ctx.message.text);
      if (isNaN(context.minLimit)) {
        return ctx.reply(` ⚠️ <b>Invalid minimum limit</b>\n\nPlease enter a valid number (e.g., 50 for minimum 50${context.unit}):`, { parse_mode: 'HTML' });
      }
      if (context.minLimit < 0) {
        return ctx.reply(` ⚠️ <b>Invalid minimum limit</b>\n\nMinimum limit must be 0 or greater. Please try again.`, { parse_mode: 'HTML' });
      }
      context.step = 'create_product_max_limit';
      return ctx.reply(` <b>Maximum Order Limit</b>\n\nEnter the maximum order quantity in <b>${context.unit}</b>:\n\n<i>Must be greater than minimum limit (${context.minLimit})</i>`, { parse_mode: 'HTML' });

    case 'create_product_max_limit':
      context.maxLimit = parseFloat(ctx.message.text);
      if (isNaN(context.maxLimit)) {
        return ctx.reply(` ⚠️ <b>Invalid maximum limit</b>\n\nPlease enter a valid number (e.g., 5000 for maximum 5000${context.unit}):`, { parse_mode: 'HTML' });
      }
      if (context.maxLimit < 0) {
        return ctx.reply(` ⚠️ <b>Invalid maximum limit</b>\n\nMaximum limit must be 0 or greater. Please try again.`, { parse_mode: 'HTML' });
      }
      if (context.maxLimit <= context.minLimit) {
        return ctx.reply(` ⚠️ <b>Invalid range</b>\n\nMaximum limit (${context.maxLimit}) must be <b>greater</b> than minimum limit (${context.minLimit} ${context.unit}).\n\nPlease enter a larger number.`, { parse_mode: 'HTML' });
      }
      context.step = 'create_product_image_choice';
      return ctx.reply(' <b>Product Image</b>\n\nHow would you like to add an image?\n\n1.  Send a photo (upload from Telegram)\n2.  Provide image URL\n3.  Skip (use default image)', {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Send Photo', 'image_upload'), Markup.button.callback('URL', 'image_url')],
          [Markup.button.callback('Skip', 'image_skip')]
        ]).reply_markup
      });

    case 'create_product_image_url':
      context.image = ctx.message.text;
      if (!context.image.match(/^https?:\/\/.+/)) {
        return ctx.reply(' Invalid URL. Please provide a valid image URL starting with http:// or https://');
      }
      await saveProduct(ctx, context);
      break;

    //  LAND PROPERTY CREATION 

    case 'create_land_name':
      context.name = ctx.message.text;
      context.step = 'create_land_description';
      return ctx.reply(' <b>Property Description</b>\n\nEnter a detailed description of the land:', { parse_mode: 'HTML' });

    case 'create_land_description':
      context.description = ctx.message.text;
      context.step = 'create_land_location';
      return ctx.reply(' <b>Location</b>\n\nEnter the location/address of the property:', { parse_mode: 'HTML' });

    case 'create_land_location':
      context.location = ctx.message.text;
      context.step = 'create_land_area';
      return ctx.reply(' <b>Area in Square Meters</b>\n\nEnter the total area of the property (e.g., 5000 for 5000 m):', { parse_mode: 'HTML' });

    case 'create_land_area':
      context.areaSqMeters = parseFloat(ctx.message.text);
      if (isNaN(context.areaSqMeters) || context.areaSqMeters <= 0) {
        return ctx.reply(' ⚠️ <b>Invalid area</b>\n\nPlease enter a valid number greater than 0 (e.g., 5000 for 5000 m²):', { parse_mode: 'HTML' });
      }
      context.step = 'create_land_plots';
      return ctx.reply(' <b>Number of Plots</b>\n\nHow many plots is this property divided into? (e.g., 1, 2, 4, etc.):', { parse_mode: 'HTML' });

    case 'create_land_plots':
      context.numberOfPlots = parseInt(ctx.message.text);
      if (isNaN(context.numberOfPlots) || context.numberOfPlots < 1) {
        return ctx.reply(' ⚠️ <b>Invalid number of plots</b>\n\nPlease enter a positive whole number (e.g., 1, 2, 4, etc.):', { parse_mode: 'HTML' });
      }
      context.step = 'create_land_legal_status';
      return ctx.reply(' <b>Legal Status</b>\n\nSelect the legal status of the property:', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Freehold', 'legal_freehold'), Markup.button.callback('Leasehold', 'legal_leasehold')],
          [Markup.button.callback('Government', 'legal_government'), Markup.button.callback('Communal', 'legal_communal')],
          [Markup.button.callback('Unknown', 'legal_unknown')]
        ]).reply_markup
      });

    case 'create_land_accessibility':
      context.step = 'create_land_pricing_type';
      return ctx.reply(' <b>Pricing Type</b>\n\nHow should this property be priced?', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Fixed per Plot', 'pricing_fixed')],
          [Markup.button.callback('Per Square Meter', 'pricing_per_meter')]
        ]).reply_markup
      });

    case 'create_land_price':
      context.landPrice = parseFloat(ctx.message.text);
      if (isNaN(context.landPrice) || context.landPrice <= 0) {
        return ctx.reply(' ⚠️ <b>Invalid price</b>\n\nPlease enter a valid number greater than 0 (e.g., 500000):', { parse_mode: 'HTML' });
      }
      context.step = 'create_land_unit';
      return ctx.reply(' <b>Unit of Measurement</b>\n\nEnter the unit for this property:\n\n<b>Examples:</b> kg, pieces, plots, acres, hectares, boxes, bags, liters, tons, pack, cartons, bundles, etc.\n\n<i>You can use any custom unit!</i>', { parse_mode: 'HTML' });

    case 'create_land_unit':
      context.unit = ctx.message.text.trim().toLowerCase();
      if (!context.unit) {
        return ctx.reply(' Invalid unit. Please enter a unit:');
      }
      context.step = 'create_land_min_limit';
      return ctx.reply(` <b>Minimum Order Limit</b>\n\nEnter the minimum order quantity in <b>${context.unit}</b>:\n\n<i>Example: "1" for minimum 1 plot</i>`, { parse_mode: 'HTML' });

    case 'create_land_min_limit':
      context.minLimit = parseFloat(ctx.message.text);
      if (isNaN(context.minLimit) || context.minLimit < 0) {
        return ctx.reply(` ⚠️ <b>Invalid minimum limit</b>\n\nPlease enter a valid number (e.g., 1 for minimum 1 plot):`, { parse_mode: 'HTML' });
      }
      context.step = 'create_land_max_limit';
      return ctx.reply(` <b>Maximum Order Limit</b>\n\nEnter the maximum order quantity in <b>${context.unit}</b>:\n\n<i>Must be greater than minimum limit (${context.minLimit})</i>`, { parse_mode: 'HTML' });

    case 'create_land_max_limit':
      context.maxLimit = parseFloat(ctx.message.text);
      if (isNaN(context.maxLimit) || context.maxLimit < 0) {
        return ctx.reply(' ⚠️ <b>Invalid maximum limit</b>\n\nPlease enter a valid number (e.g., 5 for maximum 5 plots):', { parse_mode: 'HTML' });
      }
      if (context.maxLimit <= context.minLimit) {
        return ctx.reply(` ⚠️ <b>Invalid range</b>\n\nMaximum limit (${context.maxLimit}) must be <b>greater</b> than minimum limit (${context.minLimit} ${context.unit}).\n\nPlease enter a larger number.`, { parse_mode: 'HTML' });
      }
      context.step = 'create_land_image_choice';
      return ctx.reply(' <b>Property Image</b>\n\nHow would you like to add an image?', {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Send Photo', 'land_image_upload'), Markup.button.callback('URL', 'land_image_url')],
          [Markup.button.callback('Skip', 'land_image_skip')]
        ]).reply_markup
      });

    case 'create_land_image_url':
      context.image = ctx.message.text;
      if (!context.image.match(/^https?:\/\/.+/)) {
        return ctx.reply(' Invalid URL. Please provide a valid image URL starting with http:// or https://');
      }
      await saveLandProperty(ctx, context);
      break;

    // ════════════════════════ APARTMENT CREATION ════════════════════════
    case 'create_apartment_type_custom':
      context.apartmentType = ctx.message.text.trim();
      if (!context.apartmentType) {
        return ctx.reply(' ⚠️ <b>Apartment type cannot be empty.</b>\n\nPlease enter an apartment type, for example: Studio, Penthouse, Duplex, Flat, or House.', { parse_mode: 'HTML' });
      }
      context.step = 'apartment_listing_type';
      return ctx.reply(' <b>Listing Type</b>\n\nIs this apartment for rent or sale?', {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('💰 For Rent', 'apt_listing_rent')],
          [Markup.button.callback('🏷️ For Sale', 'apt_listing_sale')]
        ]).reply_markup
      });

    case 'create_apartment_name':
      context.name = ctx.message.text;
      context.step = 'create_apartment_description';
      return ctx.reply(' <b>Apartment Description</b>\n\nEnter a detailed description of the apartment:', { parse_mode: 'HTML' });

    case 'create_apartment_description':
      context.description = ctx.message.text;
      context.step = 'create_apartment_address';
      return ctx.reply(' <b>Address/Location</b>\n\nEnter the full address of the apartment:', { parse_mode: 'HTML' });

    case 'create_apartment_address':
      context.apartmentAddress = ctx.message.text;
      context.step = 'create_apartment_bedrooms';
      return ctx.reply(' <b>Number of Bedrooms</b>\n\nEnter the number of bedrooms (e.g., 1, 2, 3, 4):', { parse_mode: 'HTML' });

    case 'create_apartment_bedrooms':
      context.bedrooms = parseInt(ctx.message.text);
      if (isNaN(context.bedrooms) || context.bedrooms < 0) {
        return ctx.reply(' ⚠️ <b>Invalid number</b>\n\nPlease enter a valid number (e.g., 1, 2, 3):', { parse_mode: 'HTML' });
      }
      context.step = 'create_apartment_bathrooms';
      return ctx.reply(' <b>Number of Bathrooms</b>\n\nEnter the number of bathrooms (e.g., 1, 2, 3):', { parse_mode: 'HTML' });

    case 'create_apartment_bathrooms':
      context.bathrooms = parseInt(ctx.message.text);
      if (isNaN(context.bathrooms) || context.bathrooms < 0) {
        return ctx.reply(' ⚠️ <b>Invalid number</b>\n\nPlease enter a valid number (e.g., 1, 2, 3):', { parse_mode: 'HTML' });
      }
      context.step = 'create_apartment_area';
      return ctx.reply(' <b>Apartment Size</b>\n\nEnter the area in square meters (e.g., 120 for 120 m²):', { parse_mode: 'HTML' });

    case 'create_apartment_area':
      context.apartmentAreaSqMeters = parseFloat(ctx.message.text);
      if (isNaN(context.apartmentAreaSqMeters) || context.apartmentAreaSqMeters <= 0) {
        return ctx.reply(' ⚠️ <b>Invalid area</b>\n\nPlease enter a valid number greater than 0:', { parse_mode: 'HTML' });
      }
      context.step = 'create_apartment_furnished';
      return ctx.reply(' <b>Is the apartment furnished?</b>', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('✓ Yes, Furnished', 'apt_furnished_yes')],
          [Markup.button.callback('✗ No, Unfurnished', 'apt_furnished_no')]
        ]).reply_markup
      });

    case 'create_apartment_features':
      context.apartmentFeatures = ctx.message.text.split(',').map(f => f.trim()).filter(f => f);
      context.step = 'create_apartment_price';
      const priceLabel = context.listingType === 'rent' 
        ? 'Enter monthly rent price in Naira (e.g., 150000):'
        : 'Enter total sale price in Naira (e.g., 5000000):';
      return ctx.reply(` <b>Price</b>\n\n${priceLabel}`, { parse_mode: 'HTML' });

    case 'create_apartment_price':
      const priceField = context.listingType === 'rent' ? 'pricePerMonth' : 'price';
      context[priceField] = parseFloat(ctx.message.text);
      if (isNaN(context[priceField]) || context[priceField] <= 0) {
        return ctx.reply(' ⚠️ <b>Invalid price</b>\n\nPlease enter a valid number greater than 0:', { parse_mode: 'HTML' });
      }
      context.step = 'create_apartment_image';
      return ctx.reply(' <b>Upload Image</b>\n\nYou can:\n1. Upload a photo\n2. Provide an image URL\n3. Skip for now', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Upload Photo', 'apartment_image_upload')],
          [Markup.button.callback('Image URL', 'apartment_image_url')],
          [Markup.button.callback('Skip', 'apartment_image_skip')]
        ]).reply_markup
      });

    case 'apartment_image_url_text':
      context.image = ctx.message.text;
      if (!context.image.match(/^https?:\/\/.+/)) {
        return ctx.reply(' Invalid URL. Please provide a valid image URL starting with http:// or https://');
      }
      context.sliderImages = [context.image];
      await promptApartmentSliderImageCount(ctx, context);
      break;

    case 'apartment_slider_image_count':
      if (text.trim().toLowerCase() === 'skip') {
        return await finalizeApartmentSliderImages(ctx, context);
      }

      const sliderCount = parseInt(text.trim(), 10);
      if (isNaN(sliderCount) || sliderCount < 1 || sliderCount > SLIDER_IMAGES_MAX) {
        return ctx.reply(` Please enter a number between 1 and ${SLIDER_IMAGES_MAX}, or type SKIP to keep just the current image.`, { parse_mode: 'HTML' });
      }

      context.sliderImageCount = sliderCount;
      if (sliderCount === 1) {
        return await finalizeApartmentSliderImages(ctx, context);
      }

      context.step = 'apartment_slider_image_upload_next';
      return ctx.reply(` Send image 2 of ${sliderCount} now, or type SKIP to finish after the first image. You can send another photo or an image URL.`, { parse_mode: 'HTML' });

    case 'apartment_slider_image_upload_next':
      if (text.trim().toLowerCase() === 'skip') {
        return await finalizeApartmentSliderImages(ctx, context);
      }

      if (text.match(/^https?:\/\/.+/)) {
        context.sliderImages = context.sliderImages || [];
        context.sliderImages.push(text.trim());
        if (context.sliderImages.length >= (context.sliderImageCount || 2)) {
          return await finalizeApartmentSliderImages(ctx, context);
        }

        const nextImageNumber = context.sliderImages.length + 1;
        return ctx.reply(` Got it. Send image ${nextImageNumber} of ${context.sliderImageCount}, or type SKIP to finish early.`, { parse_mode: 'HTML' });
      }

      return ctx.reply(' Please send a valid image URL or photo. Type SKIP to finish with the images you have provided.', { parse_mode: 'HTML' });

    case 'search_apartment':
      const searchQuery = ctx.message.text.toLowerCase();
      try {
        const response = await api.get('/products');
        const products = response.data.data || [];
        const results = products.filter(p => 
          p.type === 'apartment' && (
            p.name.toLowerCase().includes(searchQuery) ||
            p.apartmentAddress.toLowerCase().includes(searchQuery) ||
            (p.apartmentFeatures && p.apartmentFeatures.some(f => f.toLowerCase().includes(searchQuery)))
          )
        );

        if (results.length === 0) {
          delete userContext[ctx.from.id];
          return ctx.reply(` No apartments found matching "${searchQuery}".`);
        }

        await ctx.reply(` <b>Search Results</b>\n\n<b>Found ${results.length} apartment(s)</b>\n\nShowing results:`, { parse_mode: 'HTML' });
        
        for (let i = 0; i < Math.min(results.length, 5); i++) {
          const apt = results[i];
          const typeLabel = {
            'room': '🏠 Single Room',
            'self-contained': '🏠 Self-Contained',
            'house': '🏡 House',
            'flat': '🏢 Flat'
          }[apt.apartmentType] || ('🏠 ' + (apt.apartmentType.charAt(0).toUpperCase() + apt.apartmentType.slice(1)));
          
          const listingLabel = apt.listingType === 'rent' ? 'For Rent' : 'For Sale';
          const priceDisplay = apt.listingType === 'rent' 
            ? `${apt.pricePerMonth.toLocaleString()}/month`
            : `${apt.price.toLocaleString()} (total)`;
          
          const caption = ` <b>${apt.name}</b>\n\n` +
            ` Type: ${typeLabel}\n` +
            ` Location: ${apt.apartmentAddress}\n` +
            ` ${apt.bedrooms}BR / ${apt.bathrooms}BA • ${apt.apartmentAreaSqMeters}m²\n` +
            ` Status: ${apt.furnished ? '\u2713 Furnished' : '\u25cb Unfurnished'}\n` +
            ` Listing: ${listingLabel}\n` +
            ` Price: ${priceDisplay}\n` +
            ` ${apt.description || 'Premium apartment'}\n` +
            ` ID: <code>${apt._id}</code>`;

          if (apt.image) {
            await ctx.replyWithPhoto(apt.image, {
              caption: caption,
              parse_mode: 'HTML'
            });
          } else {
            await ctx.reply(caption, { parse_mode: 'HTML' });
          }
        }

        delete userContext[ctx.from.id];
        return ctx.reply(` <b>Search Complete</b>`, {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Back to Apartments', 'apartment_menu')]
          ]).reply_markup
        });
      } catch (error) {
        delete userContext[ctx.from.id];
        return ctx.reply(' Error: ' + error.message);
      }
      break;

    // ════════════════════════════════════════════════════════════════════

    case 'edit_product_select_field':
      const fieldNumber = parseInt(ctx.message.text);
      const fields = ['name', 'description', 'pricePerKg', 'quantity', 'category', 'unit', 'minLimit', 'maxLimit'];
      if (fieldNumber < 1 || fieldNumber > fields.length) {
        return ctx.reply(' Invalid option. Please enter a number between 1-8:');
      }
      context.updateField = fields[fieldNumber - 1];
      context.step = 'edit_product_enter_value';
      const fieldNames = ['Name', 'Description', 'Price per kg', 'Quantity', 'Category', 'Unit of Measurement', 'Minimum Limit', 'Maximum Limit'];
      return ctx.reply(`Enter new ${fieldNames[fieldNumber - 1]}:`);

    case 'edit_product_enter_value':
      context.updateValue = ctx.message.text;
      if (['pricePerKg', 'quantity', 'minLimit', 'maxLimit'].includes(context.updateField)) {
        context.updateValue = parseFloat(context.updateValue);
        if (isNaN(context.updateValue)) {
          return ctx.reply(` Invalid ${context.updateField}. Enter a number:`);
        }
      }
      await updateProductField(ctx, context);
      break;

    case 'delete_product_confirm':
      if (ctx.message.text.toLowerCase() === 'confirm') {
        await deleteProduct(ctx, context);
      } else {
        return ctx.reply(' Cancelled.');
      }
      break;

    case 'edit_category_select':
      const editCatIndex = parseInt(ctx.message.text) - 1;
      if (isNaN(editCatIndex)) {
        return ctx.reply('❌ Please enter a valid number');
      }
      try {
        const prodResp = await api.get('/products');
        const prods = prodResp.data.data || [];
        const cats = [...new Set(prods.map(p => p.category).filter(Boolean))].sort();
        
        if (editCatIndex < 0 || editCatIndex >= cats.length) {
          return ctx.reply(`❌ Invalid selection. Choose a number between 1 and ${cats.length}`);
        }
        
        context.oldCategory = cats[editCatIndex];
        context.step = 'edit_category_input_new_name';
        return ctx.reply(` <b>Enter New Category Name</b>\n\nCurrent: <b>${context.oldCategory}</b>\n\nEnter the new name (or "CANCEL" to abort):`, { parse_mode: 'HTML' });
      } catch (error) {
        delete userContext[userId];
        return ctx.reply('❌ Error: ' + error.message);
      }
      break;

    case 'edit_category_input_new_name':
      if (ctx.message.text.toLowerCase() === 'cancel') {
        delete userContext[userId];
        return ctx.reply('✅ Cancelled.');
      }
      
      const newCatName = ctx.message.text.trim();
      if (!newCatName || newCatName.length === 0) {
        return ctx.reply('❌ Category name cannot be empty. Please try again:');
      }
      if (newCatName.length > 50) {
        return ctx.reply('❌ Category name is too long (max 50 characters). Please try again:');
      }
      
      try {
        // Update all products in the old category to have the new category
        const prodResp = await api.get('/products');
        const productsToUpdate = prodResp.data.data.filter(p => p.category === context.oldCategory);
        
        let updated = 0;
        for (const product of productsToUpdate) {
          await api.put(`/products/${product._id}`, { category: newCatName });
          updated++;
        }
        
        delete userContext[userId];
        ctx.reply(` <b>Category Renamed!</b>\n\n<b>${context.oldCategory}</b> → <b>${newCatName}</b>\n\n✅ Updated ${updated} product${updated !== 1 ? 's' : ''}`, { parse_mode: 'HTML' });
      } catch (error) {
        delete userContext[userId];
        ctx.reply('❌ Error updating category: ' + error.message);
      }
      break;

    case 'delete_category_select_source':
      const delCatIndex = parseInt(ctx.message.text) - 1;
      if (isNaN(delCatIndex)) {
        return ctx.reply('❌ Please enter a valid number');
      }
      try {
        const prodResp = await api.get('/products');
        const prods = prodResp.data.data || [];
        const cats = [...new Set(prods.map(p => p.category).filter(Boolean))].sort();
        
        if (delCatIndex < 0 || delCatIndex >= cats.length) {
          return ctx.reply(`❌ Invalid selection. Choose a number between 1 and ${cats.length}`);
        }
        
        context.sourceCategory = cats[delCatIndex];
        context.step = 'delete_category_select_target';
        
        // Show target categories (all except the source)
        const targetCats = cats.filter(c => c !== context.sourceCategory);
        let message = ` <b>Move to Target Category</b>\n\nMoving from: <b>${context.sourceCategory}</b>\n\nSelect where to move these products:\n\n`;
        targetCats.forEach((cat, i) => {
          const count = prods.filter(p => p.category === cat).length;
          message += `${i + 1}. ${cat} (${count} existing)\n`;
        });
        message += `\nReply with the number (1-${targetCats.length}):`;
        
        return ctx.reply(message, { parse_mode: 'HTML' });
      } catch (error) {
        delete userContext[userId];
        return ctx.reply('❌ Error: ' + error.message);
      }
      break;

    case 'delete_category_select_target':
      const targetIndex = parseInt(ctx.message.text) - 1;
      if (isNaN(targetIndex)) {
        return ctx.reply('❌ Please enter a valid number');
      }
      try {
        const prodResp = await api.get('/products');
        const prods = prodResp.data.data || [];
        const allCats = [...new Set(prods.map(p => p.category).filter(Boolean))].sort();
        const targetCats = allCats.filter(c => c !== context.sourceCategory);
        
        if (targetIndex < 0 || targetIndex >= targetCats.length) {
          return ctx.reply(`❌ Invalid selection. Choose a number between 1 and ${targetCats.length}`);
        }
        
        const targetCategory = targetCats[targetIndex];
        const productsToMove = prods.filter(p => p.category === context.sourceCategory);
        
        let moved = 0;
        for (const product of productsToMove) {
          await api.put(`/products/${product._id}`, { category: targetCategory });
          moved++;
        }
        
        delete userContext[userId];
        ctx.reply(` <b>Products Moved!</b>\n\n<b>${context.sourceCategory}</b> → <b>${targetCategory}</b>\n\n✅ Moved ${moved} product${moved !== 1 ? 's' : ''}`, { parse_mode: 'HTML' });
      } catch (error) {
        delete userContext[userId];
        ctx.reply('❌ Error moving products: ' + error.message);
      }
      break;

    case 'update_product_field':
      context.updateValue = ctx.message.text;
      await updateProductField(ctx, context);
      break;

    case 'update_tax_rate':
      const taxRate = parseFloat(ctx.message.text);
      if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
        delete userContext[userId];
        return ctx.reply('❌ Tax rate must be between 0 and 100%');
      }
      try {
        await queueRequest(() => api.put('/settings', { taxRate }));
        delete userContext[userId];
        return ctx.reply(`✅ Tax rate updated to ${taxRate}%`, {
          reply_markup: Markup.inlineKeyboard([[Markup.button.callback(' Back to Settings', 'settings_menu')]]).reply_markup
        });
      } catch (error) {
        delete userContext[userId];
        return ctx.reply('❌ Error updating tax rate: ' + error.message);
      }
      break;

    case 'update_shipping_fee':
      const shippingFee = parseFloat(ctx.message.text);
      if (isNaN(shippingFee) || shippingFee < 0) {
        delete userContext[userId];
        return ctx.reply('❌ Shipping fee must be 0 or greater');
      }
      try {
        await queueRequest(() => api.put('/settings', { shippingFee }));
        delete userContext[userId];
        return ctx.reply(`✅ Shipping fee updated to ₦${shippingFee.toLocaleString()}`, {
          reply_markup: Markup.inlineKeyboard([[Markup.button.callback(' Back to Settings', 'settings_menu')]]).reply_markup
        });
      } catch (error) {
        delete userContext[userId];
        return ctx.reply('❌ Error updating shipping fee: ' + error.message);
      }
      break;
      
    default:
      console.log(`[Bot] No matching case for step: ${context.step}`);
      return ctx.reply(` ⚠️ <b>Unexpected Input</b>\n\nI don't recognize this step: <code>${context.step}</code>\n\nPlease use /start to restart or /addproduct to create a new product.`, { parse_mode: 'HTML' });
  }

  if (context.step === 'update_order_id') {
    context.orderId = ctx.message.text.trim();
    context.step = 'update_order_status';
    return ctx.editMessageText(
      `Update order status for <code>${context.orderId}</code>`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Pending', 'status_pending')],
        [Markup.button.callback('Confirmed', 'status_confirmed')],
        [Markup.button.callback('Shipped', 'status_shipped')],
        [Markup.button.callback('Delivered', 'status_delivered')],
        [Markup.button.callback('Cancelled', 'status_cancelled')]
      ])
    );
  }

  if (context.step === 'search_product') {
    const searchTerm = ctx.message.text.toLowerCase();
    try {
      const response = await api.get('/products');
      const products = response.data.data || [];
      const foundProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.description?.toLowerCase().includes(searchTerm) ||
        p.category?.toLowerCase().includes(searchTerm)
      );

      if (foundProducts.length === 0) {
        delete userContext[userId];
        return ctx.reply(` No products found matching "${ctx.message.text}".`, {
          reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Back to Products', 'products_menu')]]).reply_markup
        });
      }

      let message = ` <b>Search Results for "${ctx.message.text}"</b>\n\n`;
      foundProducts.slice(0, 5).forEach((p, i) => {
        message += `${i + 1}. <b>${p.name}</b>\n`;
        message += `   Price: ${p.pricePerKg}/kg\n`;
        message += `   Stock: ${p.quantity}kg\n`;
        message += `   Category: ${p.category}\n\n`;
      });

      delete userContext[userId];
      return ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Back to Products', 'products_menu')]]).reply_markup
      });
    } catch (error) {
      delete userContext[userId];
      return ctx.reply(' Error: ' + error.message);
    }
  }

  if (context.step === 'search_user') {
    const searchEmail = ctx.message.text.toLowerCase();
    try {
      const response = await api.get('/auth/users');
      const users = response.data.data || [];
      const foundUser = users.find(u => u.email.toLowerCase().includes(searchEmail));

      if (!foundUser) {
        delete userContext[userId];
        return ctx.reply(` No user found with email containing "${ctx.message.text}".`, {
          reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Back to Users', 'users_menu')]]).reply_markup
        });
      }

      const message = ` <b>User Found</b>\n\n` +
        `Name: <b>${foundUser.firstName || 'Unknown'} ${foundUser.lastName || 'User'}</b>\n` +
        `Email: ${foundUser.email}\n` +
        `Phone: ${foundUser.phone || 'N/A'}\n` +
        `Account Type: ${foundUser.accountType || 'N/A'}\n` +
        `Verified: ${foundUser.isVerified ? '' : ''}\n` +
        `Joined: ${new Date(foundUser.createdAt).toLocaleDateString()}\n` +
        `ID: <code>${foundUser._id}</code>`;

      delete userContext[userId];
      return ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Back to Users', 'users_menu')]]).reply_markup
      });
    } catch (error) {
      delete userContext[userId];
      return ctx.reply(' Error: ' + error.message);
    }
  }
}));

bot.action(/^cat_(?!custom)(.+)$/, async (ctx) => {
  const category = ctx.match[1];
  const categoryMap = {
    'fish': 'Smoked Fish',
    'grains': 'Grains',
    'rice': 'Rice',
    'other': 'Other'
  };

  const context = userContext[ctx.from.id];
  // Check if category is in the map (lowercase), otherwise use the category as-is (for dynamic categories)
  context.category = categoryMap[category] || category;
  context.step = 'create_product_quantity';

  console.log(`[Bot] Category selected: "${category}" -> set as: "${context.category}"`);

  await ctx.answerCbQuery();
  return ctx.reply(`Category: <b>${context.category}</b>\n\nEnter quantity in kg:`, { parse_mode: 'HTML' });
});

// Land property legal status callbacks
bot.action(/^legal_(.+)$/, async (ctx) => {
  const legalStatus = ctx.match[1];
  const context = userContext[ctx.from.id];
  context.legalStatus = legalStatus;
  context.step = 'create_land_accessibility';

  await ctx.answerCbQuery();
  return ctx.editMessageText(' <b>Accessibility</b>\n\nSelect the road/water access type:', {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('Road Access', 'access_road'), Markup.button.callback('Water Access', 'access_water')],
      [Markup.button.callback('Both', 'access_both'), Markup.button.callback('Limited', 'access_limited')]
    ]).reply_markup
  });
});

// Land property accessibility callbacks
bot.action(/^access_(.+)$/, async (ctx) => {
  const accessibility = ctx.match[1];
  const accessMap = {
    'road': 'road-access',
    'water': 'water-access',
    'both': 'both',
    'limited': 'limited'
  };
  const context = userContext[ctx.from.id];
  context.accessibility = accessMap[accessibility];
  context.step = 'create_land_pricing_type';

  await ctx.answerCbQuery();
  return ctx.editMessageText(' <b>Pricing Type</b>\n\nHow should this property be priced?', {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('Fixed per Plot', 'pricing_fixed')],
      [Markup.button.callback('Per Square Meter', 'pricing_per_meter')]
    ]).reply_markup
  });
});

// Land property pricing type callbacks
bot.action(/^pricing_(.+)$/, async (ctx) => {
  const pricing = ctx.match[1];
  const context = userContext[ctx.from.id];
  // Normalize per_meter to per-meter to match schema enum
  context.landPricingType = pricing === 'per_meter' ? 'per-meter' : pricing;

  await ctx.answerCbQuery();
  if (pricing === 'fixed') {
    context.step = 'create_land_price';
    return ctx.editMessageText(` <b>Price per Plot</b>\n\nEnter the fixed price for <b>each plot</b> in Naira ():\n\nExample: 5000000 for 5,000,000 per plot`, { parse_mode: 'HTML' });
  } else {
    context.step = 'create_land_price';
    return ctx.editMessageText(` <b>Price per Square Meter</b>\n\nEnter the price per square meter in Naira ():\n\nExample: 50000 for 50,000 per m`, { parse_mode: 'HTML' });
  }
});

// Land property image callbacks
bot.action('land_image_upload', async (ctx) => {
  await ctx.answerCbQuery();
  const context = userContext[ctx.from.id];
  context.step = 'create_land_image_upload';
  return ctx.editMessageText(' <b>Upload Property Image</b>\n\nPlease send a photo of the land property.', { parse_mode: 'HTML' });
});

bot.action('land_image_url', async (ctx) => {
  await ctx.answerCbQuery();
  const context = userContext[ctx.from.id];
  context.step = 'create_land_image_url';
  return ctx.editMessageText(' <b>Property Image URL</b>\n\nPlease provide the image URL:\n\n<i>Example: https://example.com/image.jpg</i>', { parse_mode: 'HTML' });
});

bot.action('land_image_skip', async (ctx) => {
  await ctx.answerCbQuery();
  const context = userContext[ctx.from.id];
  context.image = 'https://images.unsplash.com/photo-1551632786-de41ec4a306b?auto=format&fit=crop&w=400&q=70';
  await saveLandProperty(ctx, context);
});

async function saveProduct(ctx, context) {
  try {
    // Validate critical fields before attempting to save
    if (!context.category) {
      console.error('Missing category for product creation', { userId: ctx.from.id, context });
      delete userContext[ctx.from.id];
      return ctx.reply(' Error: Product category is required.\n\nPlease use /addproduct to start over and select or enter a category.');
    }

    const productData = {
      name: context.name,
      description: context.description,
      // Coerce to number to ensure backend receives numeric price
      pricePerKg: context.pricePerKg !== undefined ? parseFloat(context.pricePerKg) : undefined,
      category: context.category,
      quantity: context.quantity !== undefined ? parseFloat(context.quantity) : 0,
      unit: context.unit || 'kg',
      minLimit: context.minLimit || 1,
      maxLimit: context.maxLimit || 1000,
      image: context.image || 'https://images.unsplash.com/photo-1599056377759-3388006e62e0?auto=format&fit=crop&w=400&q=70',
      images: Array.isArray(context.images) ? context.images.slice(0, SLIDER_IMAGES_MAX) : undefined,
      // Option 2: Include Base64 image data if available
      imageData: context.imageData,
      imageMimeType: context.imageMimeType || 'image/jpeg',
      certification: { organic: true }
    };

    // Validate required fields
    if (!productData.name || !productData.description) {
      console.error('Missing required product name or description', { productData });
      return ctx.reply(' Error: Missing name or description. Please try again.');
    }

    if (isNaN(productData.pricePerKg) || productData.pricePerKg <= 0) {
      console.error('Invalid pricePerKg', { productData });
      return ctx.reply(' Error: Invalid price. Please enter a positive number for price per kg.');
    }

    if (isNaN(productData.quantity)) {
      console.error('Invalid quantity', { productData });
      return ctx.reply(' Error: Invalid quantity. Please enter a number.');
    }

    console.log('Saving product:', { userId: ctx.from.id, productData });
    const response = await queueRequest(() => api.post('/products', productData));
    console.log('Product saved successfully:', response.data.data);
    
    clearCache('products'); // Invalidate product cache
    clearCache('stats'); // Invalidate stats cache
    delete userContext[ctx.from.id];
    return ctx.reply(` Product created successfully!\n\n<b>${response.data.data.name}</b>\n Unit: ${response.data.data.unit}\n Range: ${response.data.data.minLimit}-${response.data.data.maxLimit} ${response.data.data.unit}\nID: <code>${response.data.data._id}</code>`, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Back to Menu', 'products_menu')]]).reply_markup
    });
  } catch (error) {
    console.error('Error saving product:', {
      userId: ctx.from.id,
      errorMessage: error.message,
      errorCode: error.code,
      errorStatus: error.response?.status,
      errorData: error.response?.data,
      fullError: error
    });
    
    delete userContext[ctx.from.id];
    
    // Provide detailed error message
    let errorMsg = ' Error creating product: ';
    if (error.response?.data?.message) {
      errorMsg += error.response.data.message;
    } else if (error.response?.status === 400) {
      errorMsg += 'Invalid data provided. Please check all fields and try again.';
    } else if (error.response?.status === 500) {
      errorMsg += 'Server error. Please try again later.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMsg += 'Request timeout. Please try again.';
    } else if (error.code === 'ECONNREFUSED') {
      errorMsg += 'Cannot connect to server. Please try again later.';
    } else {
      errorMsg += error.message || 'Unknown error occurred.';
    }
    
    return ctx.reply(errorMsg);
  }
}

async function saveLandProperty(ctx, context) {
  try {
    const landData = {
      name: context.name,
      description: context.description,
      type: 'land',
      category: 'Land',
      location: context.location,
      areaSqMeters: context.areaSqMeters,
      numberOfPlots: context.numberOfPlots,
      legalStatus: context.legalStatus,
      accessibility: context.accessibility,
      landPricingType: context.landPricingType,
      unit: context.unit || 'plots',
      minLimit: context.minLimit || 1,
      maxLimit: context.maxLimit || context.numberOfPlots,
      image: context.image || 'https://images.unsplash.com/photo-1551632786-de41ec4a306b?auto=format&fit=crop&w=400&q=70',
      images: Array.isArray(context.images) ? context.images.slice(0, SLIDER_IMAGES_MAX) : undefined,
      // Option 2: Include Base64 image data if available
      imageData: context.imageData,
      imageMimeType: context.imageMimeType || 'image/jpeg'
    };

    // Set price based on pricing type
    if (context.landPricingType === 'fixed') {
      landData.pricePerPlot = context.landPrice ? parseFloat(context.landPrice) : undefined;
      if (isNaN(landData.pricePerPlot) || landData.pricePerPlot <= 0) {
        return ctx.reply(' Invalid price. Please enter a positive number.');
      }
    } else {
      landData.pricePerSqMeter = context.landPrice ? parseFloat(context.landPrice) : undefined;
      if (isNaN(landData.pricePerSqMeter) || landData.pricePerSqMeter <= 0) {
        return ctx.reply(' Invalid price. Please enter a positive number.');
      }
    }

    // Validate required fields
    const requiredFields = ['name', 'description', 'location', 'areaSqMeters', 'numberOfPlots'];
    for (const field of requiredFields) {
      if (!landData[field]) {
        console.error(`Missing required field: ${field}`, { landData });
        return ctx.reply(` Error: Missing ${field}. Please try again.`);
      }
    }

    console.log('Saving land property:', { userId: ctx.from.id, landData });
    const response = await queueRequest(() => api.post('/products', landData));
    console.log('Land property saved successfully:', response.data.data);
    
    clearCache('products');
    clearCache('stats');
    delete userContext[ctx.from.id];
    
    const priceDisplay = context.landPricingType === 'fixed' 
      ? `${context.landPrice.toLocaleString()}/plot`
      : `${context.landPrice.toLocaleString()}/m`;

    return ctx.reply(` Land Property Created Successfully!\n\n<b>${response.data.data.name}</b>\n Location: ${context.location}\n Area: ${context.areaSqMeters.toLocaleString()} m\n Plots: ${context.numberOfPlots}\n Price: ${priceDisplay}\n Unit: ${context.unit}\n Range: ${context.minLimit}-${context.maxLimit} ${context.unit}\nID: <code>${response.data.data._id}</code>`, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Back to Menu', 'products_menu')]]).reply_markup
    });
  } catch (error) {
    console.error('Error saving land property:', {
      userId: ctx.from.id,
      errorMessage: error.message,
      errorCode: error.code,
      errorStatus: error.response?.status,
      errorData: error.response?.data,
      fullError: error
    });
    
    delete userContext[ctx.from.id];
    
    // Provide detailed error message
    let errorMsg = ' Error creating land property: ';
    if (error.response?.data?.message) {
      errorMsg += error.response.data.message;
    } else if (error.response?.status === 400) {
      errorMsg += 'Invalid data provided. Please check all fields and try again.';
    } else if (error.response?.status === 500) {
      errorMsg += 'Server error. Please try again later.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMsg += 'Request timeout. Please try again.';
    } else if (error.code === 'ECONNREFUSED') {
      errorMsg += 'Cannot connect to server. Please try again later.';
    } else {
      errorMsg += error.message || 'Unknown error occurred.';
    }
    
    return ctx.reply(errorMsg);
  }
}

async function saveApartmentListing(ctx, context) {
  try {
    const apartmentData = {
      name: context.name,
      description: context.description,
      type: 'apartment',
      category: 'Apartment',
      apartmentType: context.apartmentType,
      listingType: context.listingType,
      apartmentAddress: context.apartmentAddress,
      bedrooms: context.bedrooms,
      bathrooms: context.bathrooms,
      apartmentAreaSqMeters: context.apartmentAreaSqMeters,
      furnished: context.furnished,
      apartmentFeatures: context.apartmentFeatures || [],
      image: context.image || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=70',
      images: Array.isArray(context.images) ? context.images.slice(0, SLIDER_IMAGES_MAX) : undefined,
      imageData: context.imageData,
      imageMimeType: context.imageMimeType || 'image/jpeg',
      unit: 'units',
      minLimit: 1,
      maxLimit: 1
    };

    // Set price based on listing type
    if (context.listingType === 'rent') {
      apartmentData.pricePerMonth = parseFloat(context.pricePerMonth);
      if (isNaN(apartmentData.pricePerMonth) || apartmentData.pricePerMonth <= 0) {
        return ctx.reply(' Invalid rent price. Please enter a positive number.');
      }
    } else {
      apartmentData.price = parseFloat(context.price);
      if (isNaN(apartmentData.price) || apartmentData.price <= 0) {
        return ctx.reply(' Invalid sale price. Please enter a positive number.');
      }
    }

    // Validate required fields
    const requiredFields = ['name', 'description', 'apartmentAddress', 'bedrooms', 'bathrooms', 'apartmentAreaSqMeters'];
    for (const field of requiredFields) {
      if (apartmentData[field] === undefined || apartmentData[field] === null) {
        console.error(`Missing required field: ${field}`, { apartmentData });
        return ctx.reply(` Error: Missing ${field}. Please try again.`);
      }
    }

    console.log('Saving apartment listing:', { userId: ctx.from.id, apartmentData });
    const response = await queueRequest(() => api.post('/products', apartmentData));
    console.log('Apartment listing saved successfully:', response.data.data);
    
    clearCache('products');
    clearCache('stats');
    delete userContext[ctx.from.id];
    
    const typeLabel = {
      'room': 'Single Room',
      'self-contained': 'Self-Contained',
      'house': 'House',
      'flat': 'Flat'
    }[context.apartmentType] || context.apartmentType;

    const priceDisplay = context.listingType === 'rent' 
      ? `NGN${context.pricePerMonth.toLocaleString()}/month`
      : `NGN${context.price.toLocaleString()}`;

    const furnishedStatus = context.furnished ? '✓ Furnished' : '○ Unfurnished';

    return ctx.reply(` Apartment Listing Created Successfully!\n\n<b>${response.data.data.name}</b>\n Type: ${typeLabel}\n Address: ${context.apartmentAddress}\n ${context.bedrooms}BR / ${context.bathrooms}BA\n Size: ${context.apartmentAreaSqMeters}m²\n Status: ${furnishedStatus}\n Price: ${priceDisplay}\n${context.apartmentFeatures.length > 0 ? ` Features: ${context.apartmentFeatures.join(', ')}\n` : ''} ID: <code>${response.data.data._id}</code>`, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Back to Menu', 'products_menu')]]).reply_markup
    });
  } catch (error) {
    console.error('Error saving apartment listing:', {
      userId: ctx.from.id,
      errorMessage: error.message,
      errorCode: error.code,
      errorStatus: error.response?.status,
      errorData: error.response?.data,
      fullError: error
    });
    
    delete userContext[ctx.from.id];
    
    // Provide detailed error message
    let errorMsg = ' Error creating apartment listing: ';
    if (error.response?.data?.message) {
      errorMsg += error.response.data.message;
    } else if (error.response?.status === 400) {
      errorMsg += 'Invalid data provided. Please check all fields and try again.';
    } else if (error.response?.status === 500) {
      errorMsg += 'Server error. Please try again later.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMsg += 'Request timeout. Please try again.';
    } else if (error.code === 'ECONNREFUSED') {
      errorMsg += 'Cannot connect to server. Please try again later.';
    } else {
      errorMsg += error.message || 'Unknown error occurred.';
    }
    
    return ctx.reply(errorMsg);
  }
}

async function updateProductField(ctx, context) {
  try {
    const updateData = {};
    updateData[context.updateField] = context.updateValue;

    await queueRequest(() => api.put(`/products/${context.productId}`, updateData));
    clearCache('products'); // Invalidate caches
    clearCache('stats');
    delete userContext[ctx.from.id];
    return ctx.reply(` Product updated successfully!`, {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Back to Menu', 'products_menu')]]).reply_markup
    });
  } catch (error) {
    delete userContext[ctx.from.id];
    return ctx.reply(' Error: ' + error.response?.data?.message || error.message);
  }
}

async function deleteProduct(ctx, context) {
  try {
    await queueRequest(() => api.delete(`/products/${context.productId}`));
    clearCache('products'); // Invalidate caches
    clearCache('stats');
    delete userContext[ctx.from.id];
    return ctx.reply(` Product deleted successfully!`, {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Back to Menu', 'products_menu')]]).reply_markup
    });
  } catch (error) {
    delete userContext[ctx.from.id];
    return ctx.reply(' Error: ' + error.response?.data?.message || error.message);
  }
}

// ORDERS MENU
bot.action('orders_menu', async (ctx) => {
  await ctx.answerCbQuery();
  return safeEditMessageText(ctx,
    ' Orders Management\n\nSelect action:',
    Markup.inlineKeyboard([
      [Markup.button.callback('View All Orders', 'orders_list')],
      [Markup.button.callback('View Pending', 'orders_pending')],
      [Markup.button.callback('Update Order Status', 'orders_update')],
      [Markup.button.callback(' Back', 'main_menu')]
    ])
  );
});

// PRODUCTS MENU
bot.action('products_menu', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.editMessageText(
    ' Products Management\n\nSelect action:',
    Markup.inlineKeyboard([
      [Markup.button.callback('View All', 'products_list')],
      [Markup.button.callback('Create New', 'products_create')],
      [Markup.button.callback('Search Product', 'products_search')],
      [Markup.button.callback(' Back', 'main_menu')]
    ])
  );
});

bot.action('products_list', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const response = await api.get('/products');
    const products = response.data.data || [];

    if (products.length === 0) {
      return ctx.editMessageText(' No products found.');
    }

    let message = ' <b>All Products</b>\n\n';
    products.slice(0, 10).forEach((p, i) => {
      message += `${i + 1}. <b>${p.name}</b>\n`;
      message += `   Price: ${p.pricePerKg}/kg\n`;
      message += `   Stock: ${p.quantity}kg\n`;
      message += `   ID: <code>${p._id}</code>\n\n`;
    });

    return ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('View Details', 'product_details')],
        [Markup.button.callback(' Back', 'products_menu')]
      ]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error: ' + error.message);
  }
});

bot.action('products_create', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'create_product_name', command: 'addproduct' };
  return ctx.editMessageText(' Create New Product\n\nEnter product name:');
});

bot.action('image_upload', async (ctx) => {
  await ctx.answerCbQuery();
  const context = userContext[ctx.from.id];
  context.step = 'create_product_image_upload';
  return ctx.editMessageText(' <b>Upload Product Image</b>\n\nPlease send a photo of the product.\n\n <i>Make sure the image is clear and shows the product well.</i>', { parse_mode: 'HTML' });
});

bot.action('image_url', async (ctx) => {
  await ctx.answerCbQuery();
  const context = userContext[ctx.from.id];
  context.step = 'create_product_image_url';
  return ctx.editMessageText(' <b>Product Image URL</b>\n\nPlease provide the image URL:\n\n<i>Example: https://example.com/image.jpg</i>', { parse_mode: 'HTML' });
});

bot.action('image_skip', async (ctx) => {
  await ctx.answerCbQuery();
  const context = userContext[ctx.from.id];
  
  // Validate context has required fields before saving
  if (!context || !context.category) {
    console.warn(`[Bot] Cannot skip image - missing required fields. User: ${ctx.from.id}`, { 
      hasContext: !!context,
      hasCategory: context?.category,
      step: context?.step
    });
    return ctx.reply(' Error: Missing category. Please use /addproduct to start over.');
  }
  
  context.image = 'https://images.unsplash.com/photo-1599056377759-3388006e62e0?auto=format&fit=crop&w=400&q=70';
  await saveProduct(ctx, context);
});

// CATEGORY SELECTION HANDLERS - Dynamic categories
// Handle any category button (e.g., cat_Roasted Corn, cat_Table Water, etc.)
bot.action(/^cat_(?!custom)(.+)$/, errorWrapper(async (ctx) => {
  const categoryMatch = ctx.match[1];
  const userId = ctx.from.id;
  
  console.log(`[Bot] Category selected: "${categoryMatch}" from user ${userId}`);
  await ctx.answerCbQuery();
  
  const context = userContext[userId];
  console.log(`[Bot] Context for category:`, { step: context?.step, name: context?.name });
  
  if (context && context.step === 'create_product_category') {
    // Set the selected category
    context.category = categoryMatch;
    context.step = 'create_product_quantity';
    
    console.log(`[Bot] Category set to: "${context.category}" for user ${userId}`);
    
    return ctx.editMessageText(' <b>Stock Quantity</b>\n\nEnter the available quantity in kg (e.g., 1000):', { parse_mode: 'HTML' });
  } else {
    console.warn(`[Bot] Invalid context for category - step: ${context?.step}`);
    return ctx.answerCbQuery('❌ Session expired. Please try again.');
  }
}, 'addproduct'));

// Legacy handlers kept for backward compatibility
bot.action('cat_custom', errorWrapper(async (ctx) => {
  console.log(`[Bot] cat_custom callback from user ${ctx.from.id}`);
  await ctx.answerCbQuery();
  const context = userContext[ctx.from.id];
  if (context && context.step === 'create_product_category') {
    context.step = 'custom_category_input';
    console.log(`[Bot] Moving to custom_category_input step`);
    return ctx.editMessageText('✏️ <b>Enter Custom Category Name</b>\n\nType the category name you want to create:\n\n<i>Examples: Organic Rice, Premium Catfish, Exotic Spices</i>', { parse_mode: 'HTML' });
  } else {
    console.warn(`[Bot] Invalid step for cat_custom - expected 'create_product_category', got: ${context?.step}`);
  }
}, 'addproduct'));

bot.action('orders_list', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const response = await api.get('/orders/all');
    const orders = response.data.data || [];

    if (orders.length === 0) {
      return ctx.editMessageText(' No orders found.');
    }

    let message = ' <b>All Orders</b>\n\n';
    orders.slice(0, 10).forEach((o, i) => {
      message += `${i + 1}. Order <code>${o.orderNumber}</code>\n`;
      message += `   Status: ${o.status}\n`;
      message += `   Total: ${o.total.toLocaleString()}\n`;
      message += `   Items: ${o.items.length}\n\n`;
    });

    return ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback(' Back', 'orders_menu')]
      ]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error: ' + error.message);
  }
});

bot.action('orders_pending', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const response = await api.get('/orders/all');
    const orders = (response.data.data || []).filter(o => o.status === 'pending');

    if (orders.length === 0) {
      return ctx.editMessageText(' No pending orders.');
    }

    let message = ' <b>Pending Orders</b>\n\n';
    orders.forEach((o, i) => {
      message += `${i + 1}. <code>${o.orderNumber}</code>\n`;
      message += `   Total: ${o.total.toLocaleString()}\n`;
      message += `   Items: ${o.items.length}\n\n`;
    });

    return ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback(' Back', 'orders_menu')]
      ]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error: ' + error.message);
  }
});

bot.action('orders_update', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'update_order_id' };
  return ctx.editMessageText('Enter order ID or order number to update:');
});

bot.action('update_order_status', async (ctx) => {
  await ctx.answerCbQuery();
  const context = userContext[ctx.from.id];
  return ctx.editMessageText(
    `Update order status for <code>${context.orderId}</code>`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Pending', 'status_pending')],
      [Markup.button.callback('Confirmed', 'status_confirmed')],
      [Markup.button.callback('Shipped', 'status_shipped')],
      [Markup.button.callback('Delivered', 'status_delivered')],
      [Markup.button.callback('Cancelled', 'status_cancelled')]
    ])
  );
});

bot.action(/^order_(.+)$/, async (ctx) => {
  const orderId = ctx.match[1];
  await ctx.answerCbQuery();
  
  try {
    const response = await api.get(`/orders/${orderId}`);
    const order = response.data.data;
    
    if (!order) {
      return ctx.editMessageText('Order not found.');
    }
    
    const message = ` <b>ORDER DETAILS</b>\n\n` +
      ` <b>Order:</b> ${order.orderNumber}\n` +
      ` <b>Customer:</b> ${order.buyer.firstName} ${order.buyer.lastName}\n` +
      ` <b>Email:</b> ${order.buyer.email}\n` +
      ` <b>Phone:</b> ${order.buyer.phone || 'Not provided'}\n\n` +
      ` <b>Items:</b>\n` +
      order.items.map((item, i) => 
        `${i + 1}. ${item.product.name}\n   ${item.quantity}  ${item.weight}kg = ${item.subtotal.toLocaleString()}`
      ).join('\n\n') + '\n\n' +
      ` <b>Total: ${order.total.toLocaleString()}</b>\n` +
      ` <b>Status:</b> ${order.status.toUpperCase()}\n` +
      ` <b>Date:</b> ${new Date(order.createdAt).toLocaleString()}`;
    
    return ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Confirm', `confirm_${orderId}`), Markup.button.callback('Ship', `ship_${orderId}`)],
        [Markup.button.callback('Deliver', `deliver_${orderId}`), Markup.button.callback('Cancel', `cancel_${orderId}`)],
        [Markup.button.callback(' Back', 'orders_menu')]
      ]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error loading order details.');
  }
});

bot.action(/^confirm_(.+)$/, async (ctx) => {
  const orderId = ctx.match[1];
  await ctx.answerCbQuery();
  
  try {
    await api.put(`/orders/${orderId}`, { status: 'confirmed' });
    return ctx.editMessageText(` Order confirmed successfully!`, {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Back to Orders', 'orders_list')]]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error confirming order.');
  }
});

bot.action(/^ship_(.+)$/, async (ctx) => {
  const orderId = ctx.match[1];
  await ctx.answerCbQuery();
  
  try {
    await api.put(`/orders/${orderId}`, { status: 'shipped' });
    return ctx.editMessageText(` Order marked as shipped!`, {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Back to Orders', 'orders_list')]]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error updating order status.');
  }
});

bot.action(/^deliver_(.+)$/, async (ctx) => {
  const orderId = ctx.match[1];
  await ctx.answerCbQuery();
  
  try {
    await api.put(`/orders/${orderId}`, { status: 'delivered' });
    return ctx.editMessageText(` Order marked as delivered!`, {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Back to Orders', 'orders_list')]]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error updating order status.');
  }
});

bot.action(/^cancel_(.+)$/, async (ctx) => {
  const orderId = ctx.match[1];
  await ctx.answerCbQuery();
  
  try {
    await api.put(`/orders/${orderId}`, { status: 'cancelled' });
    return ctx.editMessageText(` Order cancelled.`, {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Back to Orders', 'orders_list')]]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error cancelling order.');
  }
});

// USERS MENU
bot.action('users_menu', async (ctx) => {
  await ctx.answerCbQuery();
  return safeEditMessageText(ctx,
    ' Users Management\n\nSelect action:',
    Markup.inlineKeyboard([
      [Markup.button.callback('View All Users', 'users_list')],
      [Markup.button.callback('Search User', 'users_search')],
      [Markup.button.callback(' Back', 'main_menu')]
    ])
  );
});

bot.action('users_list', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const response = await api.get('/auth/users');
    const users = response.data.data || [];

    if (users.length === 0) {
      return ctx.editMessageText(' No users found.');
    }

    let message = ' <b>All Users</b>\n\n';
    users.slice(0, 10).forEach((u, i) => {
      message += `${i + 1}. <b>${u.firstName || 'Unknown'} ${u.lastName || 'User'}</b>\n`;
      message += `   Email: ${u.email || 'N/A'}\n`;
      message += `   Type: ${u.accountType || 'N/A'}\n\n`;
    });

    return ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback(' Back', 'users_menu')]
      ]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error: ' + error.message);
  }
});

bot.action('users_search', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'search_user' };
  return ctx.editMessageText(' <b>Search User</b>\n\nEnter user email to search:');
});

bot.action('product_details', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.editMessageText(' <b>Product Details</b>\n\nSelect a product to view details:', {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback(' Back', 'products_list')]
    ]).reply_markup
  });
});

// STATS MENU
bot.action('stats_menu', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const productsRes = await api.get('/products');
    const ordersRes = await api.get('/orders/all');

    const products = productsRes.data.data || [];
    const orders = ordersRes.data.data || [];

    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;

    const message = ` <b>Dashboard Stats</b>\n\n` +
      ` Total Products: ${products.length}\n` +
      ` Total Orders: ${totalOrders}\n` +
      ` Pending Orders: ${pendingOrders}\n` +
      ` Total Revenue: ${totalRevenue.toLocaleString()}\n`;

    return safeEditMessageText(ctx, message, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Refresh', 'stats_menu')],
        [Markup.button.callback(' Back', 'main_menu')]
      ]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error: ' + error.message);
  }
});

// MAIN MENU
bot.action('main_menu', async (ctx) => {
  await ctx.answerCbQuery();
  return safeEditMessageText(ctx,
    ' 365extra Admin Dashboard\n\nSelect an option:',
    Markup.inlineKeyboard([
      [Markup.button.callback(' Products', 'products_menu')],
      [Markup.button.callback(' Orders', 'orders_menu')],
      [Markup.button.callback(' Users', 'users_menu')],
      [Markup.button.callback(' Stats', 'stats_menu')],
      [Markup.button.callback(' Newsletter', 'newsletter_menu')]
    ])
  );
});

// NEWSLETTER MANAGEMENT
bot.action('newsletter_menu', async (ctx) => {
  await ctx.answerCbQuery();
  return safeEditMessageText(ctx,
    ' Newsletter Management\n\nSelect action:',
    Markup.inlineKeyboard([
      [Markup.button.callback('View Stats', 'newsletter_stats')],
      [Markup.button.callback('Send Broadcast', 'newsletter_broadcast')],
      [Markup.button.callback('Send Email to User', 'newsletter_send_user')],
      [Markup.button.callback('View Subscribers', 'newsletter_subscribers')],
      [Markup.button.callback(' Back', 'main_menu')]
    ])
  );
});

bot.action('newsletter_stats', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const response = await queueRequest(() => api.get('/newsletter/stats'));
    const stats = response.data.data || {};

    const message = ` <b>Newsletter Statistics</b>\n\n` +
      ` Active Subscribers: <b>${stats.activeCount || 0}</b>\n` +
      ` Inactive Subscribers: <b>${stats.inactiveCount || 0}</b>\n` +
      ` Total Subscribers: <b>${(stats.activeCount || 0) + (stats.inactiveCount || 0)}</b>\n\n` +
      ` Last Updated: ${new Date().toLocaleString()}`;

    return safeEditMessageText(ctx, message, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Refresh', 'newsletter_stats')],
        [Markup.button.callback(' Back', 'newsletter_menu')]
      ]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error fetching stats: ' + error.message, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback(' Back', 'newsletter_menu')]
      ]).reply_markup
    });
  }
});

bot.action('newsletter_subscribers', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const response = await queueRequest(() => api.get('/newsletter/subscribers?limit=20&page=1'));
    const subscribers = response.data.data || [];

    if (subscribers.length === 0) {
      return ctx.editMessageText(' No newsletter subscribers yet.', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback(' Back', 'newsletter_menu')]
        ]).reply_markup
      });
    }

    let message = ' <b>Newsletter Subscribers</b>\n\n';
    subscribers.forEach((sub, i) => {
      message += `${i + 1}. ${sub.email}\n`;
      if (sub.firstName) message += `   Name: ${sub.firstName}${sub.lastName ? ' ' + sub.lastName : ''}\n`;
      message += `   Status: ${sub.subscribed ? '✅ Active' : '❌ Inactive'}\n\n`;
    });

    return ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback(' Back', 'newsletter_menu')]
      ]).reply_markup
    });
  } catch (error) {
    return ctx.editMessageText(' Error fetching subscribers: ' + error.message, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback(' Back', 'newsletter_menu')]
      ]).reply_markup
    });
  }
});

bot.action('newsletter_broadcast', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'broadcast_subject' };
  return ctx.editMessageText(' <b>Newsletter Broadcast</b>\n\nEnter email subject:', { parse_mode: 'HTML' });
});

bot.action('newsletter_send_user', async (ctx) => {
  await ctx.answerCbQuery();
  userContext[ctx.from.id] = { step: 'send_user_email' };
  return ctx.editMessageText(' <b>Send Email to User</b>\n\nEnter recipient email:', { parse_mode: 'HTML' });
});

// NEWSLETTER COMMANDS
bot.command('newsletter', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  return ctx.reply(' <b>Newsletter Commands</b>\n\n' +
    ' /sendmail &lt;email&gt; - Send email to specific user\n' +
    ' /sendall - Broadcast email to all subscribers\n' +
    ' /newsletter - Show this menu\n\n' +
    'Or use the menu system with /start', 
    { parse_mode: 'HTML' }
  );
}));

bot.command('sendmail', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length === 0) {
    return ctx.reply(' <b>Usage:</b> /sendmail &lt;user_email&gt;\n\n<i>Example:</i> /sendmail john@example.com\n\nThen provide subject and message when prompted.', { parse_mode: 'HTML' });
  }

  const userEmail = args[0];
  userContext[ctx.from.id] = { 
    step: 'sendmail_subject', 
    userEmail: userEmail,
    command: 'sendmail'
  };

  return ctx.reply(` <b>Send Email to ${userEmail}</b>\n\nEnter email subject:`, { parse_mode: 'HTML' });
}));

bot.command('sendall', errorWrapper(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(' Unauthorized.');

  userContext[ctx.from.id] = { 
    step: 'sendall_subject',
    command: 'sendall'
  };

  return ctx.reply(' <b>Broadcast Email to All Subscribers</b>\n\nEnter email subject:', { parse_mode: 'HTML' });
}));

// Handle newsletter text inputs
bot.on('text', errorWrapper(async (ctx) => {
  const userId = ctx.from.id;
  const context = userContext[userId];

  if (!context) return; // No active workflow

  // Handle newsletter workflow steps
  if (context.step === 'sendmail_subject') {
    context.subject = ctx.message.text;
    context.step = 'sendmail_message';
    return ctx.reply(` <b>Email Subject:</b> ${context.subject}\n\nNow enter the email message/body:`, { parse_mode: 'HTML' });
  }

  if (context.step === 'sendmail_message') {
    context.message = ctx.message.text;
    
    try {
      await ctx.reply(` Sending email to ${context.userEmail}...`, { parse_mode: 'HTML' });
      
      // Find user by email first
      const usersRes = await queueRequest(() => api.get('/auth/users'));
      const users = usersRes.data.data || [];
      const user = users.find(u => u.email.toLowerCase() === context.userEmail.toLowerCase());

      if (!user) {
        delete userContext[userId];
        return ctx.reply(` User with email "${context.userEmail}" not found.`);
      }

      // Send email via API
      const response = await queueRequest(() => api.post('/newsletter/send-email', {
        userId: user._id,
        subject: context.subject,
        message: context.message
      }));

      delete userContext[userId];
      return ctx.reply(` <b>✅ Email sent successfully!</b>\n\nTo: ${context.userEmail}\nSubject: ${context.subject}`, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback(' Back to Menu', 'main_menu')]
        ]).reply_markup
      });
    } catch (error) {
      delete userContext[userId];
      return ctx.reply(` Error sending email: ${error.message}`);
    }
  }

  if (context.step === 'sendall_subject') {
    context.subject = ctx.message.text;
    context.step = 'sendall_message';
    return ctx.reply(` <b>Broadcast Subject:</b> ${context.subject}\n\nNow enter the message body to send to all subscribers:`, { parse_mode: 'HTML' });
  }

  if (context.step === 'sendall_message') {
    context.message = ctx.message.text;
    
    try {
      await ctx.reply(` Fetching subscriber count...`, { parse_mode: 'HTML' });
      
      // Get subscriber count
      const statsRes = await queueRequest(() => api.get('/newsletter/stats'));
      const subscriberCount = statsRes.data.data?.activeCount || 0;

      if (subscriberCount === 0) {
        delete userContext[userId];
        return ctx.reply(' No active subscribers to send to.');
      }

      // Ask for confirmation
      context.step = 'sendall_confirm';
      return ctx.reply(` <b>Broadcast Confirmation</b>\n\n` +
        `Subject: ${context.subject}\n` +
        `Recipients: ${subscriberCount} active subscribers\n\n` +
        `Send this broadcast to all subscribers?\n\n` +
        `Reply with "YES" to confirm or "NO" to cancel:`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      delete userContext[userId];
      return ctx.reply(` Error: ${error.message}`);
    }
  }

  if (context.step === 'sendall_confirm') {
    if (ctx.message.text.toUpperCase() === 'YES') {
      try {
        await ctx.reply(` Processing broadcast...`, { parse_mode: 'HTML' });
        
        // Send broadcast
        const response = await queueRequest(() => api.post('/newsletter/broadcast', {
          subject: context.subject,
          message: context.message
        }));

        const result = response.data.data || {};
        delete userContext[userId];

        return ctx.reply(` <b>✅ Broadcast sent successfully!</b>\n\n` +
          `Subject: ${context.subject}\n` +
          `Recipients: ${result.count || 'multiple'} subscribers\n` +
          `Status: ${result.status || 'completed'}`,
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback(' Back to Menu', 'main_menu')]
            ]).reply_markup
          }
        );
      } catch (error) {
        delete userContext[userId];
        return ctx.reply(` Error sending broadcast: ${error.message}`);
      }
    } else {
      delete userContext[userId];
      return ctx.reply(' Broadcast cancelled.', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback(' Back to Menu', 'main_menu')]
        ]).reply_markup
      });
    }
  }

  if (context.step === 'broadcast_subject' || context.step === 'send_user_email') {
    // Delegate to existing message handlers structure
    // These will be handled by existing text handler
    return;
  }
}, 'newsletter'));

// PHOTO HANDLER
bot.on('photo', errorWrapper(async (ctx) => {
  const userId = ctx.from.id;
  const context = userContext[userId];

if (!context || (context.step !== 'create_product_image_upload' && context.step !== 'create_land_image_upload' && context.step !== 'upload_apartment_image' && context.step !== 'apartment_slider_image_upload_next')) {
    return ctx.reply(' Please use the product, land, or apartment creation flow to upload images.');
  }

  try {
    // Get the highest resolution photo
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;

    // Get file path from Telegram
    const fileResponse = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
    const filePath = fileResponse.data.result.file_path;

    // Download the file
    const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
    const imageResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);

    // Create form data for upload
    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: context.type === 'land' ? `land_${Date.now()}.jpg` : `product_${Date.now()}.jpg`,
      contentType: 'image/jpeg'
    });

    // Upload to our server
    console.log(`[Photo Upload] Starting upload for ${context.type || 'product'}, userId: ${userId}`);
    const uploadResponse = await api.post('/upload', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${currentToken}`
      }
    });

    console.log(`[Photo Upload] Upload successful, data:`, uploadResponse.data.data);
    
    // Handle new response format with compression
    if (uploadResponse.data.data.dataUrl) {
      context.imageData = uploadResponse.data.data.imageData;
      context.imageMimeType = uploadResponse.data.data.mimeType;
      context.image = uploadResponse.data.data.dataUrl; // Full data URL
      context.filename = uploadResponse.data.data.filename;
      context.compressedSize = uploadResponse.data.data.size;
      
      // Log compression details
      console.log(`[Photo Upload] Image compressed: ${context.filename} (${(context.compressedSize / 1024).toFixed(2)}KB)`);
    } else {
      // Fallback for old format
      context.image = uploadResponse.data.data.imageUrl;
    }
    
    const sizeInfo = context.compressedSize ? ` (${(context.compressedSize / 1024).toFixed(2)}KB)` : '';

    if (context.type === 'land') {
      await ctx.reply(` <b>Image uploaded successfully!</b>${sizeInfo}\n\nCreating land property...`, { parse_mode: 'HTML' });
      await saveLandProperty(ctx, context);
    } else if (context.type === 'apartment') {
      context.sliderImages = context.sliderImages || [];
      context.sliderImages.push(context.image);
      if (context.step === 'upload_apartment_image') {
        await ctx.reply(` <b>Image uploaded successfully!</b>${sizeInfo}\n\nNow choose how many slider images you want.`, { parse_mode: 'HTML' });
        await promptApartmentSliderImageCount(ctx, context);
      } else {
        const currentCount = context.sliderImages.length;
        const totalCount = context.sliderImageCount || currentCount;
        if (currentCount >= totalCount) {
          await ctx.reply(` <b>Image uploaded successfully!</b>${sizeInfo}\n\nCollected ${currentCount} image(s). Saving apartment listing...`, { parse_mode: 'HTML' });
          await finalizeApartmentSliderImages(ctx, context);
        } else {
          const nextImageNumber = currentCount + 1;
          await ctx.reply(` <b>Image uploaded successfully!</b>${sizeInfo}\n\nSend photo ${nextImageNumber} of ${totalCount}, or type SKIP to finish early.`, { parse_mode: 'HTML' });
          context.step = 'apartment_slider_image_upload_next';
        }
      }
    } else {
      await ctx.reply(` <b>Image uploaded successfully!</b>${sizeInfo}\n\nCreating product...`, { parse_mode: 'HTML' });
      await saveProduct(ctx, context);
    }
  } catch (error) {
    console.error(`[Photo Upload] Error uploading photo for userId ${userId}:`, {
      errorMessage: error.message,
      errorCode: error.code,
      errorStatus: error.response?.status,
      errorData: error.response?.data,
      fullError: error
    });
    
    const errorMsg = error.response?.data?.message || error.message || 'Unknown error during upload';
    return ctx.reply(` Error uploading image: ${errorMsg}`);
  }
}));

// Enhanced error handling
bot.catch((err, ctx) => {
  console.error('Telegraf Error:', err);
  if (ctx && ctx.reply) {
    ctx.reply(' An error occurred. Please try again.').catch(e => console.error('Reply error:', e));
  }
});

// Handle process-level errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.log(' Bot will continue running...');
});

// Performance monitoring
setInterval(() => {
  const cacheSize = cache.size;
  const memoryUsage = process.memoryUsage();
  console.log(` Bot Stats - Cache: ${cacheSize} items, Memory: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
}, 300000); // Every 5 minutes

// Launch bot with error handling
(async () => {
  try {
    // Initialize token first
    await initializeToken();
    
    await bot.launch();
    console.log(' Telegram Admin Bot is running with optimization enabled...');
    console.log(` Authorized Admin IDs: ${ADMIN_IDS.join(', ') || 'None configured'}`);
    console.log(' Features: Caching, Rate Limiting, Request Queuing, Connection Pooling, Auto Token Refresh');
  } catch (err) {
    // Handle 409 Conflict (multiple instances during Render redeploy)
    if (err.message?.includes('409')) {
      console.warn(' Bot conflict detected during redeploy - waiting 15s before retry...');
      
      // First retry after 15 seconds
      setTimeout(() => {
        bot.launch().then(() => {
          console.log(' ✅ Bot recovered and is running');
        }).catch(retryErr => {
          console.warn(' Bot recovery attempt 1 failed:', retryErr.message);
          
          // Second retry after another 15 seconds if first fails
          setTimeout(() => {
            bot.launch().then(() => {
              console.log(' ✅ Bot recovered on second attempt and is running');
            }).catch(finalErr => {
              console.warn(' Bot polling failed, but bot will still receive messages:', finalErr.message);
              console.log(' Note: Bot message handlers are still active, just polling may be delayed');
            });
          }, 15000);
        });
      }, 15000);
    } else {
      console.warn(' Bot launch error (bot will retry):', err.message);
      console.log(' Ensure internet connection and TELEGRAM_BOT_TOKEN is valid');
    }
    // Don't crash - bot can still receive messages via polling
  }
})();

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('SIGINT received, stopping bot...');
  clearCache();
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('SIGTERM received, stopping bot...');
  clearCache();
  bot.stop('SIGTERM');
});


require('dotenv').config();
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
  // Wait for server to start (initial buffer)
  console.log('[Bot] Starting bot, waiting for server to be ready...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  let retries = 0;
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
      ' <b>AgroCrown Admin Dashboard</b>\n\n' +
      ' <b>Available Commands:</b>\n\n' +
      ' <b>Products & Land:</b>\n' +
      ' /addproduct - Add product or land property\n' +
      ' /products - List all products & land\n' +
      ' /editproduct &lt;name&gt; - Edit product/land\n' +
      ' /deleteproduct &lt;name&gt; - Delete product/land\n\n' +
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
      'Or use the menu below:',
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback(' Products', 'products_menu')],
          [Markup.button.callback(' Land', 'land_menu')],
          [Markup.button.callback(' Orders', 'orders_menu')],
          [Markup.button.callback(' Users', 'users_menu')],
          [Markup.button.callback(' Stats', 'stats_menu')]
        ]).reply_markup
      }
    );
  }

  // Regular users get website access
  const websiteUrl = process.env.WEBSITE_URL || 'https://agrocrown.example.com';
  return ctx.reply(
    ' <b>Welcome to AgroCrown</b>\n\n' +
    'Premium Agricultural Exports from West Africa\n\n' +
    'Browse our collection of farm-fresh products, view analytics, and place orders on our website.',
    {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.url(' Open AgroCrown Website', websiteUrl)],
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

  // Separate products and land
  const agriProducts = products.filter(p => p.type !== 'land');
  const landProducts = products.filter(p => p.type === 'land');

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

  // Send summary message
  const summaryMessage = ` <b>Products Summary</b>\n\n` +
    ` Agricultural Products: ${agriProducts.length}\n` +
    ` Land Properties: ${landProducts.length}\n` +
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
      [Markup.button.callback(' Land Property', 'add_land_type')]
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

  const message = ` <b>AgroCrown Statistics</b>\n\n` +
    ` Products: <b>${statsData.products.length}</b>\n` +
    ` Users: <b>${statsData.users.length}</b>\n` +
    ` Total Orders: <b>${statsData.orders.length}</b>\n` +
    ` Pending Orders: <b>${statsData.pendingOrders}</b>\n` +
    ` Completed Orders: <b>${statsData.completedOrders}</b>\n` +
    ` Total Revenue: <b>${statsData.totalRevenue.toLocaleString()}</b>\n` +
    ` Orders (30 days): <b>${statsData.recentOrders}</b>`;

  ctx.reply(message, { parse_mode: 'HTML' });
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
  return ctx.editMessageText(
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

bot.on('text', errorWrapper(async (ctx) => {
  const userId = ctx.from.id;
  const context = userContext[userId];
  const text = ctx.message.text;

  console.log(`[Bot] Text from ${userId}: "${text}" (Context step: ${context?.step || 'none'})`);

  if (!context) {
    console.log(`[Bot] No context for user ${userId}`);
    return;
  }

  switch (context.step) {
      case 'create_product_name':
        console.log(`[Bot] Setting product name: ${text}`);
        context.name = text;
        context.step = 'create_product_description';
        return ctx.reply('✏️ Enter product description:');

      case 'create_product_description':
        context.description = ctx.message.text;
        context.step = 'create_product_price';
        return ctx.reply('Enter price per kg (e.g., 45):');

      case 'create_product_price':
        context.pricePerKg = parseFloat(ctx.message.text);
        if (isNaN(context.pricePerKg)) {
          return ctx.reply(' Invalid price. Enter a number:');
        }
        context.step = 'create_product_category';
        return ctx.reply('Select category:', Markup.inlineKeyboard([
        [Markup.button.callback('Smoked Fish', 'cat_fish'), Markup.button.callback('Grains', 'cat_grains')],
        [Markup.button.callback('Rice', 'cat_rice'), Markup.button.callback('Other', 'cat_other')]
      ]));

    case 'create_product_quantity':
      context.quantity = parseFloat(ctx.message.text);
      if (isNaN(context.quantity)) {
        return ctx.reply(' Invalid quantity. Enter a number:');
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
      if (isNaN(context.minLimit) || context.minLimit < 0) {
        return ctx.reply(' Invalid minimum limit. Enter a positive number:');
      }
      context.step = 'create_product_max_limit';
      return ctx.reply(` <b>Maximum Order Limit</b>\n\nEnter the maximum order quantity in <b>${context.unit}</b>:\n\n<i>Must be greater than minimum limit (${context.minLimit})</i>`, { parse_mode: 'HTML' });

    case 'create_product_max_limit':
      context.maxLimit = parseFloat(ctx.message.text);
      if (isNaN(context.maxLimit) || context.maxLimit < 0) {
        return ctx.reply(' Invalid maximum limit. Enter a positive number:');
      }
      if (context.maxLimit <= context.minLimit) {
        return ctx.reply(` Maximum limit must be greater than minimum limit (${context.minLimit} ${context.unit})`);
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
        return ctx.reply(' Invalid area. Enter a positive number:');
      }
      context.step = 'create_land_plots';
      return ctx.reply(' <b>Number of Plots</b>\n\nHow many plots is this property divided into? (e.g., 1, 2, 4, etc.):', { parse_mode: 'HTML' });

    case 'create_land_plots':
      context.numberOfPlots = parseInt(ctx.message.text);
      if (isNaN(context.numberOfPlots) || context.numberOfPlots < 1) {
        return ctx.reply(' Invalid number of plots. Enter a positive whole number:');
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
        return ctx.reply(' Invalid price. Enter a positive number:');
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
        return ctx.reply(' Invalid minimum limit. Enter a positive number:');
      }
      context.step = 'create_land_max_limit';
      return ctx.reply(` <b>Maximum Order Limit</b>\n\nEnter the maximum order quantity in <b>${context.unit}</b>:\n\n<i>Must be greater than minimum limit (${context.minLimit})</i>`, { parse_mode: 'HTML' });

    case 'create_land_max_limit':
      context.maxLimit = parseFloat(ctx.message.text);
      if (isNaN(context.maxLimit) || context.maxLimit < 0) {
        return ctx.reply(' Invalid maximum limit. Enter a positive number:');
      }
      if (context.maxLimit <= context.minLimit) {
        return ctx.reply(` Maximum limit must be greater than minimum limit (${context.minLimit} ${context.unit})`);
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

    case 'update_product_field':
      context.updateValue = ctx.message.text;
      await updateProductField(ctx, context);
      break;
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

bot.action(/^cat_(.+)$/, async (ctx) => {
  const category = ctx.match[1];
  const categoryMap = {
    'fish': 'Smoked Fish',
    'grains': 'Grains',
    'rice': 'Rice',
    'other': 'Other'
  };

  const context = userContext[ctx.from.id];
  context.category = categoryMap[category];
  context.step = 'create_product_quantity';

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
      image: context.image || 'https://images.unsplash.com/photo-1551632786-de41ec4a306b?auto=format&fit=crop&w=400&q=70'
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
  return ctx.editMessageText(
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
  context.image = 'https://images.unsplash.com/photo-1599056377759-3388006e62e0?auto=format&fit=crop&w=400&q=70';
  await saveProduct(ctx, context);
});

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
  return ctx.editMessageText(
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

    return ctx.editMessageText(message, {
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
  return ctx.editMessageText(
    ' AgroCrown Admin Dashboard\n\nSelect an option:',
    Markup.inlineKeyboard([
      [Markup.button.callback(' Products', 'products_menu')],
      [Markup.button.callback(' Orders', 'orders_menu')],
      [Markup.button.callback(' Users', 'users_menu')],
      [Markup.button.callback(' Stats', 'stats_menu')]
    ])
  );
});

// PHOTO HANDLER
bot.on('photo', errorWrapper(async (ctx) => {
  const userId = ctx.from.id;
  const context = userContext[userId];

  if (!context || (context.step !== 'create_product_image_upload' && context.step !== 'create_land_image_upload')) {
    return ctx.reply(' Please use the product or land property creation flow to upload images.');
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

    console.log(`[Photo Upload] Upload successful, image URL: ${uploadResponse.data.data.imageUrl}`);
    context.image = uploadResponse.data.data.imageUrl;
    
    if (context.type === 'land') {
      await ctx.reply(' <b>Image uploaded successfully!</b>\n\nCreating land property...', { parse_mode: 'HTML' });
      await saveLandProperty(ctx, context);
    } else {
      await ctx.reply(' <b>Image uploaded successfully!</b>\n\nCreating product...', { parse_mode: 'HTML' });
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

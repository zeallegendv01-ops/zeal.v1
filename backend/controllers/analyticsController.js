const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');

// ══ ADMIN ANALYTICS ══
// Get comprehensive dashboard analytics (products dynamic based on DB)
exports.getDashboardAnalytics = async (req, res) => {
  try {
    const products = await Product.find().select('name pricePerKg category');
    const orders = await Order.find().select('total status createdAt userId quantity items');
    const users = await User.find().select('email createdAt');

    // Calculate metrics
    const totalRevenue = orders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentOrders = orders.filter(o => new Date(o.createdAt) > thirtyDaysAgo).length;
    const recentRevenue = orders
      .filter(o => o.status === 'completed' && new Date(o.createdAt) > thirtyDaysAgo)
      .reduce((sum, o) => sum + (o.total || 0), 0);

    // Product-specific analytics (dynamic - not hardcoded)
    const productAnalytics = products.map(p => {
      const productOrders = orders.filter(o => 
        o.items && o.items.some(item => item.productId && item.productId.toString() === p._id.toString())
      );
      const totalSold = productOrders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => {
          const productItem = o.items.find(item => item.productId && item.productId.toString() === p._id.toString());
          return sum + (productItem ? productItem.quantity * productItem.weight : 0);
        }, 0);
      
      const revenue = productOrders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => {
          const productItem = o.items.find(item => item.productId && item.productId.toString() === p._id.toString());
          return sum + (productItem ? productItem.quantity * productItem.weight * p.pricePerKg : 0);
        }, 0);

      return {
        name: p.name,
        category: p.category,
        price: p.pricePerKg,
        totalOrders: productOrders.length,
        totalSold,
        revenue,
        color: getProductColor(p.name)
      };
    });

    // Monthly revenue data
    const monthlyData = getMonthlyData(orders);
    const monthlyLabels = monthlyData.labels;
    const monthlyRevenue = monthlyData.revenue;

    // Product volume data (for all products)
    const productVolumeData = {
      labels: productAnalytics.map(p => p.name),
      data: productAnalytics.map(p => p.totalSold),
      colors: productAnalytics.map(p => p.color)
    };

    res.json({
      success: true,
      data: {
        summary: {
          totalProducts: products.length,
          totalUsers: users.length,
          totalOrders: orders.length,
          pendingOrders: orders.filter(o => o.status === 'pending').length,
          completedOrders: orders.filter(o => o.status === 'completed').length,
          totalRevenue,
          recentOrders,
          recentRevenue
        },
        products: productAnalytics,
        monthly: {
          labels: monthlyLabels,
          revenue: monthlyRevenue
        },
        productVolume: productVolumeData,
        breakdown: {
          labels: productAnalytics.map(p => p.name),
          data: productAnalytics.map(p => p.totalOrders),
          colors: productAnalytics.map(p => p.color)
        }
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ══ USER ANALYTICS ══
// Get user-specific transaction analytics
exports.getUserAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user orders
    const userOrders = await Order.find({ userId })
      .populate('items.productId', 'name pricePerKg category')
      .sort({ createdAt: -1 });

    // Calculate metrics
    const totalSpent = userOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = userOrders.filter(o => new Date(o.createdAt) >= today);
    const todaySpent = todayOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const weekOrders = userOrders.filter(o => new Date(o.createdAt) >= sevenDaysAgo);
    const weekSpent = weekOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    // Daily spending (last 7 days)
    const dailyData = getDailyData(userOrders);

    // Recent transactions
    const recentTransactions = userOrders.slice(0, 10).map(order => ({
      id: order._id,
      date: order.createdAt,
      total: order.total,
      status: order.status,
      items: order.items.map(item => ({
        name: item.productId?.name || 'Unknown',
        quantity: item.quantity,
        weight: item.weight,
        subtotal: item.quantity * item.weight * (item.productId?.pricePerKg || 0)
      }))
    }));

    // Product preferences (what user buys most)
    const productPreferences = {};
    userOrders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          const productName = item.productId?.name || 'Unknown';
          if (!productPreferences[productName]) {
            productPreferences[productName] = { count: 0, total: 0 };
          }
          productPreferences[productName].count += 1;
          productPreferences[productName].total += item.quantity * item.weight;
        });
      }
    });

    const topProducts = Object.entries(productPreferences)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        summary: {
          totalOrders: userOrders.length,
          completedOrders: userOrders.filter(o => o.status === 'completed').length,
          pendingOrders: userOrders.filter(o => o.status === 'pending').length,
          totalSpent,
          todaySpent,
          weekSpent
        },
        daily: dailyData,
        recentTransactions,
        topProducts,
        orderHistory: userOrders.map(order => ({
          id: order._id,
          date: order.createdAt,
          total: order.total,
          status: order.status,
          itemCount: order.items.length
        }))
      }
    });
  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ══ HELPER FUNCTIONS ══

function getMonthlyData(orders) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  const monthlyRevenue = new Array(12).fill(0);

  orders.forEach(order => {
    if (order.status === 'completed') {
      const orderDate = new Date(order.createdAt);
      if (orderDate.getFullYear() === currentYear) {
        monthlyRevenue[orderDate.getMonth()] += order.total || 0;
      }
    }
  });

  // Convert to thousands for chart display
  const revenue = monthlyRevenue.map(r => Math.round(r / 1000));

  return { labels: months, revenue };
}

function getDailyData(orders) {
  const days = {};
  const today = new Date();
  
  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    days[dateStr] = 0;
  }

  // Fill in actual data
  orders.forEach(order => {
    if (order.status === 'completed') {
      const dateStr = new Date(order.createdAt).toISOString().split('T')[0];
      if (days.hasOwnProperty(dateStr)) {
        days[dateStr] += order.total || 0;
      }
    }
  });

  const labels = Object.keys(days).map(date => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });

  const data = Object.values(days);

  return { labels, data };
}

function getProductColor(productName) {
  const colorMap = {
    'Artesian Smoked Catfish': '#b8933a',
    'Traditional Pure Garri': '#2a4a1e',
    'Whole Exquisite Kola Nuts': '#e6c97a',
    // Add more products with colors as needed
  };
  return colorMap[productName] || '#999999';
}

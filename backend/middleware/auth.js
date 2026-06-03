const jwt = require('jsonwebtoken');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    req.user = decoded;

    // Ensure accountType and email are available for authorize checks
    if (!req.user.accountType || !req.user.email) {
      const User = require('../models/User');
      const user = await User.findById(decoded.id).select('email accountType');
      if (user) {
        req.user.email = user.email;
        req.user.accountType = user.accountType;
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    // Allow the configured admin email to access admin-only endpoints
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    const userEmail = String(req.user.email || '').toLowerCase();

    if (userEmail && adminEmail && userEmail === adminEmail) {
      return next();
    }

    if (req.user.accountType === 'admin' || roles.includes(req.user.accountType)) {
      next();
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized to access this resource' });
    }
  };
};

module.exports = { protect, authorize };

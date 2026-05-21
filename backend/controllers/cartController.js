const User = require('../models/User');
const Product = require('../models/Product');

// Add item to cart
exports.addToCart = async (req, res, next) => {
  try {
    const { product, quantity, weight, pricePerKg } = req.body;

    if (!product || !quantity) {
      return res.status(400).json({ success: false, message: 'Please provide product and quantity' });
    }

    // Verify product exists
    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const user = await User.findById(req.user.id);

    // Check if item already in cart
    const existingItem = user.cart.find(item => item.product.toString() === product);
    
    if (existingItem) {
      // Update quantity if already in cart
      existingItem.quantity += quantity;
      if (weight) existingItem.weight = weight;
      if (pricePerKg) existingItem.pricePerKg = pricePerKg;
    } else {
      // Add new item to cart
      user.cart.push({
        product,
        quantity,
        weight,
        pricePerKg,
        addedAt: new Date()
      });
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      cart: user.cart
    });
  } catch (error) {
    next(error);
  }
};

// Get cart
exports.getCart = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('cart.product', 'name pricePerKg category image');

    res.status(200).json({
      success: true,
      data: user.cart
    });
  } catch (error) {
    next(error);
  }
};

// Update cart item
exports.updateCartItem = async (req, res, next) => {
  try {
    const { product, quantity, weight, pricePerKg } = req.body;

    if (!product || !quantity) {
      return res.status(400).json({ success: false, message: 'Please provide product and quantity' });
    }

    const user = await User.findById(req.user.id);
    const cartItem = user.cart.find(item => item.product.toString() === product);

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    cartItem.quantity = quantity;
    if (weight) cartItem.weight = weight;
    if (pricePerKg) cartItem.pricePerKg = pricePerKg;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Cart item updated',
      cart: user.cart
    });
  } catch (error) {
    next(error);
  }
};

// Remove item from cart
exports.removeFromCart = async (req, res, next) => {
  try {
    const { product } = req.params;

    const user = await User.findById(req.user.id);
    const initialLength = user.cart.length;

    user.cart = user.cart.filter(item => item.product.toString() !== product);

    if (user.cart.length === initialLength) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      cart: user.cart
    });
  } catch (error) {
    next(error);
  }
};

// Clear entire cart
exports.clearCart = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (user.cart.length === 0) {
      return res.status(200).json({ success: true, message: 'Cart is already empty' });
    }

    user.cart = [];
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      cart: user.cart
    });
  } catch (error) {
    next(error);
  }
};

// Get cart count
exports.getCartCount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      count: user.cart.length
    });
  } catch (error) {
    next(error);
  }
};

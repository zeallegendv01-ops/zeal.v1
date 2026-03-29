const Order = require('../models/Order');
const Product = require('../models/Product');
const telegramNotifier = require('../utils/telegramNotifier');

exports.createOrder = async (req, res, next) => {
  try {
    const { items, shippingAddress, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide order items' });
    }

    let subtotal = 0;
    const orderItems = [];

    // Validate items and calculate subtotal based on product type
    for (const item of items) {
      const product = await Product.findOne({ $or: [{ _id: item.product }, { code: item.product }] });
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${item.product} not found` });
      }

      // Validate quantity against min and max limits
      let orderQuantity = 0;
      if (product.type === 'land') {
        orderQuantity = item.plotsRequested || item.quantity;
      } else {
        orderQuantity = item.quantity;
      }

      if (orderQuantity < product.minLimit) {
        return res.status(400).json({ 
          success: false, 
          message: `Minimum order for ${product.name} is ${product.minLimit} ${product.unit}` 
        });
      }

      if (orderQuantity > product.maxLimit) {
        return res.status(400).json({ 
          success: false, 
          message: `Maximum order for ${product.name} is ${product.maxLimit} ${product.unit}` 
        });
      }

      let itemSubtotal = 0;
      let pricePerUnit = 0;

      if (product.type === 'land') {
        // For land: calculate based on pricing type
        pricePerUnit = product.landPricingType === 'fixed' 
          ? product.pricePerPlot 
          : (product.pricePerSqMeter * product.areaSqMeters);
        itemSubtotal = pricePerUnit * (item.plotsRequested || item.quantity);
        
        orderItems.push({
          product: product._id,
          quantity: item.plotsRequested || item.quantity,
          plotsRequested: item.plotsRequested || item.quantity,
          pricePerUnit: pricePerUnit,
          subtotal: itemSubtotal,
          type: 'land'
        });
      } else {
        // For products: calculate based on weight
        pricePerUnit = product.pricePerKg;
        itemSubtotal = pricePerUnit * item.weight * item.quantity;
        
        orderItems.push({
          product: product._id,
          quantity: item.quantity,
          weight: item.weight,
          pricePerUnit: pricePerUnit,
          subtotal: itemSubtotal,
          type: 'product'
        });
      }

      subtotal += itemSubtotal;
    }

    const shippingCost = 0;
    const tax = 0;
    const total = subtotal + shippingCost + tax;

    const order = await Order.create({
      buyer: req.user.id,
      items: orderItems,
      shippingAddress,
      subtotal,
      shippingCost,
      tax,
      total,
      notes
    });

    const populatedOrder = await order.populate([
      { path: 'buyer', select: 'firstName lastName email phone' },
      { path: 'items.product', select: 'name pricePerKg pricePerPlot category type' }
    ]);

    // Send notification to admin via Telegram
    try {
      await telegramNotifier.notifyNewOrder(populatedOrder);
    } catch (notificationError) {
      console.error('Failed to send Telegram notification:', notificationError);
      // Don't fail the order creation if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: populatedOrder
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ buyer: req.user.id })
      .populate('items.product', 'name pricePerKg category')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('buyer', 'firstName lastName email phone')
      .populate('items.product', 'name pricePerKg category image');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if user is the buyer
    if (order.buyer._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    let order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if user is the buyer or admin
    if (order.buyer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this order' });
    }

    const oldStatus = order.status;
    order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });

    // Send notification if status changed
    if (oldStatus !== status) {
      try {
        const populatedOrder = await order.populate('buyer', 'firstName lastName email');
        await telegramNotifier.notifyOrderStatusUpdate(populatedOrder, oldStatus);
      } catch (notificationError) {
        console.error('Failed to send status update notification:', notificationError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('buyer', 'firstName lastName email company')
      .populate('items.product', 'name pricePerKg category')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

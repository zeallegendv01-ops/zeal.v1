const Order = require('../models/Order');
const Product = require('../models/Product');
const telegramNotifier = require('../utils/telegramNotifier');
const InventoryService = require('../utils/inventoryService');
const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD || '5', 10);

exports.createOrder = async (req, res, next) => {
  try {
    const { items, shippingAddress, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide order items' });
    }

    let subtotal = 0;
    const orderItems = [];
    const stockNotifications = [];
    const session = await Order.startSession();
    let createdOrder = null;

    try {
      await session.withTransaction(async () => {
        for (const item of items) {
          const product = await Product.findOne({ $or: [{ _id: item.product }, { code: item.product }] }).session(session);
          if (!product) {
            throw new Error(`Product ${item.product} not found`);
          }

          // Validate quantity against min and max limits
          let orderQuantity = 0;
          if (product.type === 'land') {
            orderQuantity = item.plotsRequested || item.quantity;
          } else {
            orderQuantity = item.quantity;
          }

          if (orderQuantity < product.minLimit) {
            throw new Error(`Minimum order for ${product.name} is ${product.minLimit} ${product.unit}`);
          }

          if (orderQuantity > product.maxLimit) {
            throw new Error(`Maximum order for ${product.name} is ${product.maxLimit} ${product.unit}`);
          }

          const requestedQty = InventoryService.getRequestedQuantity(product, item);
          if (requestedQty > 0) {
            await InventoryService.validateStockForItem(product, item);
            const { product: updatedProduct, remainingStock } = await InventoryService.deductInventory(product, requestedQty, session);

            if (remainingStock === 0) {
              stockNotifications.push({ type: 'out-of-stock', product: updatedProduct });
            } else if (LOW_STOCK_THRESHOLD > 0 && remainingStock <= LOW_STOCK_THRESHOLD) {
              stockNotifications.push({ type: 'low-stock', product: updatedProduct, remainingStock });
            }
          }

          let itemSubtotal = 0;
          let pricePerUnit = 0;

          if (product.type === 'land') {
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

        const order = new Order({
          buyer: req.user.id,
          items: orderItems,
          shippingAddress,
          subtotal,
          shippingCost,
          tax,
          total,
          notes
        });

        createdOrder = await order.save({ session });
      });
    } catch (orderError) {
      await session.abortTransaction();
      session.endSession();

      if (orderError.message && orderError.message.startsWith('Minimum order for')) {
        return res.status(400).json({ success: false, message: orderError.message });
      }
      if (orderError.message && orderError.message.startsWith('Maximum order for')) {
        return res.status(400).json({ success: false, message: orderError.message });
      }
      if (orderError.message && orderError.message.includes('currently available')) {
        return res.status(400).json({ success: false, message: orderError.message });
      }

      console.error('Order creation failed:', orderError);
      return res.status(500).json({ success: false, message: 'Failed to create order' });
    }

    session.endSession();

    if (!createdOrder) {
      return res.status(500).json({ success: false, message: 'Failed to create order' });
    }

    const populatedOrder = await createdOrder.populate([
      { path: 'buyer', select: 'firstName lastName email phone' },
      { path: 'items.product', select: 'name pricePerKg pricePerPlot category type' }
    ]);

    for (const notification of stockNotifications) {
      try {
        if (notification.type === 'out-of-stock') {
          await telegramNotifier.notifyProductOutOfStock(notification.product);
        } else if (notification.type === 'low-stock') {
          await telegramNotifier.notifyProductLowStock(notification.product, notification.remainingStock, LOW_STOCK_THRESHOLD);
        }
      } catch (notifyError) {
        console.error('Failed to send stock notification:', notifyError);
      }
    }

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

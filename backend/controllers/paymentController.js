const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);
const Order = require('../models/Order');
const Settings = require('../models/Settings');
const telegramNotifier = require('../utils/telegramNotifier');
const emailService = require('../utils/emailService');
const { generateInvoiceHTML } = require('../utils/invoiceGenerator');

// Initialize payment transaction
exports.initializePayment = async (req, res, next) => {
  try {
    const { items, shippingAddress, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide order items' });
    }

    // Calculate total amount using prices from cart (what user saw)
    let subtotal = 0;
    const Product = require('../models/Product');

    console.log('Processing items:', items); // Debug log

    for (const item of items) {
      console.log('Looking up product:', item.product); // Debug log
      const product = await Product.findOne({ $or: [{ _id: item.product }, { code: item.product }] });
      if (!product) {
        console.error('Product not found:', item.product); // Debug log
        return res.status(404).json({ success: false, message: `Product ${item.product} not found` });
      }
      
      console.log('Found product:', product.name, 'Type:', product.type, 'Quantity:', item.quantity); // Debug log
      
      // Calculate price based on product type
      let itemPrice = 0;
      if (product.type === 'land') {
        // For land: use price per plot or per sq meter based on pricing type
        if (product.landPricingType === 'fixed') {
          itemPrice = product.pricePerPlot || 0;
          console.log('Land (fixed) - Price per plot:', itemPrice, 'Quantity:', item.quantity);
          subtotal += itemPrice * item.quantity;
        } else {
          // Per-meter pricing: price per m² × area × quantity
          const areaPerPlot = product.areaSqMeters || 0;
          itemPrice = product.pricePerSqMeter || 0;
          console.log('Land (per-meter) - Price per m²:', itemPrice, 'Area per plot:', areaPerPlot, 'Quantity:', item.quantity);
          subtotal += itemPrice * areaPerPlot * item.quantity;
        }
      } else {
        // For regular products: use price from cart if available, otherwise from DB
        itemPrice = item.pricePerKg || product.pricePerKg || 0;
        console.log('Product - Price per kg:', itemPrice, 'Weight:', item.weight, 'Quantity:', item.quantity);
        subtotal += itemPrice * item.weight * item.quantity;
      }
    }

    console.log('Subtotal calculated:', subtotal); // Debug log

    // Fetch settings from database
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ taxRate: 10, shippingFee: 50 });
      await settings.save();
    }

    // Check if cart contains only land items
    let hasProductItems = false;
    for (const item of items) {
      const product = await Product.findOne({ $or: [{ _id: item.product }, { code: item.product }] });
      if (product && product.type !== 'land') {
        hasProductItems = true;
        break;
      }
    }

    const taxRate = settings.taxRate / 100; // Convert percentage to decimal
    const tax = subtotal * taxRate; // Calculate tax based on rate
    const shippingCost = hasProductItems ? settings.shippingFee : 0; // Only add shipping if there are products
    const total = Math.round(subtotal + shippingCost + tax); // Amount in Naira
    const amountInKobo = total * 100; // Paystack expects amount in kobo (for NGN)

    console.log('Amount breakdown - Subtotal:', subtotal, 'Tax:', tax, 'Shipping:', shippingCost, 'Total(NGN):', total, 'Total(Kobo):', amountInKobo); // Debug log

    // Create Paystack transaction
    const transactionData = {
      amount: amountInKobo, // Paystack expects amount in kobo (for NGN) or cents (for USD)
      currency: 'NGN',
      email: req.user.email,
      reference: `AGRO-${Date.now()}-${req.user.id}`,
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:8000'}/payment-success`,
      metadata: {
        userId: req.user.id,
        userEmail: req.user.email,
        items: items,
        shippingAddress: shippingAddress,
        notes: notes
      }
    };

    const response = await paystack.transaction.initialize(transactionData);

    console.log('Paystack response:', JSON.stringify(response, null, 2)); // Debug log

    if (!response || !response.status || response.status !== true) {
      console.error('Paystack initialization failed:', response);
      return res.status(400).json({ 
        success: false, 
        message: response?.message || 'Failed to initialize payment with Paystack' 
      });
    }

    if (!response.data || !response.data.reference) {
      console.error('Invalid Paystack response structure:', response);
      return res.status(500).json({ 
        success: false, 
        message: 'Invalid response from payment provider' 
      });
    }

    res.status(200).json({
      success: true,
      data: {
        publicKey: process.env.PAYSTACK_PUBLIC_KEY,
        customerEmail: req.user.email,
        amountInKobo: amountInKobo, // Send amount in kobo
        amountInNaira: total, // Also send naira for reference
        reference: response.data.reference,
        authorization_url: response.data.authorization_url
      }
    });
  } catch (error) {
    console.error('Paystack initialization error:', error);
    next(error);
  }
};

// Verify payment status
exports.verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    const response = await paystack.transaction.verify(reference);

    if (response.data.status === 'success') {
      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: response.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }
  } catch (error) {
    console.error('Paystack verification error:', error);
    next(error);
  }
};

// Handle Paystack webhooks
exports.handleWebhook = async (req, res, next) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = require('crypto').createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const { reference, metadata } = event.data;

      // Check if order already exists
      const existingOrder = await Order.findOne({ 'metadata.paystackReference': reference });
      if (existingOrder) {
        return res.status(200).json({ received: true });
      }

      // Create the order
      const Product = require('../models/Product');
      let subtotal = 0;
      const orderItems = [];

      // Validate items and calculate subtotal using prices from cart
      for (const item of metadata.items) {
        const product = await Product.findOne({ $or: [{ _id: item.product }, { code: item.product }] });
        if (!product) {
          console.error(`Product ${item.product} not found`);
          continue;
        }

        // Use the price from cart (what user saw and agreed to pay)
        const pricePerUnit = item.pricePerKg || product.pricePerKg;
        const itemSubtotal = pricePerUnit * item.weight * item.quantity;
        orderItems.push({
          product: product._id,
          quantity: item.quantity,
          weight: item.weight,
          pricePerUnit: pricePerUnit,
          subtotal: itemSubtotal
        });

        subtotal += itemSubtotal;
      }

      // Fetch settings from database
      let settings = await Settings.findOne();
      if (!settings) {
        settings = new Settings({ taxRate: 10, shippingFee: 50 });
        await settings.save();
      }

      // Check if order contains only land items
      let hasProductItems = false;
      for (const item of metadata.items) {
        const product = await Product.findOne({ $or: [{ _id: item.product }, { code: item.product }] });
        if (product && product.type !== 'land') {
          hasProductItems = true;
          break;
        }
      }

      const taxRate = settings.taxRate / 100;
      const tax = subtotal * taxRate;
      const shippingCost = hasProductItems ? settings.shippingFee : 0; // Only add shipping if there are products
      const total = subtotal + shippingCost + tax;

      const order = await Order.create({
        buyer: metadata.userId,
        items: orderItems,
        shippingAddress: metadata.shippingAddress,
        subtotal,
        shippingCost,
        tax,
        total,
        paymentStatus: 'completed',
        notes: metadata.notes,
        metadata: {
          paystackReference: reference,
          paystackData: event.data
        }
      });

      const populatedOrder = await order.populate([
        { path: 'buyer', select: 'firstName lastName email phone address' },
        { path: 'items.product', select: 'name pricePerKg category' }
      ]);

      // Send payment notification to admin via Telegram
      try {
        await telegramNotifier.notifyPayment(populatedOrder, event.data);
      } catch (notificationError) {
        console.error('Failed to send payment notification:', notificationError);
      }

      // Generate and send invoice email to customer
      try {
        const invoiceHTML = generateInvoiceHTML(populatedOrder);
        await emailService.sendInvoiceEmail(populatedOrder, invoiceHTML);
        console.log('[SUCCESS] Invoice sent to:', populatedOrder.buyer.email);
      } catch (invoiceError) {
        console.error('Failed to send invoice email:', invoiceError);
        // Don't fail the webhook if email fails - order is already created
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Get order invoice for download
exports.getOrderInvoice = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    // Find order and verify ownership
    const order = await Order.findById(orderId).populate([
      { path: 'buyer', select: 'firstName lastName email phone address' },
      { path: 'items.product', select: 'name pricePerKg category' }
    ]);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify the user owns this order
    if (order.buyer._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You do not have permission to access this invoice' });
    }

    // Generate invoice HTML
    const invoiceHTML = generateInvoiceHTML(order);

    // Send as downloadable HTML file
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="Invoice-${order._id}.html"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    res.send(invoiceHTML);
  } catch (error) {
    console.error('Get invoice error:', error);
    next(error);
  }
};
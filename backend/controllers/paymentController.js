const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);
const Order = require('../models/Order');
const Settings = require('../models/Settings');
const telegramNotifier = require('../utils/telegramNotifier');
const whatsappNotifier = require('../utils/whatsappNotifier');
const emailService = require('../utils/emailService');
const { generateInvoiceHTML } = require('../utils/invoiceGenerator');

const calculateCartItem = (product, item) => {
  const quantity = item.quantity || 1;
  const productType = product.type;
  let pricePerUnit = 0;
  let subtotal = 0;
  let weight = item.weight || 1;

  if (productType === 'land') {
    if (product.landPricingType === 'fixed') {
      pricePerUnit = product.pricePerPlot || 0;
      subtotal = pricePerUnit * quantity;
    } else {
      const areaPerPlot = product.areaSqMeters || 0;
      pricePerUnit = product.pricePerSqMeter || 0;
      subtotal = pricePerUnit * areaPerPlot * quantity;
    }
  } else if (productType === 'apartment') {
    pricePerUnit = product.listingType === 'rent'
      ? (product.pricePerMonth || item.pricePerMonth || 0)
      : (product.price || item.price || 0);
    subtotal = pricePerUnit * quantity;
  } else {
    pricePerUnit = item.pricePerKg || product.pricePerKg || 0;
    subtotal = pricePerUnit * weight * quantity;
  }

  return { pricePerUnit, subtotal, weight };
};

// Initialize payment transaction
exports.initializePayment = async (req, res, next) => {
  try {
    const { items, shippingAddress, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide order items' });
    }

    // Validate shipping address - required for order delivery
    if (!shippingAddress) {
      return res.status(400).json({ success: false, message: 'Please provide a shipping address' });
    }

    const requiredAddressFields = ['street', 'city', 'state', 'postalCode', 'country'];
    const missingFields = requiredAddressFields.filter(field => !shippingAddress[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Incomplete address. Missing: ${missingFields.join(', ')}` 
      });
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
      const { pricePerUnit, subtotal: itemSubtotal } = calculateCartItem(product, item);
      subtotal += itemSubtotal;
      console.log('Calculated item subtotal:', itemSubtotal, 'Price per unit:', pricePerUnit, 'Weight:', item.weight || 1);
    }

    console.log('Subtotal calculated:', subtotal); // Debug log

    // Fetch settings from database
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ taxRate: 10, shippingFee: 50 });
      await settings.save();
    }

    // Check if cart contains product items that require shipping
    let hasProductItems = false;
    for (const item of items) {
      const product = await Product.findOne({ $or: [{ _id: item.product }, { code: item.product }] });
      if (product && product.type === 'product') {
        hasProductItems = true;
        break;
      }
    }

    const taxRate = settings.taxRate / 100; // Convert percentage to decimal
    const tax = subtotal * taxRate; // Calculate tax based on rate
    const shippingCost = hasProductItems ? settings.shippingFee : 0; // Only add shipping if there are products
    const total = Math.round((subtotal + shippingCost + tax) * 100) / 100; // Round to 2 decimal places for consistency with frontend
    const amountInKobo = Math.round(total * 100); // Paystack expects amount in kobo (for NGN)

    console.log('\n========== PAYMENT CALCULATION ==========');
    console.log('Subtotal (NGN):', subtotal);
    console.log('Tax Rate (%):', settings.taxRate);
    console.log('Tax Amount (NGN):', tax.toFixed(2));
    console.log('Shipping Cost (NGN):', shippingCost);
    console.log('Has Product Items:', hasProductItems);
    console.log('TOTAL (NGN):', total);
    console.log('AMOUNT FOR PAYSTACK (Kobo):', amountInKobo);
    console.log('Amount in Naira:', amountInKobo / 100);
    console.log('========================================\n');

    // Create Paystack transaction
    const transactionData = {
      amount: amountInKobo, // Paystack expects amount in kobo (for NGN) or cents (for USD)
      currency: 'NGN',
      email: req.user.email,
      reference: `AGRO-${Date.now()}-${req.user.id}`,
      callback_url: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/payments/success`,
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
    } else if (response.data.status === 'failed') {
      // Get failure details
      const failureReason = response.data.authorization?.reason || 'Payment declined';
      const failureCode = response.data.authorization?.status || 'unknown';
      
      res.status(400).json({
        success: false,
        message: failureReason,
        failureCode: failureCode,
        failureReason: failureReason
      });
    } else {
      // For pending, abandoned, or other statuses
      res.status(400).json({
        success: false,
        message: 'Payment not completed or pending'
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

    // Handle failed payments
    if (event.event === 'charge.failed') {
      const { reference, metadata, authorization } = event.data;

      // Check if failed order already exists
      const existingFailedOrder = await Order.findOne({ 'metadata.paystackReference': reference });
      if (existingFailedOrder) {
        return res.status(200).json({ received: true });
      }

      // Create failed payment order record
      const Product = require('../models/Product');
      let subtotal = 0;
      const orderItems = [];

      // Validate items and calculate subtotal
      for (const item of metadata?.items || []) {
        const product = await Product.findOne({ $or: [{ _id: item.product }, { code: item.product }] });
        if (!product) {
          console.error(`Product ${item.product} not found`);
          continue;
        }

        const { pricePerUnit, subtotal: itemSubtotal, weight } = calculateCartItem(product, item);
        orderItems.push({
          product: product._id,
          quantity: item.quantity || 1,
          weight,
          pricePerUnit: pricePerUnit,
          subtotal: itemSubtotal
        });

        subtotal += itemSubtotal;
      }

      // Fetch settings
      let settings = await Settings.findOne();
      if (!settings) {
        settings = new Settings({ taxRate: 10, shippingFee: 50 });
        await settings.save();
      }

      // Check if order contains product items
      let hasProductItems = false;
      for (const item of metadata?.items || []) {
        const product = await Product.findOne({ $or: [{ _id: item.product }, { code: item.product }] });
        if (product && product.type === 'product') {
          hasProductItems = true;
          break;
        }
      }

      const taxRate = settings.taxRate / 100;
      const tax = subtotal * taxRate;
      const shippingCost = hasProductItems ? settings.shippingFee : 0;
      const total = subtotal + shippingCost + tax;

      // Create failed payment order
      const failedOrder = await Order.create({
        buyer: metadata?.userId,
        items: orderItems,
        shippingAddress: metadata?.shippingAddress,
        subtotal,
        shippingCost,
        tax,
        total,
        paymentStatus: 'failed',
        notes: metadata?.notes,
        metadata: {
          paystackReference: reference,
          paystackData: event.data,
          failureReason: authorization?.reason || 'Payment declined',
          failureCode: authorization?.status || 'unknown'
        }
      });

      const populatedFailedOrder = await failedOrder.populate([
        { path: 'buyer', select: 'firstName lastName email phone' },
        { path: 'items.product', select: 'name pricePerKg category' }
      ]);

      // Send failure notification to admin via Telegram
      try {
        await telegramNotifier.notifyPaymentFailure(populatedFailedOrder, event.data, authorization?.reason);
      } catch (notificationError) {
        console.error('Failed to send payment failure notification:', notificationError);
      }

      // Send failure notification to customer via WhatsApp
      try {
        await whatsappNotifier.notifyPaymentFailure(populatedFailedOrder, authorization?.reason || 'Your payment was declined');
      } catch (whatsappError) {
        console.error('Failed to send WhatsApp payment failure notification:', whatsappError);
      }

      // Send failure email to customer
      try {
        const failureReason = authorization?.reason || 'Your payment was declined';
        await emailService.sendPaymentFailureEmail(populatedFailedOrder, failureReason);
        console.log('[PAYMENT FAILED] Notification sent to:', populatedFailedOrder.buyer.email);
      } catch (emailError) {
        console.error('Failed to send payment failure email:', emailError);
      }

      console.log(`[PAYMENT FAILED] Reference: ${reference}, Reason: ${authorization?.reason}`);
    }

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

        const { pricePerUnit, subtotal: itemSubtotal, weight } = calculateCartItem(product, item);
        orderItems.push({
          product: product._id,
          quantity: item.quantity || 1,
          weight,
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

      // Check if order contains product items that require shipping
      let hasProductItems = false;
      for (const item of metadata.items) {
        const product = await Product.findOne({ $or: [{ _id: item.product }, { code: item.product }] });
        if (product && product.type === 'product') {
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

      // Send success notification to customer via WhatsApp
      try {
        await whatsappNotifier.notifyPaymentSuccess(populatedOrder);
      } catch (whatsappError) {
        console.error('Failed to send WhatsApp payment notification:', whatsappError);
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

      // Clear cart for buyer after successful payment
      try {
        const User = require('../models/User');
        await User.findByIdAndUpdate(
          metadata.userId,
          { cart: [] },
          { new: true }
        );
        console.log('[SUCCESS] Cart cleared for buyer:', metadata.userId);
      } catch (cartError) {
        console.error('Failed to clear cart:', cartError);
        // Don't fail the webhook if cart clearing fails - order is already created
      }

      console.log(`[PAYMENT SUCCESS] Reference: ${reference}, OrderId: ${order._id}`);
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

// Handle payment success page (callback from Paystack)
exports.handlePaymentSuccess = async (req, res, next) => {
  try {
    const { reference, trxref } = req.query;
    const paymentReference = reference || trxref;

    if (!paymentReference) {
      // Redirect to home with error
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?payment=error&message=Missing payment reference`);
    }

    // Verify the payment with Paystack
    const response = await paystack.transaction.verify(paymentReference);

    if (!response.status) {
      // Redirect to home with error
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?payment=error&message=Failed to verify payment`);
    }

    const paymentData = response.data;

    if (paymentData.status === 'success') {
      // Wait for order to be created by webhook (with retry logic)
      let order = null;
      let retries = 0;
      const maxRetries = 10;
      const retryDelay = 500; // 500ms between retries

      while (!order && retries < maxRetries) {
        order = await Order.findOne({ 'metadata.paystackReference': paymentReference });
        if (!order) {
          retries++;
          if (retries < maxRetries) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }

      // Log if order creation timed out
      if (!order && retries >= maxRetries) {
        console.warn(`Order not found after ${maxRetries} retries for reference: ${paymentReference}`);
      }

      // Redirect to home with success status and order ID
      const orderId = order?._id || '';
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:4000'}?payment=success&orderId=${orderId}&clearCart=true`;
      return res.redirect(redirectUrl);
    } else {
      // Redirect to home with error
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?payment=error&message=Payment not successful`);
    }
  } catch (error) {
    console.error('Payment success handler error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?payment=error&message=Error processing payment`);
  }
};
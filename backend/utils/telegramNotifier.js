const axios = require('axios');

class TelegramNotifier {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.adminIds = (process.env.ADMIN_TELEGRAM_ID || '')
      .split(',')
      .map(id => id.trim())
      .filter(id => id);
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendMessage(chatId, text, options = {}) {
    if (!chatId || !this.botToken) {
      console.log('Telegram credentials not configured');
      return null;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: options.parseMode || 'HTML',
        reply_markup: options.replyMarkup
      });
      return response.data;
    } catch (error) {
      console.error('Telegram sendMessage error:', error.response?.data || error.message);
      return null;
    }
  }

  async sendToAdmins(text, options = {}) {
    if (!this.adminIds.length || !this.botToken) {
      console.log('Telegram admin IDs not configured');
      return;
    }

    const results = [];
    for (const adminId of this.adminIds) {
      results.push(await this.sendMessage(adminId, text, options));
    }
    return results;
  }

  async notifyNewOrder(order) {
    if (!this.adminIds.length || !this.botToken) {
      console.log('Telegram credentials not configured');
      return;
    }

    const message = this.formatOrderMessage(order);
    return await this.sendToAdmins(message, {
      replyMarkup: {
        inline_keyboard: [
          [
            { text: 'View Details', callback_data: `order_${order._id}` },
            { text: 'Confirm Order', callback_data: `confirm_${order._id}` }
          ],
          [
            { text: 'Mark Shipped', callback_data: `ship_${order._id}` },
            { text: 'Cancel Order', callback_data: `cancel_${order._id}` }
          ]
        ]
      }
    });
  }

  formatOrderMessage(order) {
    let message = ` <b>NEW ORDER RECEIVED</b>\n\n`;
    message += ` <b>Order:</b> ${order.orderNumber}\n`;
    message += ` <b>Customer:</b> ${order.buyer.firstName} ${order.buyer.lastName}\n`;
    message += ` <b>Email:</b> ${order.buyer.email}\n`;
    message += ` <b>Phone:</b> ${order.buyer.phone || 'Not provided'}\n\n`;

    message += ` <b>Items:</b>\n`;
    order.items.forEach((item, index) => {
      message += `${index + 1}. ${item.product.name}\n`;
      message += `   Quantity: ${item.quantity}  Weight: ${item.weight}kg\n`;
      message += `   Price: $${item.pricePerUnit}/kg  Subtotal: $${item.subtotal.toFixed(2)}\n\n`;
    });

    message += ` <b>Totals:</b>\n`;
    message += `Subtotal: ${order.subtotal.toFixed(2)}\n`;
    message += `Shipping: ${order.shippingCost.toFixed(2)}\n`;
    message += `Tax: ${order.tax.toFixed(2)}\n`;
    message += `<b>Total: ${order.total.toFixed(2)}</b>\n\n`;

    message += ` <b>Shipping Address:</b>\n`;
    if (order.shippingAddress) {
      message += `${order.shippingAddress.addressLine || ''}\n`;
      message += `${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''}\n`;
      message += `${order.shippingAddress.country || ''} ${order.shippingAddress.postalCode || ''}\n`;
    }

    if (order.notes) {
      message += `\n <b>Notes:</b> ${order.notes}\n`;
    }

    message += `\n <b>Status:</b> ${order.status.toUpperCase()}\n`;
    message += ` <b>Date:</b> ${new Date(order.createdAt).toLocaleString()}`;

    return message;
  }

  async notifyOrderStatusUpdate(order, oldStatus) {
    if (!this.adminIds.length || !this.botToken) return;

    const message = ` <b>ORDER STATUS UPDATED</b>\n\n` +
      ` <b>Order:</b> ${order.orderNumber}\n` +
      ` <b>Customer:</b> ${order.buyer.firstName} ${order.buyer.lastName}\n` +
      ` <b>Status:</b> ${oldStatus}  <b>${order.status.toUpperCase()}</b>\n` +
      ` <b>Total:</b> $${order.total.toFixed(2)}\n\n` +
      ` <b>Updated:</b> ${new Date().toLocaleString()}`;

    return await this.sendToAdmins(message);
  }

  async notifyNewUser(user) {
    if (!this.adminIds.length || !this.botToken) return;

    const message = ` <b>NEW USER REGISTERED</b>\n\n` +
      ` <b>Name:</b> ${user.firstName} ${user.lastName}\n` +
      ` <b>Email:</b> ${user.email}\n` +
      ` <b>Account Type:</b> ${user.accountType}\n` +
      ` <b>Phone:</b> ${user.phone || 'Not provided'}\n` +
      ` <b>Company:</b> ${user.company || 'Not provided'}\n\n` +
      ` <b>Registered:</b> ${new Date(user.createdAt).toLocaleString()}`;

    return await this.sendToAdmins(message);
  }

  async notifyProductOutOfStock(product) {
    if (!this.adminIds.length || !this.botToken) return;

    const unitLabel = product.unit || (product.type === 'land' ? 'plots' : 'units');
    const message = ` <b>🛑 PRODUCT OUT OF STOCK</b>\n\n` +
      ` <b>Product:</b> ${product.name}\n` +
      ` <b>Stock level:</b> 0 ${unitLabel}\n` +
      ` <b>Status:</b> Sold out / Out of Stock\n` +
      ` <b>Action:</b> Update inventory or remove from storefront if needed.`;

    return await this.sendToAdmins(message);
  }

  async notifyProductLowStock(product, remainingStock, threshold) {
    if (!this.adminIds.length || !this.botToken) return;

    const unitLabel = product.unit || (product.type === 'land' ? 'plots' : 'units');
    const message = ` <b>⚠️ LOW STOCK ALERT</b>\n\n` +
      ` <b>Product:</b> ${product.name}\n` +
      ` <b>Remaining stock:</b> ${remainingStock} ${unitLabel}\n` +
      ` <b>Threshold:</b> ${threshold} ${unitLabel}\n` +
      ` <b>Recommendation:</b> Reorder or adjust storefront visibility.`;

    return await this.sendToAdmins(message);
  }

  async notifyNewTestimonial(testimonial) {
    if (!this.adminIds.length || !this.botToken) return;

    const message = ` <b>NEW TESTIMONIAL SUBMISSION</b>\n\n` +
      ` <b>Name:</b> ${testimonial.name}\n` +
      ` <b>Email:</b> ${testimonial.email}\n` +
      ` <b>Quote:</b> ${testimonial.quote.substring(0, 250)}${testimonial.quote.length > 250 ? '...' : ''}\n\n` +
      ` <b>Status:</b> Pending approval\n\n` +
      `Use /pendingtestimonials in the bot to review pending testimonials.`;

    return await this.sendToAdmins(message);
  }

  async notifyPayment(order, paymentIntent) {
    if (!this.adminIds.length || !this.botToken) {
      console.log('Telegram credentials not configured');
      return;
    }

    const message = this.formatPaymentMessage(order, paymentIntent);
    return await this.sendToAdmins(message, {
      replyMarkup: {
        inline_keyboard: [
          [
            { text: 'View Order', callback_data: `order_${order._id}` },
            { text: 'Confirm Order', callback_data: `confirm_${order._id}` }
          ],
          [
            { text: 'Mark Shipped', callback_data: `ship_${order._id}` }
          ]
        ]
      }
    });
  }

  formatPaymentMessage(order, paystackData) {
    let message = ` <b>PAYMENT RECEIVED</b>\n\n`;
    message += ` <b>Order:</b> ${order.orderNumber}\n`;
    message += ` <b>Customer:</b> ${order.buyer.firstName} ${order.buyer.lastName}\n`;
    message += ` <b>Email:</b> ${order.buyer.email}\n`;
    message += ` <b>Phone:</b> ${order.buyer.phone || 'Not provided'}\n\n`;

    message += ` <b>Items Purchased:</b>\n`;
    order.items.forEach((item, index) => {
      message += `${index + 1}. ${item.product.name}\n`;
      message += `   Quantity: ${item.quantity}  Weight: ${item.weight}kg\n`;
      message += `   Price: ${item.pricePerUnit}/kg  Subtotal: ${item.subtotal.toFixed(2)}\n\n`;
    });

    message += ` <b>Payment Details:</b>\n`;
    message += `Subtotal: ${order.subtotal.toFixed(2)}\n`;
    message += `Shipping: ${order.shippingCost.toFixed(2)}\n`;
    message += `Tax: ${order.tax.toFixed(2)}\n`;
    message += `<b>Total Paid: ${order.total.toFixed(2)}</b>\n`;
    message += ` <b>Payment Reference:</b> ${paystackData.reference}\n`;
    message += ` <b>Transaction ID:</b> ${paystackData.id}\n\n`;

    message += ` <b>Delivery Address:</b>\n`;
    if (order.shippingAddress) {
      message += `${order.shippingAddress.addressLine || ''}\n`;
      message += `${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''}\n`;
      message += `${order.shippingAddress.country || ''} ${order.shippingAddress.postalCode || ''}\n`;
    }

    if (order.buyer.address) {
      message += `\n <b>Billing Address:</b>\n`;
      message += `${order.buyer.address.addressLine || ''}\n`;
      message += `${order.buyer.address.city || ''}, ${order.buyer.address.state || ''}\n`;
      message += `${order.buyer.address.country || ''} ${order.buyer.address.postalCode || ''}\n`;
    }

    message += `\n <b>Payment Status:</b> COMPLETED\n`;
    message += ` <b>Payment Method:</b> ${paystackData.channel || 'Card'}\n`;
    message += ` <b>Payment Date:</b> ${new Date(paystackData.created_at || order.createdAt).toLocaleString()}`;

    return message;
  }

  async notifyPaymentFailure(order, paymentData, failureReason) {
    if (!this.adminIds.length || !this.botToken) {
      console.log('Telegram credentials not configured');
      return;
    }

    const message = this.formatPaymentFailureMessage(order, paymentData, failureReason);
    return await this.sendToAdmins(message, {
      replyMarkup: {
        inline_keyboard: [
          [
            { text: 'View Order', callback_data: `order_${order._id}` },
            { text: 'Retry Payment', callback_data: `retry_${order._id}` }
          ],
          [
            { text: 'Cancel Order', callback_data: `cancel_${order._id}` }
          ]
        ]
      }
    });
  }

  formatPaymentFailureMessage(order, paystackData, failureReason) {
    let message = ` <b>⚠️ PAYMENT FAILED</b>\n\n`;
    message += ` <b>Order:</b> ${order.orderNumber}\n`;
    message += ` <b>Customer:</b> ${order.buyer.firstName} ${order.buyer.lastName}\n`;
    message += ` <b>Email:</b> ${order.buyer.email}\n`;
    message += ` <b>Phone:</b> ${order.buyer.phone || 'Not provided'}\n\n`;

    message += ` <b>Items in Order:</b>\n`;
    order.items.forEach((item, index) => {
      message += `${index + 1}. ${item.product.name}\n`;
      message += `   Quantity: ${item.quantity}  Weight: ${item.weight}kg\n`;
      message += `   Price: ${item.pricePerUnit}/kg  Subtotal: ${item.subtotal.toFixed(2)}\n\n`;
    });

    message += ` <b>Order Amount:</b>\n`;
    message += `Subtotal: ${order.subtotal.toFixed(2)}\n`;
    message += `Shipping: ${order.shippingCost.toFixed(2)}\n`;
    message += `Tax: ${order.tax.toFixed(2)}\n`;
    message += `<b>Total: ${order.total.toFixed(2)}</b>\n\n`;

    message += ` <b>Failure Details:</b>\n`;
    message += ` Reason: ${failureReason || 'Payment declined'}\n`;
    message += ` Reference: ${paystackData?.reference || 'N/A'}\n`;
    message += ` Status: FAILED\n`;
    message += ` Date: ${new Date(paystackData?.created_at || order.createdAt).toLocaleString()}\n`;

    message += ` <b>⚠️ ACTION REQUIRED:</b> Customer needs to retry payment or contact support`;

    return message;
  }
}

module.exports = new TelegramNotifier();

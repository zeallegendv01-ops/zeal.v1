const axios = require('axios');

const WHATSAPP_API_URL = 'https://graph.instagram.com/v18.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

// Send WhatsApp message
async function sendMessage(recipientPhone, messageText) {
  try {
    if (!recipientPhone || !messageText) {
      console.warn('WhatsApp: Missing phone or message');
      return null;
    }

    // Clean phone number (remove formatting)
    const cleanPhone = recipientPhone.replace(/\D/g, '');

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          body: messageText
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ WhatsApp message sent to ${recipientPhone}`);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.warn(`⚠️ Failed to send WhatsApp message to ${recipientPhone}: ${errorMsg}`);
    // Don't throw - just log and continue
    return null;
  }
}

// Notify payment success to customer
async function notifyPaymentSuccess(order) {
  try {
    const buyer = order.buyer;
    const phone = buyer.phone;

    if (!phone) {
      console.warn('WhatsApp: No phone number for buyer');
      return;
    }

    const message = formatPaymentSuccessMessage(order);
    await sendMessage(phone, message);
  } catch (error) {
    console.error('Error sending payment success notification:', error.message);
  }
}

// Notify payment failure to customer
async function notifyPaymentFailure(order, failureReason) {
  try {
    const buyer = order.buyer;
    const phone = buyer.phone;

    if (!phone) {
      console.warn('WhatsApp: No phone number for buyer');
      return;
    }

    const message = formatPaymentFailureMessage(order, failureReason);
    await sendMessage(phone, message);
  } catch (error) {
    console.error('Error sending payment failure notification:', error.message);
  }
}

// Format payment success message
function formatPaymentSuccessMessage(order) {
  const formattedDate = new Date(order.createdAt).toLocaleDateString('en-NG', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const itemsList = order.items
    .map(item => `• ${item.product?.name || 'Product'} x${item.quantity}`)
    .join('\n');

  return `✅ *PAYMENT SUCCESSFUL*

Hello ${order.buyer.firstName},

Your payment has been confirmed! 🎉

*Order Summary:*
Reference: ${order.metadata?.paystackReference || order._id}
Date: ${formattedDate}

*Items:*
${itemsList}

*Amount Breakdown:*
Subtotal: ₦${order.subtotal?.toFixed(2) || '0.00'}
Shipping: ₦${order.shippingCost?.toFixed(2) || '0.00'}
Tax: ₦${order.tax?.toFixed(2) || '0.00'}
─────────────────
*Total: ₦${order.total?.toFixed(2) || '0.00'}*

*Delivery Address:*
${formatAddress(order.shippingAddress)}

We're processing your order and will send you a tracking number soon. 

Thank you for shopping with 365extra! 🌾

Questions? Reply to this message or visit our website.`;
}

// Format payment failure message
function formatPaymentFailureMessage(order, failureReason) {
  return `❌ *PAYMENT FAILED*

Hello ${order.buyer.firstName},

Unfortunately, your payment could not be processed. 

*Reason:* ${failureReason || 'Payment declined'}

*Order Reference:* ${order.metadata?.paystackReference || order._id}

Please try again or use a different payment method. If you continue to experience issues, please contact our support team.

We're here to help! 💬`;
}

// Format address
function formatAddress(address) {
  if (!address) return 'Not provided';
  
  const parts = [
    address.street || address.addressLine,
    address.city,
    address.state,
    address.postalCode || address.zipCode,
    address.country
  ].filter(Boolean);

  return parts.join(', ');
}

module.exports = {
  sendMessage,
  notifyPaymentSuccess,
  notifyPaymentFailure
};


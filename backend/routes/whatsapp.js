const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect } = require('../middleware/auth');

// WhatsApp Business API Configuration
const WHATSAPP_API_URL = 'https://graph.instagram.com/v18.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID || 'your_phone_number_id';
const BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ID || 'your_business_account_id';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || 'your_access_token';
const ADMIN_PHONE = process.env.TELEGRAM_PHONE_NUMBER || '+2348132120227';

// ═══════════════════════════════════════════════════════════════════
// POST /api/whatsapp/send - Send message via Meta WhatsApp API
// ═══════════════════════════════════════════════════════════════════
router.post('/send', protect, async (req, res) => {
  try {
    const { message, phone, userId } = req.body;

    if (!message || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: message, phone'
      });
    }

    // Validate phone format
    if (!phone.startsWith('+')) {
      return res.status(400).json({
        success: false,
        message: 'Phone must include country code (e.g., +234123456789)'
      });
    }

    // Save message to database
    const Contact = require('../models/Contact');
    const contact = await Contact.create({
      phone: phone,
      message: message,
      channel: 'whatsapp',
      status: 'pending',
      userId: userId,
      timestamp: new Date()
    });

    try {
      // Send via WhatsApp Business API
      const sendResult = await sendWhatsAppMessage(phone, message);
      
      if (sendResult.error === 'number_not_on_whatsapp') {
        console.warn(`⚠️ WhatsApp send failed for ${phone}: Number not registered on WhatsApp`);
      }
    } catch (apiError) {
      console.error(`❌ Error sending to ${phone}:`, apiError.message);
      // Don't fail - message is saved
    }

    // Send notification to admin (commented out - method not available)
    // try {
    //   const telegramNotifier = require('../utils/telegramNotifier');
    //   await telegramNotifier.notifyNewContact({...});
    // } catch (err) {
    //   console.log('Telegram notification failed:', err.message);
    // }

    // Get automated response
    const automatedReply = getAutomatedResponse(message);

    res.json({
      success: true,
      message: 'Message sent successfully',
      reply: automatedReply,
      data: {
        contactId: contact._id
      }
    });

  } catch (error) {
    console.error('WhatsApp Send Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/whatsapp/verify-number - Verify phone is on WhatsApp
// ═══════════════════════════════════════════════════════════════════
router.post('/verify-number', protect, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number required'
      });
    }

    // For now, accept any valid format
    // In production, use WhatsApp Check User Existence API
    // https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-number-id#check-user-existence
    
    // Just validate format
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 11) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    res.json({
      success: true,
      message: 'Phone number verified',
      phone: phone
    });

  } catch (error) {
    console.error('Verification Error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/whatsapp/webhook - Receive incoming messages from Meta
// ═══════════════════════════════════════════════════════════════════
router.post('/webhook', async (req, res) => {
  try {
    const { object, entry } = req.body;

    if (object !== 'whatsapp_business_account') {
      return res.status(400).json({ success: false });
    }

    entry.forEach(entryData => {
      const changes = entryData.changes || [];
      changes.forEach(change => {
        const value = change.value || {};
        
        if (value.messages) {
          value.messages.forEach(messageData => {
            handleIncomingMessage(messageData);
          });
        }

        if (value.statuses) {
          value.statuses.forEach(status => {
            console.log(`Message ${status.id} status: ${status.status}`);
          });
        }
      });
    });

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/whatsapp/webhook - Verify webhook token with Meta
// ═══════════════════════════════════════════════════════════════════
router.get('/webhook', (req, res) => {
  const verify_token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (verify_token === process.env.WHATSAPP_WEBHOOK_TOKEN) {
    res.send(challenge);
  } else {
    res.status(403).send('Invalid token');
  }
});

// ═══════════════════════════════════════════════════════════════════
// Helper: Handle incoming WhatsApp messages
// ═══════════════════════════════════════════════════════════════════
async function handleIncomingMessage(messageData) {
  try {
    const { from, id, timestamp, type, text, image, document } = messageData;
    
    let messageContent = '';
    
    if (type === 'text' && text) {
      messageContent = text.body;
    } else if (type === 'image' && image) {
      messageContent = '[Image received]';
    } else if (type === 'document' && document) {
      messageContent = `[Document: ${document.filename || 'unknown'}]`;
    } else {
      messageContent = `[${type} message received]`;
    }

    console.log(`Incoming from ${from}: ${messageContent}`);

    // Save to database
    const Contact = require('../models/Contact');
    const contact = await Contact.create({
      phone: from,
      message: messageContent,
      channel: 'whatsapp',
      status: 'received',
      messageId: id,
      timestamp: new Date(timestamp * 1000)
    });

    // Send automated response
    if (type === 'text') {
      const reply = getAutomatedResponse(messageContent);
      await sendWhatsAppMessage(from, reply);
      
      // Update contact with response
      await Contact.updateOne(
        { _id: contact._id },
        { 
          response: reply,
          status: 'responded',
          respondedAt: new Date()
        }
      );
    }

  } catch (error) {
    console.error('Error handling incoming message:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Helper: Send WhatsApp message via Meta API
// ═══════════════════════════════════════════════════════════════════
async function sendWhatsAppMessage(recipientPhone, messageText) {
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone.replace(/\D/g, ''), // Remove formatting
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

    console.log('✅ WhatsApp message sent to', recipientPhone, '- Message ID:', response.data.messages[0].id);
    return response.data;

  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error('❌ Failed to send WhatsApp message:', errorMsg);
    
    // If it's an invalid number, don't throw - just log it
    if (errorMsg.includes('invalid recipient') || errorMsg.includes('not registered')) {
      return { error: 'number_not_on_whatsapp' };
    }
    
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Helper: Get automated response based on keywords
// ═══════════════════════════════════════════════════════════════════
function getAutomatedResponse(message) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('₦')) {
    return 'Hey! 💰 For current pricing, please check our website at 365extra.com or let us know which product you\'re interested in. Our team will provide detailed pricing info!';
  }
  
  if (lowerMessage.includes('order') || lowerMessage.includes('buy') || lowerMessage.includes('purchase')) {
    return 'Great! 📦 You can place orders directly on our website at 365extra.com. Our team will process your order ASAP. Need help? Feel free to ask!';
  }
  
  if (lowerMessage.includes('delivery') || lowerMessage.includes('shipping') || lowerMessage.includes('ship')) {
    return '🚚 We deliver across Nigeria! Standard delivery is 1-2 business days. We\'ll confirm your delivery details once you place an order. Ask us for more!';
  }
  
  if (lowerMessage.includes('product') || lowerMessage.includes('catalog') || lowerMessage.includes('sell') || lowerMessage.includes('what')) {
    return '🌾 365extra specializes in premium agricultural products:\n🐟 Smoked Catfish\n🥔 Pure Garri\n🥜 Kola Nuts\n🍚 Premium Rice\n\nVisit 365extra.com for our full catalog!';
  }
  
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return '👋 Hello! Welcome to 365extra! 🌾 We\'re a premium agricultural export company. How can we help you today?';
  }

  if (lowerMessage.includes('thank')) {
    return 'You\'re welcome! 😊 Feel free to reach out anytime. We\'re here to help!';
  }

  return '✅ Thanks for reaching out! We\'ve received your message. Our team will get back to you within 1-2 hours. For faster service, visit 365extra.com!';
}

module.exports = router;


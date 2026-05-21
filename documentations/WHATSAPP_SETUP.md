# WhatsApp Business API Integration Guide

## Overview
365extra now has a WhatsApp chat bubble for automated customer support. Messages are automatically categorized and responded to based on keyword matching.

## Features
 **Floating WhatsApp Bubble** - Always accessible on the website
 **Automated Responses** - Keyword-based replies
 **Message Storage** - All messages saved to database
 **Admin Notifications** - Telegram alerts for new messages
 **Mobile Friendly** - Fully responsive design

## Setup Instructions

### 1. Get WhatsApp Business API Credentials

1. **Create Meta Business Account**
   - Go to https://business.facebook.com
   - Create a new business account

2. **Set Up WhatsApp Business**
   - Go to https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
   - Click "Get Started"
   - Create a WhatsApp Business App

3. **Get Required Credentials**
   - **Phone Number ID**: From WhatsApp > Settings > Linked Accounts
   - **Business Account ID**: From Settings > Business Account
   - **Access Token**: Generate from Settings > System User > Access Tokens

### 2. Update Environment Variables

Edit `backend/.env` and add your credentials:

```env
WHATSAPP_PHONE_ID=123456789123456789
WHATSAPP_BUSINESS_ID=987654321987654321
WHATSAPP_ACCESS_TOKEN=EAABsxxxxxYourTokenHere
WHATSAPP_WEBHOOK_TOKEN=your_webhook_verify_token
```

### 3. Set Up Webhook (Optional - for receiving messages)

If you want to receive and respond to WhatsApp messages from your users:

1. In Meta Business App > WhatsApp > Configuration
2. Set Webhook URL to: `https://yourdomain.com/api/whatsapp/webhook`
3. Set Verify Token to: `your_webhook_verify_token`

### 4. Message Endpoints

**Send Message (from website)**
```
POST /api/whatsapp/message
Body: {
  "message": "Hello, I'd like to order...",
  "phone": "+2348132120227"
}
```

**Webhook for Receiving Messages** (optional)
```
POST /api/whatsapp/webhook
```

## Features Included

### Automated Response Keywords
- **"price/cost"**  Pricing information response
- **"order/buy"**  Ordering assistance
- **"delivery/shipping"**  Delivery information
- **"product/catalog"**  Product list
- **"hello/hi"**  Welcome message
- **Default**  General inquiry response

### Message Storage
All messages are saved with:
- Sender phone number
- Message content
- Channel (whatsapp)
- Status (pending/received/responded)
- Timestamp

### Admin Notifications
Messages are sent to your Telegram bot:
- New message alert
- Customer phone number
- Message preview

## Frontend Integration

The WhatsApp bubble is automatically included in `365extra.html` with:
- **CSS**: `dist/css/whatsapp.css`
- **JS**: `dist/js/whatsapp.js`

### Customization
Edit `dist/js/whatsapp.js` to change:
- `WHATSAPP_PHONE` - Your business phone
- `WHATSAPP_API_NUMBER` - Bot token

## Database Schema

```javascript
Contact {
  name: String (default: "Guest"),
  email: String,
  phone: String (required),
  message: String (required),
  channel: "whatsapp" | "form" | "telegram" | "email",
  status: "pending" | "received" | "responded" | "resolved",
  response: String,
  respondedAt: Date,
  timestamp: Date (auto)
}
```

## API Routes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/whatsapp/message` | Send message from chat bubble |
| POST | `/api/whatsapp/webhook` | Receive messages from WhatsApp |
| GET | `/api/whatsapp/webhook` | Verify webhook token |

## Testing

1. **Local Testing**: Use tools like Postman to test endpoints
2. **Send Test Message**:
   ```bash
   curl -X POST http://localhost:4000/api/whatsapp/message \
     -H "Content-Type: application/json" \
     -d '{"message":"Hello","phone":"+2348132120227"}'
   ```

3. **Check Responses**: Visit Messages table in MongoDB

## Troubleshooting

**Issue**: Webhook not connecting
- Check WHATSAPP_ACCESS_TOKEN is valid
- Verify webhook URL is publicly accessible
- Check WHATSAPP_WEBHOOK_TOKEN matches Meta settings

**Issue**: Messages not saving
- Verify MongoDB is running
- Check database connection string
- Review server logs

**Issue**: No automated responses
- Check message keywords in `getAutomatedResponse()` function
- Verify API endpoint is accessible

## Future Enhancements

- [ ] Admin dashboard to manage WhatsApp conversations
- [ ] AI-powered response generation
- [ ] Message history and analytics
- [ ] Multi-agent routing
- [ ] Media message support (images, files)
- [ ] Scheduled messages
- [ ] Custom chat flows

## Support

For issues or questions:
1. Check server logs: `npm start`
2. Review MongoDB for message storage
3. Test endpoints with Postman
4. Check Meta Business App debugging tools


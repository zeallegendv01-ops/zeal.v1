# Regular User Bot Access - Setup Guide

## What Changed

Regular Telegram users (non-admins) now see your website when they start the bot instead of an "unauthorized" message.

## How It Works

### Admin Users
```
Admin clicks /start
    ↓
Bot shows: Admin Dashboard menu
    ├─ 📦 Products
    ├─ 👥 Users  
    ├─ 📋 Orders
    └─ 📊 Stats
```

### Regular Users
```
Regular user clicks /start
    ↓
Bot shows: Welcome message + buttons
    ├─ 🌐 Open AgroCrown Website
    └─ 📱 View on Mobile
```

---

## Configuration

### Update Your `.env` File

Add this variable:
```env
WEBSITE_URL=http://localhost:3000
```

Replace with your actual website URL:
- **Local**: `http://localhost:3000`
- **Production**: `https://yourdomain.com`
- **Hosting**: `https://agrocrown.example.com`

### Full .env Example
```env
# Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
ADMIN_TELEGRAM_ID=123456789,987654321
WEBSITE_URL=https://yourdomain.com

# API Configuration
API_BASE_URL=http://localhost:5000/api
JWT_TOKEN=your_jwt_secret_here

# Other settings...
```

---

## Testing

### As Admin
1. Message the bot: `/start`
2. Expected: Admin menu appears

### As Regular User
1. Message the bot: `/start`
2. Expected: Welcome message with 2 buttons
3. Click button: Opens your website in browser

---

## Website Button Behavior

When regular users click the button:
- **Desktop Telegram**: Opens website in default browser
- **Mobile Telegram**: Opens website in mobile browser
- **Web Telegram**: Opens in new tab

---

## Customization

### Change Welcome Message
Edit file: `backend/telegram-bot/bot.js` (around line 172)

```javascript
// Change this text:
'🌾 <b>Welcome to AgroCrown</b>\n\n' +
'Premium Agricultural Exports from West Africa\n\n' +
'Browse our collection of farm-fresh products, view analytics, and place orders on our website.'
```

### Change Button Text
Edit buttons (around line 181):
```javascript
[Markup.button.url('🌐 Open AgroCrown Website', websiteUrl)],
[Markup.button.url('📱 View on Mobile', websiteUrl)]
```

---

## Deployment Steps

1. **Set Website URL in .env**:
   ```env
   WEBSITE_URL=https://yourdomain.com
   ```

2. **Save and restart bot**:
   ```bash
   Ctrl+C (stop current bot)
   node backend/telegram-bot/bot.js
   ```

3. **Test with regular user account**:
   - Message bot `/start`
   - Should see welcome message + buttons

4. **Test with admin account**:
   - Message bot `/start`
   - Should see admin menu

---

## If Website URL is Not Set

If `WEBSITE_URL` is not in `.env`, bot uses default:
```
https://agrocrown.example.com
```

You should definitely set it in `.env` to use your actual URL!

---

## What Users See

### Regular User View:
```
🌾 Welcome to AgroCrown

Premium Agricultural Exports from West Africa

Browse our collection of farm-fresh products, view analytics, 
and place orders on our website.

[🌐 Open AgroCrown Website]
[📱 View on Mobile]
```

Clicking either button opens your website.

---

## Summary

✅ Admins see admin menu  
✅ Regular users see website buttons  
✅ Configurable via `WEBSITE_URL` in `.env`  
✅ Works on desktop, mobile, and web Telegram

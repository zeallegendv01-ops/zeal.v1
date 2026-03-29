# Environment Configuration Guide

## Setup Instructions

### For Multiple Admin Telegram Bot

Edit your `.env` file and update the `ADMIN_TELEGRAM_ID` variable:

#### Option 1: Single Admin (Default)
```env
ADMIN_TELEGRAM_ID=123456789
```
Only one Telegram user (123456789) can use admin commands.

#### Option 2: Multiple Admins (New Feature)
```env
ADMIN_TELEGRAM_ID=123456789,987654321,555666777
```
All three users can use admin commands independently.

#### Option 3: Multiple Admins with Spaces (Also Works)
```env
ADMIN_TELEGRAM_ID=123456789, 987654321, 555666777
```
Spaces are automatically trimmed, so this is the same as Option 2.

---

## Finding Your Telegram ID

### Method 1: Using the Bot
1. Send any message to the bot
2. Check server logs - your ID will be displayed
3. Example log output:
   ```
   New message from user ID: 123456789
   User: Your Name
   Message: /start
   ```

### Method 2: Using IDBot (Online Service)
1. Go to https://t.me/userinfobot
2. Send `/start`
3. Bot replies with your ID
4. Copy the ID

### Method 3: Check Browser Console
If you have web interface:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Send command to bot
4. Look for API calls with `userId` or `from.id`

---

## Example .env File

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
ADMIN_TELEGRAM_ID=123456789,987654321,555666777

# API Configuration
API_BASE_URL=http://localhost:5000/api
JWT_TOKEN=your_jwt_secret_here

# Server Configuration
PORT=5000
MONGODB_URI=mongodb://localhost:27017/agrocrown

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Paystack Configuration
PAYSTACK_SECRET_KEY=your_paystack_secret_key

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

---

## Verify Configuration

After updating `.env`, restart the bot and check for this output:

```
🤖 Telegram Admin Bot is running with optimization enabled...
👥 Authorized Admin IDs: 123456789, 987654321, 555666777
✅ Features: Caching, Rate Limiting, Request Queuing, Connection Pooling
```

✅ If you see `👥 Authorized Admin IDs: ...`, configuration is correct!

---

## Adding New Admin

### Step 1: Find Admin's Telegram ID
Send them this: "Message the bot and I'll get your ID from logs"

### Step 2: Add to .env
```env
# Before
ADMIN_TELEGRAM_ID=123456789,987654321

# After (added 555666777)
ADMIN_TELEGRAM_ID=123456789,987654321,555666777
```

### Step 3: Restart Bot
```bash
# Stop current bot
Ctrl+C

# Restart
node backend/telegram-bot/bot.js
```

### Step 4: Verify in Logs
Check for: `👥 Authorized Admin IDs: 123456789, 987654321, 555666777`

---

## Testing Multiple Admins

### Test as Admin 1
```
Command: /start
Expected: Main menu ✅
Command: /stats
Expected: Dashboard stats ✅
```

### Test as Admin 2
```
Command: /start
Expected: Main menu ✅
Command: /products
Expected: Product list ✅
```

### Test as Regular User
```
Command: /start
Expected: Regular menu (no admin options) ✅
Command: /stats
Expected: Access denied ✅
```

---

## Common Issues & Fixes

### Issue: "Only first admin ID works"
**Fix**: Restart bot after changing .env file

### Issue: "Second admin gets 'Unauthorized'"
**Fix**: 
1. Verify ID is correct (no typos)
2. Restart bot
3. Check logs show all admin IDs

### Issue: "Admins have different menu options"
**Fix**: All admins should have identical access - check bot code for bugs

### Issue: "Can't find my Telegram ID"
**Fix**:
1. Send /start to bot
2. Check server console immediately
3. Look for "from.id:" or "user ID:"
4. Copy exact number

---

## Environment Variables for Analytics

The analytics system uses these environment variables:

```env
# Core Configuration (required)
API_BASE_URL=http://localhost:5000/api
JWT_TOKEN=your_jwt_secret_for_analytics_auth

# Database (required for analytics to work)
MONGODB_URI=mongodb://localhost:27017/agrocrown

# Analytics Routes (auto-enabled, no config needed)
# GET /api/analytics/dashboard   (admin only)
# GET /api/analytics/user        (any logged-in user)
```

---

## Deployment Checklist

- [ ] Set `TELEGRAM_BOT_TOKEN` (get from @BotFather)
- [ ] Set `ADMIN_TELEGRAM_ID` with your ID(s)
- [ ] Set `JWT_TOKEN` to secure random string
- [ ] Set `MONGODB_URI` to your database connection
- [ ] Set `API_BASE_URL` to your backend URL
- [ ] Set `CORS_ORIGIN` to your frontend URL
- [ ] Verify all variables are set: `echo $env:ADMIN_TELEGRAM_ID`
- [ ] Restart bot after any changes
- [ ] Test bot with `/start` command
- [ ] Test admin commands: `/stats`, `/products`, `/users`
- [ ] Test multiple admins if configured

---

## Quick Reference

### Single Admin
```env
ADMIN_TELEGRAM_ID=123456789
```

### Multiple Admins
```env
ADMIN_TELEGRAM_ID=123456789,987654321,555666777
```

### Add/Remove Admin
Edit the comma-separated list, save, restart bot.

### View Current Admins
Check bot startup logs for: `👥 Authorized Admin IDs:`

---

## Support

Need help?
1. Check bot startup logs
2. Verify `.env` file syntax
3. Check exact Telegram ID (no spaces, must be numeric)
4. Restart bot after any changes
5. Check `ANALYTICS_GUIDE.md` for more details

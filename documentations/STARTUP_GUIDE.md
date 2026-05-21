# 365extra Backend Startup Guide

## Initial Setup (First Time Only)

### 1. Install Dependencies
```bash
npm install
cd telegram-bot && npm install && cd ..
```

### 2. Start the Application
The server will automatically create the admin user when it first connects to MongoDB:

```bash
npm start
```

This starts both the server and bot in parallel. **Expected output:**

```
Server running on port 4000
MongoDB connected: <connection_string>
🔗 Database connection ready, initializing admin user...
✅ Admin user created successfully
[Bot] Starting bot, waiting for server to be ready...
[Token Refresh] Attempting to login with: admin@365extra.com
[Token Refresh] Token refreshed successfully
🤖 Bot started successfully!
```

## Manual Startup (If Needed)

You can also start the server and bot separately:

### Start Server Only
```bash
npm run server
```

### Start Bot Only (in another terminal)
```bash
cd telegram-bot
npm start
```

Or run from the backend:
```bash
npm run bot
```

## Troubleshooting

### Bot fails with "Invalid credentials"
- **Ensure the server has fully connected to MongoDB** before the bot tries to authenticate
- Check that the server logs show: "✅ Admin user created successfully"
- Wait for: "[Token Refresh] Token refreshed successfully" in bot output

### Bot gets repeated ECONNREFUSED errors
- The server might not be running - ensure `npm start` is running in your terminal
- The bot will automatically retry (exponential backoff)
- Maximum wait time is about 3-4 minutes with current retry logic

### MongoDB connection timeout errors  
- Verify your `MONGODB_URI` in `.env` is correct
- Check your internet connection (Atlas or local MongoDB access)
- Ensure your IP is whitelisted if using MongoDB Atlas

###  Create admin user manually (if auto-creation fails)
If auto-creation fails, you can manually create it:

```bash
# First, ensure server is running and MongoDB is connected
npm run server

# Then in another terminal, make a registration request:
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Admin",
    "lastName": "User",
    "email": "admin@365extra.com",
    "password": "admin123",
    "accountType": "Distributor",
    "phone": "1234567890"
  }'
```

## Environment Variables

Required in `.env`:
```
PORT=4000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=appname
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
ADMIN_EMAIL=admin@365extra.com
ADMIN_PASSWORD=admin123
TELEGRAM_BOT_TOKEN=<your_token>
ADMIN_TELEGRAM_ID=<your_id>
API_BASE_URL=http://localhost:4000/api
```

## Default Credentials

- **Email**: admin@365extra.com
- **Password**: admin123

⚠️ **IMPORTANT**: Change these in production!



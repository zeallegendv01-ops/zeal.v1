# Analytics & User Dashboard Documentation

## Overview
This document describes the updated analytics system that fixes the hardcoded product issue and adds personalized user dashboards and multiple admin bot support.

## Part 1: Dynamic Analytics (No More Hardcoding)

### Problem Solved
Previously, analytics only showed data for three hardcoded products: Garri, Rice, and Kola. New products added to the system were never reflected in the analytics.

### Solution
All analytics are now **dynamically generated from your database** based on actual product and order data.

### Admin Analytics Endpoint
**GET** `/api/analytics/dashboard` (requires authentication & admin role)

Returns comprehensive analytics with the following structure:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalProducts": 5,
      "totalUsers": 150,
      "totalOrders": 342,
      "completedOrders": 250,
      "pendingOrders": 92,
      "totalRevenue": 5800000,
      "recentOrders": 45,
      "recentRevenue": 1200000
    },
    "products": [
      {
        "name": "Product Name",
        "category": "Category",
        "price": 18000,
        "totalOrders": 120,
        "totalSold": 1200,  // in kg/T
        "revenue": 21600000,
        "color": "#2a4a1e"
      }
      // ... more products
    ],
    "monthly": {
      "labels": ["Jan", "Feb", "Mar", ...],
      "revenue": [120, 145, 180, ...]  // in thousands
    },
    "productVolume": {
      "labels": ["Product A", "Product B", ...],
      "data": [500, 750, ...],
      "colors": ["#b8933a", "#2a4a1e", ...]
    },
    "breakdown": {
      "labels": [...],
      "data": [...],
      "colors": [...]
    }
  }
}
```

### How It Works
1. Fetches all products from database
2. Calculates metrics for EVERY product (not just 3)
3. Computes monthly trends based on actual orders
4. Groups data by product category
5. Generates dynamic colors for new products

### Frontend Implementation
The analytics page now:
- Fetches real data from `/api/analytics/dashboard` when modal opens
- Falls back to demo data if API fails
- Updates charts with actual product sales data
- Updates stats (revenue, volume, orders) in real-time

**Frontend Code (script.js)**:
- `fetchAnalytics()` - Fetches data from API
- `updateChartsWithData()` - Populates charts with real data
- `useDemoChartData()` - Fallback demo data
- `initAnalyticsOnOpen()` - Triggered when Analytics modal opens
- `updateAnalyticsStats()` - Updates display stats

---

## Part 2: User-Specific Analytics & Dashboard

### Problem Solved
Users had no way to see their own transaction history, spending patterns, or purchase preferences.

### Solution
New personal dashboard showing user-specific analytics accessible after login.

### User Analytics Endpoint
**GET** `/api/analytics/user` (requires authentication)

Returns personalized user data:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalOrders": 15,
      "completedOrders": 12,
      "pendingOrders": 3,
      "totalSpent": 450000,
      "todaySpent": 0,
      "weekSpent": 85000
    },
    "daily": {
      "labels": ["1/3", "2/3", "3/3", ...],
      "data": [0, 25000, 15000, ...]  // last 7 days
    },
    "recentTransactions": [
      {
        "id": "order_id",
        "date": "2026-03-19T...",
        "total": 120000,
        "status": "completed",
        "items": [
          {
            "name": "Product Name",
            "quantity": 2,
            "weight": 50,
            "subtotal": 120000
          }
        ]
      }
      // ... more transactions
    ],
    "topProducts": [
      {
        "name": "Product Name",
        "count": 8,     // number of purchases
        "total": 400    // total kg/T purchased
      }
      // ... top 5 products
    ],
    "orderHistory": [...]
  }
}
```

### User Dashboard UI
Accessed by clicking the "Register/Login" button when already logged in.

**Displays**:
1. **Summary Cards**
   - Total orders placed
   - Total amount spent
   - This week's spending
   - Today's spending

2. **Recent Transactions**
   - Date of transaction
   - Products ordered
   - Total amount & status

3. **Top Products**
   - Most frequently purchased items
   - Total quantity purchased of each

4. **Logout Button**
   - Secure logout from dashboard

### Frontend Implementation
**JavaScript Functions (script.js)**:
- `loadUserAnalytics()` - Fetches user data from `/api/analytics/user`
- `displayUserAnalytics(data)` - Renders dashboard with real data
- `handleAuthButtonClick()` - Opens dashboard for logged-in users

**HTML**:
- New modal `dashboardModal` with dashboard layout
- Dynamic content population via JavaScript

---

## Part 3: Multiple Admin Bots

### Problem Solved
Only one person (single ADMIN_ID) could manage the Telegram bot. Multiple admins couldn't share responsibilities.

### Solution
Support for **multiple admin Telegram IDs** who can all manage products and orders.

### Setup

#### Environment Variable Configuration
In your `.env` file, configure multiple admin IDs:

```
# Single admin (old format still works)
ADMIN_TELEGRAM_ID=123456789

# Multiple admins (comma-separated)
ADMIN_TELEGRAM_ID=123456789,987654321,555666777

# With spaces (spaces are trimmed)
ADMIN_TELEGRAM_ID=123456789, 987654321, 555666777
```

#### Finding Your Telegram ID
1. Message the bot `/start`
2. Check server logs for your user ID
3. Add to the comma-separated list

### Implementation Details
**Backend Changes (bot.js)**:
- `ADMIN_IDS` - Array of authorized admin IDs (replaces single `ADMIN_ID`)
- `isAdmin(ctx)` - Updated to check if user ID is in `ADMIN_IDS` array
- Boot logs now show all authorized admin IDs

**Behavior**:
- ALL admins have full access to:
  - `/products` - View/manage all products
  - `/stats` - View dashboard statistics
  - `/users` - View all users
  - `/orders` - View all orders
  - `/addproduct`, `/editproduct`, `/deleteproduct`
  - All other admin commands

### Example
```env
# .env file
ADMIN_TELEGRAM_ID=123456789,987654321,555666777
```

Then any of these three users can:
```
/start                    → Main menu
/products                 → Product management
/addproduct              → Add new product
/stats                   → View analytics
/users                   → View all users
/orders                  → View all orders
```

**Server Output**:
```
👥 Authorized Admin IDs: 123456789, 987654321, 555666777
```

---

## Implementation Summary

### Files Created
1. **`backend/controllers/analyticsController.js`** - Analytics logic for both admin and user data
2. **`backend/routes/analytics.js`** - API routes for analytics endpoints

### Files Modified
1. **`backend/server.js`** - Added analytics routes
2. **`backend/telegram-bot/bot.js`** - Multiple admin support
3. **`dist/js/script.js`** - Dynamic analytics fetching & user dashboard
4. **`agrocrown.html`** - User dashboard modal & dynamic stat elements

### Database Usage
The system automatically calculates analytics from existing data:
- **Products collection** - All products listed
- **Orders collection** - Revenue, volume, demand trends
- **Users collection** - User counts

No schema changes required - works with existing data!

---

## Testing Analytics

### Admin Analytics
1. Click "Analytics" button in navbar
2. View charts that show data for ALL your products
3. Switch tabs: Revenue, Export Volume, Seasonal Demand, Product Mix
4. Stats update based on current database

### User Dashboard
1. Create an account or login
2. Click "Register/Login" button (when logged in)
3. View your personal transaction history
4. See your spending this week/today
5. Check your most-purchased products

### Multiple Admin Bot
1. Set `ADMIN_TELEGRAM_ID` with multiple IDs in `.env`
2. Restart bot
3. Check logs for authorized admins
4. Each admin can use all `/` commands

---

## API Reference

### Dashboard Analytics
```
GET /api/analytics/dashboard
Authorization: Bearer {JWT_TOKEN}
Role: Admin

Response: Complete analytics for all products
```

### User Analytics  
```
GET /api/analytics/user
Authorization: Bearer {JWT_TOKEN}

Response: Personal transaction analytics for logged-in user
```

---

## Troubleshooting

### Analytics Shows No Data
1. Check if products exist in database
2. Check if orders exist in database
3. Verify API endpoint is accessible
4. Check browser console for errors

### User Dashboard Won't Load
1. Verify user is authenticated
2. Check token is valid
3. Check user has orders
4. See browser console for error details

### Multiple Admin IDs Not Working
1. Verify comma-separated format: `ID1,ID2,ID3`
2. No spaces before IDs (spaces after are OK)
3. Restart bot after changing `.env`
4. Check bot logs for "Authorized Admin IDs"

---

## Future Enhancements
- Daily/weekly analytics reports emailed to admins
- Advanced filtering by date range
- Export analytics as PDF/CSV
- Predictive analytics for demand forecasting
- Product comparison charts
- Customer segmentation analysis

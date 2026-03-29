# AgroCrown Telegram Admin Bot

A Telegram bot dashboard for managing AgroCrown products, orders, and users with full CRUD functionality and real-time notifications.

## Features

- **Product Management**
  - View all products
  - Create new products (step-by-step form)
  - Update product details
  - Delete products
  - Search products

- **Order Management**
  - View all orders with status
  - Filter pending orders only
  - Update order status with buttons
  - View order details and totals
  - **NEW:** Real-time order notifications
  - **NEW:** Inline order management buttons

- **User Management**
  - View all registered users
  - User details (name, email, account type)
  - Filter by account type
  - **NEW:** New user registration notifications

- **Dashboard Statistics**
  - Total products count
  - Total orders count
  - Pending orders count
  - Total revenue calculation
  - Real-time stats refresh

- **Real-time Notifications**
  - Instant notifications for new orders
  - New user registration alerts
  - Order status update notifications
  - Formatted messages with order details
  - Interactive buttons for quick actions

## Setup

### 1. Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Start the bot and use `/newbot` to create a new bot
3. Copy the **API Token** (you'll need this)
4. Get your **Chat ID**: Search `@userinfobot`, start it, and note your ID

### 2. Install Dependencies

```bash
cd backend/telegram-bot
npm install
```

### 3. Configure Environment

Create `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
ADMIN_TELEGRAM_ID=your_telegram_user_id
API_BASE_URL=http://localhost:5000/api
JWT_TOKEN=your_backend_jwt_token
NODE_ENV=development
```

### 4. Run the Bot

```bash
npm run dev
```

## Real-time Notifications

### New Order Notifications

When a customer places an order, you'll receive an instant notification with:

- Complete order details (order number, customer info, items)
- Itemized breakdown with quantities and prices
- Shipping address
- Total amounts
- Interactive buttons for quick actions:
  - View Details
  - Confirm Order
  - Mark as Shipped
  - Cancel Order

### New User Registrations

When a new user registers, you'll get notified with:

- User name and email
- Account type (Buyer, Distributor, etc.)
- Registration date
- Contact information

### Order Status Updates

When order status changes (either via bot or website), you'll be notified:

- Order number and customer
- Old status → New status
- Update timestamp

## Usage

### Commands

- `/start` - Open admin dashboard

### Main Menu Options

1. **Products** - Manage all products
   - View all products with details
   - Create new product (step-by-step form)
   - View product details
   - Edit product information
   - Delete products

2. **Orders** - Manage all orders
   - View all orders with status
   - Filter pending orders only
   - Update order status with dropdown
   - View order details and totals
   - **NEW:** Click notification buttons to manage orders directly

3. **Users** - View user information
   - List all registered users
   - View user email and account type
   - Search user details

4. **Stats** - Real-time dashboard statistics
   - Total products
   - Total orders
   - Pending orders count
   - Total revenue
   - Refresh stats in real-time

## Notification Examples

### New Order Notification
```
NEW ORDER RECEIVED

Order: ORD-20260316-001
Customer: John Doe
Email: john@example.com
Phone: +1234567890

Items:
1. Artesian Smoked Catfish
   Quantity: 2 × Weight: 10kg
   Price: $45/kg × Subtotal: $900.00

Totals:
Subtotal: $900.00
Shipping: $50.00
Tax: $0.00
Total: $950.00

Shipping Address:
123 Main St
New York, NY
USA 10001

Status: PENDING
Date: 3/16/2026, 2:30:15 PM

[View Details] [Confirm Order]
[Mark Shipped] [Cancel Order]
```

### New User Notification
```
NEW USER REGISTERED

Name: Jane Smith
Email: jane@example.com
Account Type: Distributor
Phone: +1987654321
Company: ABC Corp

Registered: 3/16/2026, 2:25:10 PM
```

## Interactive Order Management

Click the buttons in order notifications to:

- **View Details**: See complete order information
- **Confirm Order**: Change status to confirmed
- **Mark Shipped**: Update to shipped status
- **Cancel Order**: Cancel the order

## API Integration

The bot connects to your AgroCrown backend API:

- Uses JWT authentication
- Handles all CRUD operations
- Real-time data fetching
- Error handling with user-friendly messages
- **NEW:** Automatic notifications for events

## Admin Authentication

Only users with the `ADMIN_TELEGRAM_ID` can access the bot. All other users will receive an "Unauthorized" message.

## Dependencies

- **telegraf**: Telegram bot framework
- **axios**: HTTP client for API calls
- **dotenv**: Environment variable management

## Notes

- Make sure your backend API is running before starting the bot
- The JWT token should have admin privileges
- All operations are logged in the console
- Context is stored temporarily for multi-step operations
- **NEW:** Notifications are sent even if the bot is not actively being used

## Future Enhancements

- Category filtering for products
- Advanced search/filtering
- Batch operations
- Analytics graphs
- Payment status updates
- Inventory alerts
- Bulk imports

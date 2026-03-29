# AgroCrown - Premium Agricultural Export Platform

A comprehensive full-stack platform for managing premium agricultural exports from West Africa. Features a responsive frontend, Node.js/Express backend with MongoDB, and a Telegram admin dashboard.

## Project Structure

```
AgroCrown/
├── agrocrown (3).html          # Main frontend HTML
├── dist/
│   ├── css/style.css          # Styling
│   ├── js/
│   │   ├── api.js             # API service client
│   │   └── script.js          # Frontend logic
│   └── vid/                   # Video assets
├── backend/
│   ├── server.js              # Express server
│   ├── package.json
│   ├── config/
│   │   └── database.js        # MongoDB connection
│   ├── models/
│   │   ├── User.js            # User schema
│   │   ├── Product.js         # Product schema
│   │   └── Order.js           # Order schema
│   ├── controllers/
│   │   ├── authController.js  # Auth logic
│   │   ├── productController.js
│   │   └── orderController.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── products.js
│   │   └── orders.js
│   ├── middleware/
│   │   ├── auth.js            # JWT verification
│   │   └── errorHandler.js
│   └── telegram-bot/
│       ├── bot.js             # Telegram bot
│       ├── package.json
│       └── README.md
└── README.md                   # This file
```

## Quick Start

### Prerequisites

- Node.js (v14+)
- MongoDB (running locally or remote URI)
- Paystack account and API keys
- Telegram Bot Token (from @BotFather)
- npm or yarn

### 1. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/agrocrown
JWT_SECRET=your_super_secret_key_change_in_production
JWT_EXPIRE=7d
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

Start the backend:

```bash
npm run dev
```

Backend API runs on `http://localhost:5000`

### 2. Paystack Payment Setup

1. Create a Paystack account at [paystack.com](https://paystack.com)
2. Get your API keys from the Paystack dashboard
3. Set up webhook endpoint for payment confirmations: `https://yourdomain.com/api/payments/webhook`

### 3. Telegram Bot Setup

```bash
cd backend/telegram-bot
npm install
```

Create `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
ADMIN_TELEGRAM_ID=your_telegram_id
API_BASE_URL=http://localhost:5000/api
JWT_TOKEN=your_jwt_token
NODE_ENV=development
```

Start the bot:

```bash
npm run dev
```

### 4. Frontend

Open `agrocrown (3).html` in your browser or serve it via a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js http-server
npx http-server
```

Access at `http://localhost:8000`

## Features

### Frontend (HTML/CSS/JavaScript)

- Responsive design with mobile support
- Product browsing and search
- Shopping cart with dynamic pricing
- **NEW:** Secure payment processing with Paystack
- User authentication (login/register)
- Order placement with payment confirmation
- Analytics dashboard with charts
- Testimonials section
- Contact form
- Smooth scroll animations

### Backend API

**Authentication**
- User registration with email validation
- JWT-based login
- Password hashing with bcryptjs
- Profile management

**Product Management**
- Create products with full details
- Read all products with filtering
- Update product information
- Delete products
- Supplier-specific product management

**Order System**
- Create orders from cart
- Calculate totals with weight-based pricing
- **NEW:** Secure payment processing with Paystack
- Track order status (pending to confirmed to shipped to delivered)
- View order history
- Update payment status
- **NEW:** Payment notifications with customer details

**User Management**
- Multiple account types (Buyer, Distributor, Wholesaler, Producer)
- User profile management
- Email validation
- Account verification

### Telegram Admin Bot

**Complete CRUD Dashboard with Real-time Notifications**

**Products**
- View all products
- Create new products (step-by-step form)
- Update product details
- Delete products
- Search functionality

**Orders**
- View all orders with status
- Filter pending orders
- Update order status with buttons
- View order details and totals
- **NEW:** Real-time order notifications
- **NEW:** Interactive order management buttons

**Users**
- View all registered users
- User details (name, email, account type)
- Filter by account type
- **NEW:** New user registration notifications

**Dashboard Stats**
- Total products count
- Total orders count
- Pending orders
- Total revenue calculation
- Real-time refresh

**Real-time Notifications**
- Instant notifications for new orders
- New user registration alerts
- Order status update notifications
- Formatted messages with order details
- Interactive buttons for quick actions

## API Endpoints

### Authentication
```
POST   /api/auth/register          Register new user
POST   /api/auth/login             Login user
GET    /api/auth/me                Get current user (protected)
PUT    /api/auth/profile           Update profile (protected)
```

### Products
```
GET    /api/products               Get all products
GET    /api/products/:id           Get product by ID
POST   /api/products               Create product (protected)
PUT    /api/products/:id           Update product (protected)
DELETE /api/products/:id           Delete product (protected)
GET    /api/products/supplier/products    Get user's products (protected)
```

### Orders
```
POST   /api/orders                 Create order (protected)
GET    /api/orders                 Get user's orders (protected)
GET    /api/orders/:id             Get order by ID (protected)
PUT    /api/orders/:id             Update order status (protected)
GET    /api/orders/all             Get all orders (protected)
```

### Payments
```
POST   /api/payments/initialize          Initialize Paystack payment (protected)
GET    /api/payments/verify/:reference   Verify payment status (protected)
POST   /api/payments/webhook             Paystack webhook handler
```

## Database Models

### User Schema
```javascript
{
  firstName, lastName, email, password,
  accountType: ['Buyer', 'Distributor', 'Wholesaler', 'Producer'],
  phone, address, company, taxId,
  isVerified, createdAt, updatedAt
}
```

### Product Schema
```javascript
{
  name, description, pricePerKg, category,
  origin, image, quantity, unit,
  certification: { organic, fair_trade, iso },
  minOrder, maxOrder, supplier,
  status: ['active', 'inactive', 'discontinued'],
  tags, createdAt, updatedAt
}
```

### Order Schema
```javascript
{
  orderNumber, buyer,
  items: [{ product, quantity, weight, pricePerUnit, subtotal }],
  shippingAddress,
  status: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
  subtotal, shippingCost, tax, total,
  paymentStatus: ['pending', 'completed', 'failed', 'refunded'],
  notes, createdAt, updatedAt
}
```

## Security Features

- **Password Hashing**: bcryptjs with 10 salt rounds
- **JWT Authentication**: Secure token-based auth
- **Protected Routes**: Middleware-based access control
- **Input Validation**: Express-validator integration
- **Error Handling**: Centralized error middleware
- **CORS**: Cross-origin request handling
- **Admin-Only Bot**: Telegram bot restricted to admin ID

## Tech Stack

### Frontend
- HTML5
- CSS3 (custom styling)
- Vanilla JavaScript (ES5+)
- Chart.js (analytics)
- Font Awesome (icons)

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose ODM
- **Authentication**: JWT + bcryptjs
- **Payment Processing**: Paystack API
- **Admin Dashboard**: Telegraf (Telegram Bot)
- **HTTP Client**: Axios
- **Validation**: Express-validator

### Tools & Dependencies
- dotenv (environment variables)
- cors (cross-origin handling)
- multer (file uploads - ready)
- nodemon (development auto-reload)

## Installation & Running

### All Components

1. **Terminal 1 - Backend API**
```bash
cd backend
npm install
npm run dev
```

2. **Terminal 2 - Telegram Bot**
```bash
cd backend/telegram-bot
npm install
npm run dev
```

3. **Terminal 3 - Frontend**
```bash
# Serve the HTML file
npx http-server
# or use python
python -m http.server 8000
```

4. **Open Browser**
```
http://localhost:8000/agrocrown%20(3).html
```

5. **Telegram**
Open Telegram and search for your bot, then use `/start`

## Workflow

### Customer Journey
1. Register/Login on website
2. Browse products
3. Select weight using slider (price updates dynamically)
4. Add items to cart
5. Review order in cart modal
6. Click "Proceed to Checkout"
7. **NEW:** Redirected to secure Paystack payment page
8. **NEW:** Complete payment on Paystack's hosted page
9. **NEW:** Automatically redirected back and order confirmed
10. **NEW:** Admin receives payment notification with all details
11. Order saved to MongoDB with payment status
12. **NEW:** Admin receives instant Telegram notification

### Admin Workflow
1. Open Telegram bot with `/start`
2. Select menu option (Products, Orders, Users, Stats)
3. Perform CRUD operations via inline buttons and forms
4. View real-time statistics
5. Manage inventory and orders
6. **NEW:** Receive real-time notifications for new orders and user registrations
7. **NEW:** Use interactive buttons in notifications to manage orders directly

## Dynamic Features

- **Price Calculation**: Weight slider updates total price in real-time
- **Cart Management**: Distinct item count, dynamic weight-based pricing
- **Real-time Stats**: Dashboard refreshes order and revenue data
- **Search Filtering**: Product and global search with live filtering
- **Mobile Responsive**: Works on all screen sizes
- **Real-time Notifications**: Instant Telegram alerts for new orders and users
- **Interactive Order Management**: Click buttons in notifications to manage orders
- **Secure Payment Processing**: Paystack integration with payment confirmation
- **Payment Notifications**: Detailed payment alerts with customer and order info

## Error Handling

- API errors with user-friendly messages
- Validation errors for all inputs
- Network error handling with retry logic
- Database error handling with logging
- Graceful degradation for missing features

## Environment Variables

**Backend (.env)**
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/agrocrown
JWT_SECRET=your_secret
JWT_EXPIRE=7d
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Paystack Payment Configuration
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
FRONTEND_URL=http://localhost:8000
```

**Telegram Bot (.env)**
```
TELEGRAM_BOT_TOKEN=your_token
ADMIN_TELEGRAM_ID=your_id
API_BASE_URL=http://localhost:5000/api
JWT_TOKEN=your_jwt_token
NODE_ENV=development
```

## Future Enhancements

- [x] Real-time order notifications (implemented)
- [x] New user registration notifications (implemented)
- [x] Interactive order management buttons (implemented)
- [x] Payment gateway integration (implemented with Paystack)
- [ ] Email verification system
- [ ] Cloud image upload (AWS S3)
- [ ] Advanced analytics with graphs
- [ ] Inventory alerts and notifications
- [ ] Bulk operations for products
- [ ] Supplier dashboard
- [ ] Review and rating system
- [ ] Invoice generation
- [ ] Multiple language support
- [ ] Push notifications
- [ ] Advanced search with filters

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT License - feel free to use this project

## Support

For issues or questions:
- Check the documentation in each folder's README.md
- Review API endpoints documentation
- Check error messages in the console

## Get Started

Everything is ready to use! Follow the Quick Start section above to get your AgroCrown platform running.

---

**Built for Premium Agricultural Exports**

**BOTCOMMANDS**

/products
/addproduct
/users
/orders
/pendingorders
/completedorders
/order 507f1f77bcf86cd799439011
/stats
/editproduct "Rice Premium"
/editproduct "Organic Tomatoes"
/deleteproduct "Fresh Maize"
/user john@example.com
/user admin@agrocrown.com

MongoDB - password: msZwytn0hLpX0DkN
MongoDB - username: jamessubtle3_db_user
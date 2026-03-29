# AgroCrown Backend

Node.js/Express backend API for AgroCrown agricultural export platform.

## Features

- **User Authentication**: JWT-based authentication with registration and login
- **Product Management**: Create, read, update, delete products
- **Order Management**: Place and track orders
- **MongoDB Integration**: Using Mongoose ODM
- **Input Validation**: Express-validator integration
- **Error Handling**: Centralized error handling middleware
- **CORS**: Cross-origin request handling

## Installation

1. Navigate to backend folder:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/agrocrown
JWT_SECRET=your_secure_secret_key
JWT_EXPIRE=7d
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

## Running the Server

### Development (with auto-reload):
```bash
npm run dev
```

### Production:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)
- `PUT /api/auth/profile` - Update profile (protected)

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product (protected)
- `PUT /api/products/:id` - Update product (protected)
- `DELETE /api/products/:id` - Delete product (protected)
- `GET /api/products/supplier/products` - Get user's products (protected)

### Orders
- `POST /api/orders` - Create order (protected)
- `GET /api/orders` - Get user's orders (protected)
- `GET /api/orders/:id` - Get order by ID (protected)
- `PUT /api/orders/:id` - Update order status (protected)
- `GET /api/orders/all` - Get all orders (protected)

## Database Models

### User
- firstName, lastName, email, password
- accountType (Buyer, Distributor, Wholesaler, Producer)
- phone, address, company, taxId
- isVerified, timestamps

### Product
- name, description, pricePerKg, category
- origin, image, quantity, unit
- certification (organic, fair_trade, iso)
- minOrder, maxOrder
- supplier (reference to User)
- status, tags, timestamps

### Order
- orderNumber (unique)
- buyer (reference to User)
- items (product, quantity, weight, price)
- shippingAddress
- status, subtotal, shippingCost, tax, total
- paymentStatus, notes, timestamps

## Security Features

- Password hashing with bcryptjs
- JWT token-based authentication
- Protected routes with auth middleware
- Input validation and sanitization
- Error handling and logging

## Dependencies

- **express**: Web framework
- **mongoose**: MongoDB ODM
- **jsonwebtoken**: JWT authentication
- **bcryptjs**: Password hashing
- **cors**: Cross-origin handling
- **express-validator**: Input validation
- **dotenv**: Environment variables
- **multer**: File upload handling
- **nodemon**: Development auto-reload

## Future Enhancements

- Email verification
- Payment gateway integration (Paystack)
- Image upload to cloud storage
- Analytics and reporting
- Admin dashboard API
- Real-time notifications
- Rate limiting
- API documentation (Swagger)

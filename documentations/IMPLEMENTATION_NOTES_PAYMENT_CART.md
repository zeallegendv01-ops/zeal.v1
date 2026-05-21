# Payment Flow & Cart Management - Implementation Guide

## Overview
This guide documents the complete implementation of:
1. **Cart clearing on successful payment**
2. **Complete address capture for delivery**
3. **WhatsApp and Email notifications** with address details
4. **Cart management system** with database persistence

---

## Changes Made

### 1. **User Model Enhanced** (`backend/models/User.js`)
Updated the User schema to include:
- **Extended Address Object** with `street` field for complete delivery information
- **Cart Array** for persistent cart storage in the database

```javascript
address: {
  street: String,
  city: String,
  state: String,
  postalCode: String,
  country: String
},
cart: [
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number,
    weight: Number,
    pricePerKg: Number,
    addedAt: { type: Date, default: Date.now }
  }
]
```

### 2. **Order Model Updated** (`backend/models/Order.js`)
Standardized the `shippingAddress` object to match the User model:

```javascript
shippingAddress: {
  street: String,
  city: String,
  state: String,
  postalCode: String,
  country: String
}
```

### 3. **New Cart Controller** (`backend/controllers/cartController.js`)
Created comprehensive cart management functions:
- `addToCart(req, res, next)` - Add or update items in cart
- `getCart(req, res, next)` - Retrieve user's cart
- `updateCartItem(req, res, next)` - Update quantity, weight, price
- `removeFromCart(req, res, next)` - Delete specific item
- `clearCart(req, res, next)` - Clear entire cart
- `getCartCount(req, res, next)` - Get cart item count

### 4. **New Cart Routes** (`backend/routes/cart.js`)
```javascript
POST   /api/cart              - Add item to cart
GET    /api/cart              - Get full cart
GET    /api/cart/count        - Get cart count
PUT    /api/cart/:product     - Update cart item
DELETE /api/cart/item/:product - Remove item
DELETE /api/cart              - Clear entire cart
```

All cart routes require authentication via `protect` middleware.

### 5. **Payment Controller Enhanced** (`backend/controllers/paymentController.js`)

#### A. Address Validation (initializePayment)
Added validation to ensure complete address data before payment:
```javascript
- Validates that shippingAddress is provided
- Checks for required fields: street, city, state, postalCode, country
- Returns 400 error if any field is missing
```

#### B. Cart Clearing on Success (handleWebhook)
After successful payment, the cart is automatically cleared:
```javascript
// Clear cart for buyer after successful payment
await User.findByIdAndUpdate(
  metadata.userId,
  { cart: [] },
  { new: true }
);
```

### 6. **Email Notifications Enhanced** (`backend/utils/emailService.js`)
Updated `sendInvoiceEmail()` to include:
- **Delivery Address Section** with formatted address
- Full street address, city, state, postal code, and country
- Professional formatting for easy reading

### 7. **WhatsApp Notifications Fixed** (`backend/utils/whatsappNotifier.js`)
Updated `formatAddress()` function to:
- Handle both `street` and `addressLine` fields
- Support both `postalCode` and `zipCode` (for backward compatibility)
- Return formatted address string: "Street, City, State, PostalCode, Country"

### 8. **Invoice Generator Updated** (`backend/utils/invoiceGenerator.js`)
Enhanced invoice template to:
- Display full delivery address with proper formatting
- Show address fields: street, city, state, postal code, country
- Include bold "Delivery Address" label for clarity

### 9. **Server Configuration** (`backend/server.js`)
- Added cart routes import
- Registered cart routes at `/api/cart`

---

## Complete Payment & Notification Flow

### On Successful Payment:

1. **Webhook Receives charge.success Event**
   - Validates payment reference
   - Creates order with all items and shipping address
   
2. **Notifications Sent** (All include address):
   - ✅ **Telegram** - Notifies admin of new order
   - ✅ **WhatsApp** - Sends to buyer with formatted address
   - ✅ **Email** - Sends invoice with delivery address section

3. **Post-Notification Actions**:
   - Cart is automatically cleared from database
   - Order status set to "completed"
   - Invoice generated with full details
   - Tracking ready for admin to assign

### On Payment Failure:

1. **Webhook Receives charge.failed Event**
   - Creates failed order record
   - Sends failure notification via WhatsApp
   - Sends failure notification via Email
   - Cart remains intact for retry

---

## Frontend Integration

### Required Changes for Frontend:

#### 1. **Checkout Page - Shipping Address**
Must send complete address object:
```javascript
const checkoutData = {
  items: cartItems,
  shippingAddress: {
    street: "12 Lekki Road",      // REQUIRED - New field
    city: "Lagos",                // REQUIRED
    state: "Lagos",               // REQUIRED
    postalCode: "101241",         // REQUIRED
    country: "Nigeria"            // REQUIRED
  },
  notes: "Optional delivery notes"
};
```

#### 2. **Cart Management - API Endpoints**
```javascript
// Add to cart
POST /api/cart
{ product: "id", quantity: 1, weight: 50, pricePerKg: 5000 }

// Get cart
GET /api/cart

// Update cart item
PUT /api/cart/:productId
{ quantity: 2, weight: 100 }

// Remove from cart
DELETE /api/cart/item/:productId

// Clear cart
DELETE /api/cart

// Get cart count
GET /api/cart/count
```

#### 3. **Profile Page - Update Address**
Allow users to save their address for future orders:
```javascript
PUT /api/auth/profile
{
  firstName: "John",
  lastName: "Doe",
  phone: "2348012345678",
  address: {
    street: "123 Main Street",
    city: "Lagos",
    state: "Lagos",
    postalCode: "101241",
    country: "Nigeria"
  }
}
```

---

## Error Handling

### Payment Validation Errors:
- **Missing address**: "Please provide a shipping address"
- **Incomplete address**: "Incomplete address. Missing: street, city"
- **Missing items**: "Please provide order items"

### Cart Errors:
- **Product not found**: "Product not found"
- **Item not in cart**: "Item not found in cart"
- **Empty cart**: Returns success with empty cart

---

## Database Schema Reference

### User.cart Structure:
```javascript
{
  product: ObjectId,        // Reference to Product
  quantity: Number,         // Item quantity
  weight: Number,          // Weight in kg
  pricePerKg: Number,      // Price per unit
  addedAt: Date            // When added to cart
}
```

### Order.shippingAddress Structure:
```javascript
{
  street: String,          // Street address (NEW)
  city: String,
  state: String,
  postalCode: String,
  country: String
}
```

---

## Testing Checklist

- [ ] User can add items to cart via `/api/cart` POST
- [ ] Cart persists in database after page refresh
- [ ] User can update cart item quantities
- [ ] User can remove items from cart
- [ ] Cart count endpoint returns accurate count
- [ ] Payment validation requires complete address
- [ ] Order created with full shipping address
- [ ] Cart cleared after successful payment
- [ ] WhatsApp notification includes address
- [ ] Email invoice includes delivery address
- [ ] Invoice download contains all address details
- [ ] Failed payment keeps cart intact

---

## Summary

All changes work together to provide:
1. ✅ **Persistent Cart** - Database-backed cart storage
2. ✅ **Address Capture** - Required fields validated at checkout
3. ✅ **Dual Notifications** - WhatsApp + Email with address
4. ✅ **Auto Cart Clearing** - Cleared after successful payment
5. ✅ **Professional Invoices** - Full address details included

The system now ensures no buyer details are lost and all critical information is included in both digital and notification records for efficient delivery.

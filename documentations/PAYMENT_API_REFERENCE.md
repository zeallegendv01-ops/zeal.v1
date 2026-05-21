# Cart & Payment API Quick Reference

## Cart Endpoints

All cart endpoints require authentication (JWT token in Authorization header).

### Add to Cart
```
POST /api/cart
Content-Type: application/json
Authorization: Bearer {token}

Body:
{
  "product": "product_id",
  "quantity": 1,
  "weight": 50,                    // Optional, in kg
  "pricePerKg": 5000              // Optional, price at time of adding
}

Response (200):
{
  "success": true,
  "message": "Item added to cart",
  "cart": [
    {
      "_id": "cart_item_id",
      "product": "product_id",
      "quantity": 1,
      "weight": 50,
      "pricePerKg": 5000,
      "addedAt": "2026-05-16T10:30:00Z"
    }
  ]
}
```

### Get Cart
```
GET /api/cart
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": [
    {
      "_id": "cart_item_id",
      "product": {
        "_id": "product_id",
        "name": "Tomatoes",
        "pricePerKg": 5000,
        "category": "Vegetables",
        "image": "image_url"
      },
      "quantity": 1,
      "weight": 50,
      "pricePerKg": 5000,
      "addedAt": "2026-05-16T10:30:00Z"
    }
  ]
}
```

### Get Cart Count
```
GET /api/cart/count
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "count": 3
}
```

### Update Cart Item
```
PUT /api/cart/{product_id}
Content-Type: application/json
Authorization: Bearer {token}

Body:
{
  "quantity": 2,
  "weight": 100,                  // Optional
  "pricePerKg": 5000             // Optional
}

Response (200):
{
  "success": true,
  "message": "Cart item updated",
  "cart": [...]
}
```

### Remove Item from Cart
```
DELETE /api/cart/item/{product_id}
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "message": "Item removed from cart",
  "cart": [...]
}
```

### Clear Entire Cart
```
DELETE /api/cart
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "message": "Cart cleared successfully",
  "cart": []
}
```

---

## Payment Flow

### 1. Initialize Payment
```
POST /api/payments/initialize
Content-Type: application/json
Authorization: Bearer {token}

Body:
{
  "items": [
    {
      "product": "product_id",
      "quantity": 1,
      "weight": 50,
      "pricePerKg": 5000
    }
  ],
  "shippingAddress": {
    "street": "12 Lekki Road",        // REQUIRED
    "city": "Lagos",                  // REQUIRED
    "state": "Lagos",                 // REQUIRED
    "postalCode": "101241",           // REQUIRED
    "country": "Nigeria"              // REQUIRED
  },
  "notes": "Handle with care"         // Optional
}

Response (200):
{
  "success": true,
  "message": "Payment initialized",
  "data": {
    "authorizationUrl": "https://checkout.paystack.com/...",
    "reference": "AGRO-1234567890-userid"
  }
}

Redirect user to authorizationUrl for payment
```

### 2. Verify Payment
```
GET /api/payments/verify/{reference}

Response (200):
{
  "success": true,
  "message": "Payment verified successfully",
  "data": { paystack_response_data }
}
```

### 3. Payment Success Callback
After payment is completed, user is redirected to:
```
{FRONTEND_URL}?payment=success&orderId={orderId}&clearCart=true
```

The `clearCart=true` parameter signals frontend to clear cart from localStorage/state.

---

## Order Endpoints

### Get Order Invoice
```
GET /api/payments/invoice/{orderId}
Authorization: Bearer {token}

Response (200):
HTML Invoice file (attachment)
```

### Get Orders (if endpoint exists)
```
GET /api/orders
Authorization: Bearer {token}

Response (200):
{
  "success": true,
  "data": [
    {
      "_id": "order_id",
      "orderNumber": "ORD-001",
      "buyer": {...},
      "items": [...],
      "shippingAddress": {
        "street": "12 Lekki Road",
        "city": "Lagos",
        "state": "Lagos",
        "postalCode": "101241",
        "country": "Nigeria"
      },
      "subtotal": 250000,
      "shippingCost": 5000,
      "tax": 25500,
      "total": 280500,
      "paymentStatus": "completed",
      "status": "pending",
      "createdAt": "2026-05-16T10:30:00Z"
    }
  ]
}
```

---

## Profile Update (Address Saving)

### Update User Profile
```
PUT /api/auth/profile
Content-Type: application/json
Authorization: Bearer {token}

Body:
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "2348012345678",
  "company": "My Farm Ltd",
  "address": {
    "street": "123 Main Street",
    "city": "Lagos",
    "state": "Lagos",
    "postalCode": "101241",
    "country": "Nigeria"
  }
}

Response (200):
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "user_id",
    "firstName": "John",
    "lastName": "Doe",
    "email": "user@example.com",
    "phone": "2348012345678",
    "address": {...},
    ...
  }
}
```

---

## Error Responses

### 400 - Bad Request
```json
{
  "success": false,
  "message": "Error description"
}
```

Examples:
- "Please provide product and quantity"
- "Incomplete address. Missing: street, city"
- "Please provide all required fields"

### 401 - Unauthorized
```json
{
  "success": false,
  "message": "Not authorized"
}
```

### 404 - Not Found
```json
{
  "success": false,
  "message": "Product not found" or "Item not found in cart"
}
```

### 500 - Server Error
```json
{
  "success": false,
  "message": "Server error"
}
```

---

## Important Notes

1. **Address is Required** - Payment initialization will fail without complete address
2. **Cart Auto-Clears** - Backend clears cart after successful payment
3. **Notifications** - WhatsApp and Email are sent with delivery address
4. **Address Fields** - Use `street` (not `addressLine`) for consistency
5. **Postal Code** - Use `postalCode` (not `zipCode`)
6. **Token Required** - All cart and profile endpoints require JWT authentication

---

## Success Flow Example

1. User adds items: `POST /api/cart`
2. User views cart: `GET /api/cart`
3. User updates quantity: `PUT /api/cart/{id}`
4. User proceeds to checkout with address
5. Initialize payment: `POST /api/payments/initialize`
6. User completes Paystack payment
7. Webhook processes: creates order, clears cart, sends notifications
8. User redirected with success message
9. Invoices/tracking available

---

## Important: Production Checklist

- [ ] Verify PAYSTACK_SECRET_KEY is set
- [ ] Verify EMAIL_USER and EMAIL_PASSWORD are set
- [ ] Verify WHATSAPP_PHONE_ID and WHATSAPP_ACCESS_TOKEN are set
- [ ] Verify FRONTEND_URL is correct for redirects
- [ ] Verify BACKEND_URL is correct for callbacks
- [ ] Test address validation
- [ ] Test cart clearing on production
- [ ] Test WhatsApp notifications
- [ ] Test email notifications
- [ ] Test invoice generation

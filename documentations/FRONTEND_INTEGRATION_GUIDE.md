# Frontend Integration Guide - Payment & Cart System

## Overview
This guide shows frontend developers exactly what needs to change to work with the new payment and cart system.

---

## 1. Cart Management

### Update Shopping Cart Component

#### Store Cart in Database (Persistent)
Previously: Cart stored in localStorage only  
**Now**: Cart stored in database + localStorage for UI state

```javascript
// On mount - Fetch cart from database
async function loadCart() {
  try {
    const response = await fetch('/api/cart', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.success) {
      setCart(data.data);
      localStorage.setItem('cart', JSON.stringify(data.data));
    }
  } catch (error) {
    console.error('Failed to load cart:', error);
  }
}

// On component mount
useEffect(() => {
  loadCart();
}, [token]);
```

#### Add to Cart
```javascript
async function addToCart(product, quantity, weight = 0) {
  try {
    const response = await fetch('/api/cart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        product: product._id,
        quantity: quantity,
        weight: weight,
        pricePerKg: product.pricePerKg
      })
    });
    
    const data = await response.json();
    if (data.success) {
      setCart(data.cart);
      showNotification('Item added to cart', 'success');
    } else {
      showNotification(data.message, 'error');
    }
  } catch (error) {
    showNotification('Failed to add item', 'error');
  }
}
```

#### Update Cart Item Quantity
```javascript
async function updateCartItem(productId, newQuantity, weight = 0) {
  try {
    const response = await fetch(`/api/cart/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        quantity: newQuantity,
        weight: weight
      })
    });
    
    const data = await response.json();
    if (data.success) {
      setCart(data.cart);
    }
  } catch (error) {
    console.error('Failed to update cart:', error);
  }
}
```

#### Remove from Cart
```javascript
async function removeFromCart(productId) {
  try {
    const response = await fetch(`/api/cart/item/${productId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (data.success) {
      setCart(data.cart);
    }
  } catch (error) {
    console.error('Failed to remove item:', error);
  }
}
```

#### Clear Cart (After Payment)
```javascript
async function clearCart() {
  try {
    const response = await fetch('/api/cart', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (data.success) {
      setCart([]);
      localStorage.removeItem('cart');
    }
  } catch (error) {
    console.error('Failed to clear cart:', error);
  }
}
```

---

## 2. Checkout Page - Address Capture

### Critical: Address is Now REQUIRED

### Update Checkout Form
```javascript
const [formData, setFormData] = useState({
  // Existing fields
  firstName: '',
  lastName: '',
  email: '',
  
  // Address fields (NOW REQUIRED)
  street: '',          // NEW - Street address (e.g., "12 Lekki Road")
  city: '',
  state: '',
  postalCode: '',      // Changed from 'zipCode'
  country: 'Nigeria',
  
  // Additional
  notes: ''
});

// Validation function
function validateCheckout() {
  const required = ['street', 'city', 'state', 'postalCode', 'country'];
  const missing = required.filter(field => !formData[field]?.trim());
  
  if (missing.length > 0) {
    showError(`Please fill in: ${missing.join(', ')}`);
    return false;
  }
  return true;
}
```

### Checkout Form JSX Example
```jsx
<div className="checkout-form">
  <h3>Shipping Address</h3>
  
  <input
    type="text"
    placeholder="Street Address (Required)"
    value={formData.street}
    onChange={(e) => setFormData({...formData, street: e.target.value})}
    required
  />
  
  <input
    type="text"
    placeholder="City (Required)"
    value={formData.city}
    onChange={(e) => setFormData({...formData, city: e.target.value})}
    required
  />
  
  <input
    type="text"
    placeholder="State (Required)"
    value={formData.state}
    onChange={(e) => setFormData({...formData, state: e.target.value})}
    required
  />
  
  <input
    type="text"
    placeholder="Postal Code (Required)"
    value={formData.postalCode}
    onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
    required
  />
  
  <select
    value={formData.country}
    onChange={(e) => setFormData({...formData, country: e.target.value})}
    required
  >
    <option value="Nigeria">Nigeria</option>
    <option value="Other">Other</option>
  </select>
  
  <textarea
    placeholder="Delivery notes (optional)"
    value={formData.notes}
    onChange={(e) => setFormData({...formData, notes: e.target.value})}
  />
</div>
```

---

## 3. Payment Initialization

### Update Payment Submission Handler

```javascript
async function handleCheckout() {
  // 1. Validate address
  if (!validateCheckout()) {
    return;
  }
  
  // 2. Prepare data
  const checkoutData = {
    items: cart.map(item => ({
      product: item.product._id,
      quantity: item.quantity,
      weight: item.weight,
      pricePerKg: item.pricePerKg
    })),
    shippingAddress: {
      street: formData.street,        // REQUIRED
      city: formData.city,            // REQUIRED
      state: formData.state,          // REQUIRED
      postalCode: formData.postalCode, // REQUIRED (note: use postalCode, not zipCode)
      country: formData.country       // REQUIRED
    },
    notes: formData.notes
  };
  
  try {
    // 3. Initialize payment
    const response = await fetch('/api/payments/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(checkoutData)
    });
    
    const data = await response.json();
    
    if (!data.success) {
      showError(data.message); // Show specific error (e.g., "Missing: street, city")
      return;
    }
    
    // 4. Redirect to Paystack
    window.location.href = data.data.authorizationUrl;
    
  } catch (error) {
    showError('Payment initialization failed');
  }
}
```

---

## 4. Payment Success Handling

### Listen for URL Parameters After Payment

```javascript
// On payment success page component
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const paymentStatus = params.get('payment');
  const orderId = params.get('orderId');
  const clearCart = params.get('clearCart');
  
  if (paymentStatus === 'success') {
    // Show success message
    showNotification('Payment successful! Your order has been confirmed.', 'success');
    
    // Clear cart if backend signals to
    if (clearCart === 'true') {
      localStorage.removeItem('cart');
      setCart([]);
      // Note: Backend also clears from database
    }
    
    // Show order details
    if (orderId) {
      redirectTo(`/orders/${orderId}`);
    }
    
    // Clear URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);
    
  } else if (paymentStatus === 'error') {
    const message = params.get('message');
    showNotification(`Payment failed: ${message}`, 'error');
  }
}, []);
```

---

## 5. User Profile - Save Address

### Allow Users to Save Address for Future Orders

```jsx
import { useState } from 'react';

function UserProfilePage() {
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'Nigeria'
    }
  });

  async function saveProfile() {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });
      
      const data = await response.json();
      if (data.success) {
        showNotification('Profile saved successfully', 'success');
        setProfile(data.data);
      }
    } catch (error) {
      showNotification('Failed to save profile', 'error');
    }
  }

  return (
    <div className="profile-form">
      <h2>My Profile</h2>
      
      <input
        value={profile.firstName}
        onChange={(e) => setProfile({
          ...profile,
          firstName: e.target.value
        })}
        placeholder="First Name"
      />
      
      <input
        value={profile.lastName}
        onChange={(e) => setProfile({
          ...profile,
          lastName: e.target.value
        })}
        placeholder="Last Name"
      />
      
      <input
        value={profile.phone}
        onChange={(e) => setProfile({
          ...profile,
          phone: e.target.value
        })}
        placeholder="Phone Number"
      />
      
      <h3>Default Address</h3>
      
      <input
        value={profile.address.street}
        onChange={(e) => setProfile({
          ...profile,
          address: {...profile.address, street: e.target.value}
        })}
        placeholder="Street Address"
      />
      
      <input
        value={profile.address.city}
        onChange={(e) => setProfile({
          ...profile,
          address: {...profile.address, city: e.target.value}
        })}
        placeholder="City"
      />
      
      <input
        value={profile.address.state}
        onChange={(e) => setProfile({
          ...profile,
          address: {...profile.address, state: e.target.value}
        })}
        placeholder="State"
      />
      
      <input
        value={profile.address.postalCode}
        onChange={(e) => setProfile({
          ...profile,
          address: {...profile.address, postalCode: e.target.value}
        })}
        placeholder="Postal Code"
      />
      
      <button onClick={saveProfile}>Save Profile</button>
    </div>
  );
}
```

---

## 6. Auto-fill Address at Checkout

### Reuse Saved Address

```javascript
async function loadUserProfile() {
  try {
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (data.success && data.data.address) {
      // Auto-fill checkout form with saved address
      setFormData(prev => ({
        ...prev,
        street: data.data.address.street || '',
        city: data.data.address.city || '',
        state: data.data.address.state || '',
        postalCode: data.data.address.postalCode || '',
        country: data.data.address.country || 'Nigeria'
      }));
    }
  } catch (error) {
    console.error('Failed to load profile:', error);
  }
}

// Call on checkout page mount
useEffect(() => {
  loadUserProfile();
}, []);
```

---

## 7. Show Notifications

### Payment notifications to display to users:

```javascript
// Success
"Payment successful! Your order is being processed. You'll receive tracking details via WhatsApp and email shortly."

// Failure (with reason)
"Payment failed: {reason from server}. Please try again or use a different payment method."

// Incomplete address
"Please complete your delivery address before proceeding to payment."

// Missing fields
"Please fill in: {field names}"
```

---

## Important Notes for Frontend

1. **Field Names**:
   - Use `street` (NOT `addressLine`)
   - Use `postalCode` (NOT `zipCode`)
   - Use `state` for state/province

2. **Address is Required**:
   - Without complete address, payment will fail with error
   - Validate before showing payment button

3. **Cart Clearing**:
   - Backend clears cart automatically after successful payment
   - Frontend should also clear localStorage and state when `clearCart=true`
   - User sees "Cart cleared" or redirect to homepage

4. **WhatsApp + Email**:
   - User receives both notifications with their delivery address
   - Invoices include full address details
   - Users can download invoices from order page

5. **Testing**:
   - Use Paystack test cards
   - Test with incomplete address (should fail)
   - Test cart clearing after payment
   - Verify notifications received

---

## Complete Checkout Flow

```
User clicks "Checkout"
    ↓
Load saved address (if available)
    ↓
User enters/confirms address
    ↓
Validate all required fields
    ↓
Call /api/payments/initialize with:
  - cart items
  - complete address
  - optional notes
    ↓
Redirect to Paystack payment page
    ↓
User completes payment
    ↓
Return to success page
    ↓
Show "Payment successful"
    ↓
Clear cart from database + localStorage
    ↓
Show order details / Download invoice
    ↓
User receives WhatsApp + Email with:
  - Order confirmation
  - Delivery address
  - Tracking info (when available)
```

---

## Testing with Paystack Test Mode

Test card: `4084 0343 0343 0343`
Expiry: Any future month/year
CVV: Any 3 digits

Always ensure address validation works before going to payment!

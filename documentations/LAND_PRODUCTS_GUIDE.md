# Land Products Integration Guide

## Overview
Your 365extra platform now supports both weight-based agricultural products (measured in kg) and land properties (measured in square meters). The system intelligently handles both types with separate UI, cart logic, and order processing.

---

## 📋 Changes Made

### 1. **Backend - Product Model** (`backend/models/Product.js`)
Added dual-purpose Product schema supporting:
- **Products**: weight-based items (kg)
- **Land**: area-based properties (m²)

#### New Fields for Land:
- `type`: 'product' or 'land'
- `landPricingType`: 'fixed' (one plot at set price) or 'per-meter' (price per m²)
- `pricePerPlot`: Fixed price for complete plot
- `pricePerSqMeter`: Price per square meter
- `location`: Address of the land
- `areaSqMeters`: Total area in square meters
- `legalStatus`: 'freehold', 'leasehold', 'government', 'communal', 'unknown'
- `accessibility`: 'road-access', 'water-access', 'both', 'limited'
- `numberOfPlots`: Admin decides: 1, 2, or multiple plots as single listing
- `images`: Additional property images array

---

## 🗺️ Frontend - Product Cards

### Agricultural Products (Original)
```
Weight Slider (0-100 kg)
Dynamic Price Calculation
Add to Selection Button
```

### Land Properties (New)
```
📐 Area: X,XXX m²
⚖️ Legal Status: Freehold/Leasehold/etc
🛣️ Accessibility: Road/Water/Both/Limited
📍 Location: Address shown
💰 Price: Fixed or per m² breakdown
📦 Number of Plots (if multiple)
Quantity Selector (if multiple plots)
Inquire About Land Button
```

---

## 🛒 Shopping Cart

### For Agricultural Products
```
Catfish - ₦45.00 / kg × 21kg [Qty: 1]
```

### For Land
```
Green Valley Land - Lagos [Qty: 1 Plot]
Location: Lekki, Lagos
5,000 m² • ₦2,500 / m² (per plot)
Total: ₦12,500,000
```

---

## 💾 Order Processing

**Automatic calculation**:
- **Products**: `pricePerKg × weight × quantity`
- **Land (Fixed)**: `pricePerPlot × numberOfPlotsOrdered`
- **Land (Per-meter)**: `(pricePerSqMeter × areaSqMeters) × numberOfPlotsOrdered`

Orders include item type (`product` or `land`) for proper fulfillment.

---

## 🤖 Telegram Bot Updates

### `/products` Command Now Shows:
```
🌾 AGRICULTURAL PRODUCTS
- Name, Price/kg, Stock, Category

🏡 LAND PROPERTIES  
- Name, Location, Area, Legal Status
- Accessibility, Number of Plots, Price
```

Separated display for easy admin management.

---

## 📱 Creating a Land Product (via API)

### Using POST `/api/products`

#### Example: Fixed Price Land
```json
{
  "name": "Premium Farmland, Lagos",
  "description": "Fertile soil, suitable for crop farming",
  "type": "land",
  "category": "Land",
  "location": "Lekki, Lagos",
  "areaSqMeters": 5000,
  "landPricingType": "fixed",
  "pricePerPlot": 12500000,
  "numberOfPlots": 1,
  "legalStatus": "freehold",
  "accessibility": "road-access",
  "image": "https://example.com/land.jpg",
  "images": ["https://example.com/land2.jpg", "https://example.com/land3.jpg"]
}
```

#### Example: Per-Meter Price Land (Multiple Plots)
```json
{
  "name": "Residential Land Plots, Abuja",
  "description": "100 residential plots available",
  "type": "land",
  "category": "Land",
  "location": "Abuja, FCT",
  "areaSqMeters": 500,
  "landPricingType": "per-meter",
  "pricePerSqMeter": 50000,
  "numberOfPlots": 100,
  "legalStatus": "government",
  "accessibility": "both",
  "image": "https://example.com/plots.jpg"
}
```

---

## 🎨 UI Styling

### Land Card Features:
- ✅ Responsive design (2-column on tablets, 1-column on mobile)
- ✅ Gold accent borders and badges
- ✅ Property details grid (Area, Legal Status, Accessibility)
- ✅ Dynamic pricing display
- ✅ Quantity selector for multi-plot listings
- ✅ "Inquire About Land" CTA button

### Cart Display:
- Land items shown with location pin emoji
- Different styling than product items (gold left border)
- Plots quantity control instead of weight/quantity mix

---

## 📊 Search Functionality

Works seamlessly with both:
- Agricultural products (by name, description, category)
- Land properties (by name, location, description)

Displays count as "X items" instead of "X products"

---

## ✅ Testing Guide

### Test Agricultural Product:
1. Browse home page → Product card with weight slider
2. Adjust weight (0-100 kg)
3. Price updates dynamically
4. Add to cart → Shows in modal as `[Product] × [Weight]kg`

### Test Land Product:
1. Browse → Land card with area, legal status, accessibility
2. If multiple plots available → Use quantity selector
3. Click "Inquire About Land"
4. Added to cart as `[Property] × [Number of Plots]`
5. Shows total price for all plots

### Test Order Creation:
1. Add both products and land to cart
2. Checkout → Both types calculated correctly
3. Order summary shows mixed items
4. Admin receives separate Telegram notifications for products vs land

---

## 🔒 Admin Capabilities

**Via Telegram `/products` command:**
- View all agricultural products
- View all land properties
- Separate, organized display
- Quick product/land counts

**Via API:**
- Create, edit, delete both types
- Admin controls pricing model (fixed vs per-meter)
- Set number of plots for subdivision
- Full CRUD on all fields

---

## 📝 Notes

- **Default Type**: New products default to 'product' type for backward compatibility
- **Search**: Case-insensitive, searches across name, location, and description
- **Cart Coexistence**: Supports mixing products and land in same cart
- **Mobile Responsive**: Fully optimized for all screen sizes
- **Telegram Bot**: Automatically updated to display both types properly

---

## 🚀 Next Steps

1. **Create Test Land Listing** via admin panel or API
2. **Test User Flow**: Register → Browse → Add → Cart → Checkout
3. **Configure Land Products**: Set up your actual property listings
4. **Monitor Orders**: View mixed-item orders in admin dashboard

Ready to showcase both agricultural products AND land sales! 🌾🏡


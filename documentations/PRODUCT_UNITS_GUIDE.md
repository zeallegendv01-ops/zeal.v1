# Product Units & Limits Guide

## Overview

Admins can now set flexible measurement units and order limits for each product. Products can be measured in weight, pieces, plots, or other units, with custom minimum and maximum order quantities.

---

## Available Units

| Unit | Use Case | Example |
|------|----------|---------|
| **kg** | Weight-based products | Rice, Garri, Catfish |
| **pieces** | Count-based products | Eggs, Fruit, Vegetables |
| **plots** | Land parcels | Farmland, Real Estate |
| **acres** | Land area | Large farmland |
| **hectares** | Large land area | Estate land |
| **boxes** | Packaged products | Cartons of goods |
| **bags** | Bulk products | Sacks of seeds, grains |
| **liters** | Liquid products | Oil, Juice, Honey |
| **tons** | Heavy bulk products | Industrial crops |

---

## Creating a Product with Units & Limits

### Example 1: Weight-Based Product (Rice)

```bash
curl -X POST http://localhost:4000/api/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Basmati Rice",
    "description": "High-quality basmati rice from Nigeria",
    "category": "Rice",
    "pricePerKg": 500,
    "type": "product",
    "unit": "kg",
    "minLimit": 5,
    "maxLimit": 100,
    "quantity": 500,
    "image": "https://example.com/rice.jpg",
    "certification": {
      "organic": true,
      "fair_trade": false,
      "iso": false
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Premium Basmati Rice",
    "unit": "kg",
    "minLimit": 5,
    "maxLimit": 100,
    "pricePerKg": 500
  }
}
```

### Example 2: Piece-Based Product (Eggs)

```bash
curl -X POST http://localhost:4000/api/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Free-Range Chicken Eggs",
    "description": "Fresh, organic chicken eggs",
    "category": "Other",
    "type": "product",
    "unit": "pieces",
    "minLimit": 6,
    "maxLimit": 360,
    "pricePerKg": 2000,
    "quantity": 1000,
    "image": "https://example.com/eggs.jpg"
  }'
```

### Example 3: Plot-Based Land

```bash
curl -X POST http://localhost:4000/api/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Farmland in Edo State",
    "description": "Certified agricultural land with road access",
    "category": "Land",
    "type": "land",
    "unit": "plots",
    "minLimit": 1,
    "maxLimit": 5,
    "location": "Edo State, Nigeria",
    "areaSqMeters": 2000,
    "legalStatus": "freehold",
    "accessibility": "road-access",
    "landPricingType": "fixed",
    "pricePerPlot": 500000,
    "numberOfPlots": 5,
    "image": "https://example.com/land.jpg"
  }'
```

### Example 4: Liquid Product (Liters)

```bash
curl -X POST http://localhost:4000/api/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Organic Palm Oil",
    "description": "Pure, unrefined palm oil",
    "category": "Other",
    "type": "product",
    "unit": "liters",
    "minLimit": 1,
    "maxLimit": 50,
    "pricePerKg": 3000,
    "quantity": 200,
    "image": "https://example.com/oil.jpg"
  }'
```

### Example 5: Bulk Product (Bags)

```bash
curl -X POST http://localhost:4000/api/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Garri Bags",
    "description": "50kg bags of quality garri",
    "category": "Grains",
    "type": "product",
    "unit": "bags",
    "minLimit": 2,
    "maxLimit": 100,
    "pricePerKg": 150,
    "quantity": 500,
    "image": "https://example.com/garri.jpg"
  }'
```

---

## Updating Product Units & Limits

```bash
curl -X PATCH http://localhost:4000/api/products/:productId \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "unit": "kg",
    "minLimit": 10,
    "maxLimit": 200
  }'
```

---

## Order Validation

When customers place orders, the system automatically validates quantities:

### Example: Valid Order
```bash
# Product: Rice with minLimit=5, maxLimit=100
# Customer orders: 50 kg ✅ VALID (5 ≤ 50 ≤ 100)

curl -X POST http://localhost:4000/api/orders \
  -H "Authorization: Bearer CUSTOMER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "product": "507f1f77bcf86cd799439011",
        "quantity": 50,
        "weight": 1
      }
    ]
  }'
```

### Example: Invalid Order (Below Minimum)
```bash
# Product: Rice with minLimit=5, maxLimit=100
# Customer orders: 2 kg ❌ FAILS

curl -X POST http://localhost:4000/api/orders \
  -H "Authorization: Bearer CUSTOMER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "product": "507f1f77bcf86cd799439011",
        "quantity": 2,
        "weight": 1
      }
    ]
  }'

# Response:
{
  "success": false,
  "message": "Minimum order for Premium Basmati Rice is 5 kg"
}
```

### Example: Invalid Order (Above Maximum)
```bash
# Product: Rice with minLimit=5, maxLimit=100
# Customer orders: 150 kg ❌ FAILS

# Response:
{
  "success": false,
  "message": "Maximum order for Premium Basmati Rice is 100 kg"
}
```

---

## Product Unit Chart

### For Weight-Based Products

| Product Type | Recommended Unit | Min Strategy | Max Strategy |
|-------------|------------------|--------------|--------------|
| **Grains** | kg | 5-10 kg | 100-500 kg |
| **Fish** | kg | 2-5 kg | 50-200 kg |
| **Oil** | liters | 1-5 liters | 50-200 liters |
| **Seeds** | kg | 1-10 kg | 100-500 kg |

### For Count-Based Products

| Product Type | Recommended Unit | Min Strategy | Max Strategy |
|-------------|------------------|--------------|--------------|
| **Eggs** | pieces | 6-12 pieces | 360-1000 pieces |
| **Vegetables** | pieces | 1-10 pieces | 100-500 pieces |
| **Fruits** | pieces | 2-6 pieces | 50-200 pieces |

### For Land Products

| Land Type | Recommended Unit | Min Strategy | Max Strategy |
|-----------|-----------------|--------------|--------------|
| **Farmland** | plots | 1 plot | 5-10 plots |
| **Estate Land** | acres | 0.5 acres | 10-50 acres |
| **Commercial** | hectares | 1 hectare | 10-100 hectares |

---

## Best Practices

### 1. Set Realistic Minimums
- **Weight products**: 5-10 kg minimum for wholesale
- **Pieces**: Set based on common order sizes (6 eggs, 10 items, etc.)
- **Land**: Usually 1 plot/acre minimum

### 2. Set Appropriate Maximums
- **Based on stock**: Don't set max higher than actual inventory
- **Based on production capacity**: Consider how much you can fulfill
- **Bulk discounts**: Higher maxes encourage larger orders

### 3. Match Units to Customer Expectations
- Agricultural products → weight (kg)
- Perishables → pieces or small weights
- Land → plots or acreage
- Liquids → liters (not kg)

### 4. Update Limits Seasonally
- Increase max during harvest seasons
- Reduce max during off-season or limited supply
- Update min based on demand patterns

---

## Frontend Integration Examples

### Adding Unit Selection in Product Form

```html
<div class="form-group">
  <label for="unit">Measurement Unit</label>
  <select id="unit" name="unit" required>
    <option value="">Select unit...</option>
    <option value="kg">Kilograms (kg)</option>
    <option value="pieces">Pieces</option>
    <option value="plots">Plots</option>
    <option value="acres">Acres</option>
    <option value="hectares">Hectares</option>
    <option value="boxes">Boxes</option>
    <option value="bags">Bags</option>
    <option value="liters">Liters</option>
    <option value="tons">Tons</option>
  </select>
</div>

<div class="form-group">
  <label for="minLimit">Minimum Order</label>
  <input type="number" id="minLimit" name="minLimit" step="0.1" required>
</div>

<div class="form-group">
  <label for="maxLimit">Maximum Order</label>
  <input type="number" id="maxLimit" name="maxLimit" step="0.1" required>
</div>
```

### Displaying Unit Limits to Customers

```html
<div class="product-limits">
  <p>
    Order between <strong>5</strong> and <strong>100</strong> 
    <span class="unit">kg</span>
  </p>
  <input type="number" 
    id="quantity" 
    min="5" 
    max="100" 
    placeholder="Enter quantity in kg">
</div>
```

---

## Troubleshooting

### Issue: "Unit is required" error
**Solution**: Always specify a unit when creating a product

### Issue: "Maximum limit must be greater than minimum"
**Solution**: Ensure `maxLimit > minLimit`

### Issue: Orders rejected with limit error
**Solution**: 
1. Check product's minLimit and maxLimit
2. Verify unit matches the order quantity unit
3. Ensure order quantity is within range

### Issue: Can't update unit
**Solution**: Ensure you're the product supplier (authenticated with correct token)

---

## API Reference

### GET /api/products
Returns all products with their units and limits.

### POST /api/products
Create a new product with unit and limits.

**Required Fields:**
- `name`, `description`, `image`, `unit`, `minLimit`, `maxLimit`

### PATCH /api/products/:id
Update product units and limits.

### POST /api/orders
Create order with validation against min/max limits.

---

## Summary

The units and limits system provides:
✅ Flexible product measurement (weight, pieces, plots, etc.)
✅ Customizable minimum and maximum order quantities
✅ Automatic order validation
✅ Better inventory control
✅ Reduced order fulfillment issues

For questions or support, contact your admin team!

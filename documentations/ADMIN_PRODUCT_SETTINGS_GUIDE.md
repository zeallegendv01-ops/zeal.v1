# Admin Product Settings Guide - Telegram Bot

## Overview
Admins can now configure product specifications including **unit of measurement** and **order range limits** directly through the Telegram bot. These settings are displayed on the frontend product cards and enforce order validation.

---

## Creating a Product with Custom Settings

### Step-by-Step Process:

1. **Start the Product Creation**
   - Send `/addproduct` command
   - Or click **"Create New"** in the Products menu

2. **Enter Product Name**
   - Example: "Premium Smoked Catfish"

3. **Enter Product Description**
   - Example: "High-quality smoked catfish from Nigeria"

4. **Enter Price Per Unit**
   - Example: "2500" (₦2500)

5. **Select Category**
   - Choose from: Smoked Fish, Grains, Rice, or Other

6. **Enter Quantity in Stock**
   - Example: "500" (500 kg in stock)

7. **⭐ Enter Unit of Measurement** (NEW)
   - This determines how the product is measured
   - Examples: `kg`, `Tons`, `Boxes`, `Crates`, `Liters`, `Bags`
   - The unit will display as: "₦2500/**kg**"
   - **Important**: Must match what customers order in

8. **⭐ Enter Minimum Order Limit** (NEW)
   - Minimum quantity customers must order
   - Must be a positive number
   - Example: `50` for minimum 50 kg
   - **Use Case**: Prevent small orders if you only ship in bulk

9. **⭐ Enter Maximum Order Limit** (NEW)
   - Maximum quantity customers can order per transaction
   - Must be greater than minimum limit
   - Example: `1000` for maximum 1000 kg
   - **Use Case**: Prevent overselling or manage inventory

10. **Add Product Image**
    - Upload from Telegram, provide URL, or skip for default

---

## Example Configurations

### Heavy Bulk Product (Grains)
```
Name: White Parboiled Rice
Unit: Tons
Minimum Limit: 5
Maximum Limit: 100
Price: ₦50,000/Ton
Display: "Order 5-100 Tons" on range slider
```

### Medium Bulk Product (Smoked Fish)
```
Name: Premium Smoked Catfish
Unit: kg
Minimum Limit: 50
Maximum Limit: 500
Price: ₦2,500/kg
Display: "Order 50-500 kg" on range slider
```

### Small Retail Product (Packaged)
```
Name: Organic Ginger (Packed)
Unit: Boxes
Minimum Limit: 10
Maximum Limit: 100
Price: ₦1,200/Box
Display: "Order 10-100 Boxes" on range slider
```

---

## Editing Product Settings

### To Edit Existing Product:

1. Send `/editproduct "Product Name"` 
   - Example: `/editproduct "Premium Catfish"`

2. Choose what to edit:
   ```
   1. Name
   2. Description
   3. Price
   4. Quantity
   5. Category
   6. Unit of Measurement ⭐ (NEW)
   7. Minimum Order Limit ⭐ (NEW)
   8. Maximum Order Limit ⭐ (NEW)
   ```

3. Enter new value and confirm

---

## Frontend Display

### Product Card Shows:
- **Unit**: "₦2,500/**kg**" (in price)
- **Range Slider**: Shows minimum and maximum order quantities
- **Validation**: Order validation prevents orders outside the range

### Order Validation Messages:
- **Too Small**: "Minimum order for Premium Catfish is 50 kg"
- **Too Large**: "Maximum order for Premium Catfish is 500 kg"

---

## Best Practices

### Unit Selection
- ✅ Use consistent units (all products in kg, not mix kg and Tons)
- ✅ Use standard agricultural units: kg, Tons, Bags, Boxes, Crates
- ❌ Don't use units customers won't understand

### Limit Configuration
- ✅ **Minimum Limit**: Set based on your shipping/packaging constraints
- ✅ **Maximum Limit**: Set based on inventory and logistics capacity
- ✅ Maximum should be higher than minimum for meaningful range
- ❌ Don't set limits too tight - customers won't order

### Recommended Ranges by Product Type

| Product | Unit | Min | Max | Reason |
|---------|------|-----|-----|--------|
| Smoked Fish | kg | 50 | 500 | Perishable, bulk handling |
| Grains | Tons | 5 | 100 | Heavy, shipping constraints |
| Rice | Bags | 100 | 1000 | Lightweight but bulky |
| Processed | Boxes | 10 | 200 | Retail packaging |

---

## Common Scenarios

### Scenario 1: Bulk-Only Supplier
```
Product: Industrial Maize
Min Limit: 10 (Tons)
Max Limit: 500 (Tons)
Effect: Only accepts large orders, prevents small orders
```

### Scenario 2: Flexible Supplier
```
Product: Premium Rice
Min Limit: 1 (Bag)
Max Limit: 10000 (Bags)
Effect: Accepts orders from 1 bag to 10,000 bags
```

### Scenario 3: Limited Availability
```
Product: Organic Ginger (Limited Stock)
Min Limit: 50 (kg)
Max Limit: 150 (kg)
Effect: Tight range due to limited supply
```

---

## Troubleshooting

### Issue: Max Limit Shows as "N/A"
- **Cause**: Old products created before this feature
- **Solution**: Edit product and set limits using `/editproduct`

### Issue: Range Slider Not Showing
- **Cause**: Missing unit or limit values
- **Solution**: Ensure all three fields are set (unit, min, max)

### Issue: Orders Being Rejected
- **Cause**: Customer order outside configured limits
- **Solution**: Check limits with `/products` and adjust if needed

### Issue: Wrong Unit Displaying
- **Cause**: Typo in unit field
- **Solution**: Edit product and enter correct unit

---

## Admin Commands Reference

| Command | Purpose |
|---------|---------|
| `/addproduct` | Create new product with all settings |
| `/editproduct "Name"` | Edit existing product settings |
| `/products` | View all products with current limits |
| `/deleteproduct "Name"` | Delete a product |

---

## Frontend Customer Experience

Customers will see:
1. **Product Price with Unit**: "₦2,500/kg"
2. **Range Slider**: Visual control from min to max
3. **Min/Max Labels**: Showing "50 kg min | 500 kg max"
4. **Validation**: Error messages if order outside range

Example:
```
Premium Catfish
₦2,500/kg

Select Quantity: [========|====] 50 ← → 500 kg
```

---

## API Behavior

### When Creating/Editing Products:

The following fields are now validated:
- `unit` - Required, string
- `minLimit` - Required, number >= 0
- `maxLimit` - Required, number > minLimit

All three values must be set for proper frontend display.

---

## Support

If limits aren't working:
1. Verify all three fields are set (unit, minLimit, maxLimit)
2. Check that maxLimit > minLimit
3. Verify the backend is receiving the values
4. Check browser console for JavaScript errors


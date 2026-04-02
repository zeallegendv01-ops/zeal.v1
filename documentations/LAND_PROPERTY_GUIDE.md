# Land Property Management Guide - Telegram Bot

## ✨ New Feature: Land Property Upload

Admins can now upload and manage **land properties** directly from the Telegram bot, complete with location, area, legal status, accessibility, pricing options, units, and order limits.

---

## 🚀 How to Add a Land Property

### Method 1: Using /addproduct Command
```
Admin: /addproduct
Bot: What would you like to add?
       → 📦 Agricultural Product
       → 🏡 Land Property

Admin: (clicks Land Property)
```

### Method 2: Using Land Menu
```
Admin: (clicks 🏡 Land menu button)
       → View All Land
       → Create New
       → Search Land
```

---

## 📝 Complete Land Property Creation Process

### Step 1: Enter Property Name
```
Bot: Enter property name:
Admin: Premium Agricultural Land, Lekki
```

### Step 2: Property Description
```
Bot: Enter a detailed description:
Admin: 5 hectares of premium freehold agricultural land in serene environment, 
       suitable for mix-crop farming or real estate development
```

### Step 3: Location/Address
```
Bot: Enter the location/address:
Admin: Lekki-Epe Expressway, Lagos, Nigeria
```

### Step 4: Area in Square Meters
```
Bot: Enter the total area (e.g., 5000 for 5000 m²):
Admin: 50000
(This is 50,000 m² = 5 hectares)
```

### Step 5: Number of Plots
```
Bot: How many plots is this divided into?
Admin: 5
(The property is divided into 5 plots)
```

### Step 6: Legal Status ⭐
Choose one:
```
⚖️ Legal Status options:
  → Freehold (owned completely)
  → Leasehold (rented/leased)
  → Government (government land)
  → Communal (community land)
  → Unknown (status unclear)

Admin: (clicks Freehold)
```

### Step 7: Accessibility ⭐
Choose access type:
```
🛣️ Accessibility options:
  → Road Access (accessible by road)
  → Water Access (accessible by water)
  → Both (road and water access)
  → Limited (difficult access)

Admin: (clicks Road Access)
```

### Step 8: Pricing Type ⭐
Choose pricing model:
```
💰 Pricing Type options:
  → Fixed per Plot (₦X per plot)
  → Per Square Meter (₦X per m²)

Admin: (clicks Fixed per Plot)
```

### Step 9: Enter Price
Based on pricing type selected:

**If Fixed per Plot:**
```
Bot: Enter the fixed price for EACH plot in Naira:
Admin: 5000000
(This is ₦5,000,000 per plot)
```

**If Per Square Meter:**
```
Bot: Enter the price per square meter:
Admin: 100000
(This is ₦100,000 per m²)
```

### Step 10: Unit of Measurement ⭐
```
Bot: Enter the unit for this property:
Admin: plots
(Options: plots, hectares, acres, sq-meters, etc.)
```

### Step 11: Minimum Order Limit ⭐
```
Bot: Enter the minimum order quantity in plots:
Admin: 1
(Customers must order minimum 1 plot)
```

### Step 12: Maximum Order Limit ⭐
```
Bot: Enter the maximum order quantity in plots:
Admin: 5
(Customers can order maximum 5 plots)
```

### Step 13: Property Image
```
Bot: How would you like to add an image?
  → Send Photo
  → URL
  → Skip

Admin: (clicks Send Photo or provides URL)
```

### Success Message
```
✅ Land Property Created Successfully!

Premium Agricultural Land, Lekki
📍 Location: Lekki-Epe Expressway, Lagos, Nigeria
📐 Area: 50,000 m²
📦 Plots: 5
💰 Price: ₦5,000,000/plot
📏 Unit: plots
📊 Range: 1-5 plots
ID: <property-id>
```

---

## 📊 Real-World Examples

### Example 1: Luxury Residential Land
```
Name:           Premium Residential Estate, Ikoyi
Location:       Ikoyi, Lagos
Area:           20,000 m² (2 hectares)
Plots:          4 plots of 5,000 m² each
Legal Status:   Freehold
Accessibility:  Both (road & water)
Pricing:        Fixed per Plot
Price:          ₦20,000,000/plot
Unit:           plots
Min Limit:      1 plot
Max Limit:      4 plots

Display on Frontend:
[Shows 1-4 plots range slider]
₦20,000,000/plot
Freehold | Both Access | 20,000 m²
```

### Example 2: Commercial Land with Per-Meter Pricing
```
Name:           Industrial Park Land
Location:       Lekki Free Zone
Area:           50,000 m²
Plots:          10 plots
Legal Status:   Government
Accessibility:  Road Access
Pricing:        Per Square Meter
Price:          ₦500,000/m²
Unit:           hectares
Min Limit:      0.5 hectares
Max Limit:      2 hectares

Display on Frontend:
[Shows 0.5-2 hectares range slider]
₦500,000/m²
Government | Road Access | 50,000 m²
```

### Example 3: Agricultural Farmland
```
Name:           Premium Farmland
Location:       Ibadan, Oyo State
Area:           100,000 m² (10 hectares)
Plots:          1 (single plot)
Legal Status:   Leasehold
Accessibility:  Road Access
Pricing:        Per Square Meter
Price:          ₦150,000/m²
Unit:           hectares
Min Limit:      1 hectare
Max Limit:      10 hectares
```

---

## 🔍 Viewing Land Properties

### Via /products Command
```
Admin: /products

Shows:
🏡 LAND PROPERTIES (up to 5)

For each property:
- Name
- Location
- Area in m²
- Number of plots
- Legal Status
- Accessibility type
- Price display
- Unit
- Order Range
- Description
- ID
```

### Via 🏡 Land Menu
```
Admin: (clicks Land menu)
       → View All Land

Shows all land properties with images (if available)
and detailed information
```

---

## ✏️ Editing Land Properties

```
Admin: /editproduct "Premium Agricultural Land"

Bot: What would you like to edit?
     1. Name
     2. Description
     3. Location
     4. Area (m²)
     5. Number of Plots
     6. Legal Status
     7. Accessibility
     8. Pricing Type
     9. Price
     10. Unit
     11. Min Limit
     12. Max Limit

Admin: (selects field to edit)
```

---

## 📋 Land Property Fields

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| Name | Text | "Premium Land" | Required |
| Description | Text | "5 hectares..." | Required |
| Location | Text | "Lekki, Lagos" | Required |
| Area (m²) | Number | 50000 | Required |
| Number of Plots | Number | 5 | Required |
| Legal Status | Choice | Freehold | Required |
| Accessibility | Choice | road-access | Required |
| Pricing Type | Choice | fixed/per-meter | Required |
| Price | Number | 5000000 | Required |
| Unit | String | plots/hectares | Optional (default: plots) |
| Min Limit | Number | 1 | Optional (default: 1) |
| Max Limit | Number | 5 | Optional (default: # plots) |
| Image | URL | image.jpg | Optional |

---

## ⚖️ Legal Status Options

| Status | Description | Use Case |
|--------|-------------|----------|
| **Freehold** | Owner has complete ownership | Private residential/commercial |
| **Leasehold** | Land is leased (not owned) | Long-term lease agreements |
| **Government** | Government-owned land | State-allocated properties |
| **Communal** | Community-owned land | Community development projects |
| **Unknown** | Status unclear | Default when uncertain |

---

## 🛣️ Accessibility Options

| Type | Description |
|------|-------------|
| **Road Access** | Can reach property by road vehicles |
| **Water Access** | Can reach property by water/boats |
| **Both** | Both road and water access available |
| **Limited** | Difficult or restricted access |

---

## 💰 Pricing Models

### Fixed Per Plot
- One price for **each plot**
- Example: ₦5M per plot
- Total price = ₦5M × number of plots ordered
- Use case: When all plots are uniform

### Per Square Meter
- Price per **m²**
- Example: ₦100k per m²
- Total price = ₦100k × area ordered
- Use case: When ordering by area, not plots

---

## 🎯 Unit & Limit Configuration

### Common Units for Land
- `plots` - Number of plots
- `hectares` - 1 hectare = 10,000 m²
- `acres` - 1 acre ≈ 4,047 m²
- `sq-meters` - Square meters
- `bighas` - Custom local units

### Example Configurations

**By Plots:**
```
Unit: plots
Min: 1 plot
Max: 5 plots
Range will show: 1 ← [slider] → 5 plots
```

**By Hectares:**
```
Unit: hectares
Min: 0.5 hectares
Max: 5 hectares
Range will show: 0.5 ← [slider] → 5 hectares
```

**By Acres:**
```
Unit: acres
Min: 1 acre
Max: 10 acres
Range will show: 1 ← [slider] → 10 acres
```

---

## 🔐 Admin Permissions

Only admins can:
- ✅ Create land properties
- ✅ Edit land properties
- ✅ Delete land properties
- ✅ View all land inventory
- ✅ Search properties

Customers can:
- ✅ View properties on website
- ✅ Select via range slider
- ✅ Place orders within limits
- ✅ View property details

---

## 📱 Frontend Customer Experience

### Land Property Display
```
┌─────────────────────────────────────┐
│ Premium Agricultural Land, Lekki    │
│                                     │
│ 📍 Lekki-Epe Expressway            │
│ 📐 50,000 m² (5 hectares)          │
│ ⚖️ Freehold                        │
│ 🛣️ Road Access                     │
│                                     │
│ ₦5,000,000/plot  ⭐               │
│                                     │
│ Select Quantity (plots):            │
│ [1 ←────|────→ 5] plots            │
│  ^                 ^                │
│  Min              Max               │
│                                     │
│ 📝 5 hectares of premium land...    │
│                                     │
│ [Add to Cart] [More Details]        │
└─────────────────────────────────────┘
```

### Order Validation
- ❌ "Minimum order for this property is 1 plot"
- ❌ "Maximum order for this property is 5 plots"
- ✅ Order accepted when within range

---

## 💡 Best Practices

✅ **DO:**
- Use consistent units across properties
- Set realistic min/max limits
- Provide clear location descriptions
- Use high-quality property images
- Specify legal status accurately
- Include accessibility information

❌ **DON'T:**
- Mix units (don't use both "plot" and "hectare" for same property)
- Set max limit greater than available plots
- Leave descriptions empty
- Use old/incorrect legal status
- Forget to update prices when market changes

---

## 🔄 Workflow Summary

```
/addproduct
    ↓
[Choose Product or Land]
    ↓
[Land selected]
    ↓
[Enter: Name, Description, Location, Area, Plots, 
 Legal Status, Accessibility, Pricing, Price,
 Unit, Min/Max Limits, Image]
    ↓
✅ Property Created
    ↓
[Visible on /products & website]
    ↓
[Customers can order via range slider]
```

---

## Support

For issues with land property uploads:
1. Check that all required fields are filled
2. Verify legal status and accessibility choices
3. Confirm area is in square meters (m²)
4. Ensure min limit < max limit
5. Check image URL format (must start with http:// or https://)


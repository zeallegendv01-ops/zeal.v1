# Deployment Checklist - Payment & Cart System

## Pre-Deployment

### Backend Preparation
- [ ] All Node.js modules installed: `npm install`
- [ ] Environment variables configured in `.env`:
  - [ ] `PAYSTACK_SECRET_KEY` set
  - [ ] `EMAIL_USER` configured (Gmail)
  - [ ] `EMAIL_PASSWORD` set (app password, not Gmail password)
  - [ ] `WHATSAPP_PHONE_ID` set
  - [ ] `WHATSAPP_ACCESS_TOKEN` set
  - [ ] `FRONTEND_URL` points to frontend domain
  - [ ] `BACKEND_URL` points to backend domain
  - [ ] `JWT_SECRET` configured
  - [ ] `MONGO_URI` points to MongoDB
  
### Database
- [ ] MongoDB is running and accessible
- [ ] Backup existing database before migration
- [ ] Run migrations for schema changes:
  ```bash
  # The following will automatically apply with Mongoose
  # No explicit migration needed
  ```

### Code Review
- [ ] All files compiled without errors ✓
- [ ] No merge conflicts in shared files
- [ ] Tests pass (if applicable)
- [ ] Code review completed

---

## Schema Migrations

### User Model Changes
```javascript
// NEW fields added:
// address.street (String)
// cart (Array of cart items)

// Existing users data:
// - address fields (country, state, city, postalCode) preserved
// - cart will be empty array []
```

**Migration Steps:**
1. Existing user documents will auto-update on first save
2. Can add street to existing addresses manually via admin panel
3. Cart starts empty for all users

### Order Model Changes
```javascript
// shippingAddress fields restructured:
// OLD: { country, state, city, postalCode, addressLine }
// NEW: { street, city, state, postalCode, country }

// Existing orders:
// - Will continue to work with existing shippingAddress
// - New orders will use new structure
```

---

## Deployment Steps

### Step 1: Backend Deployment
```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
npm install

# 3. Run build/compilation (if applicable)
npm run build

# 4. Test locally
npm test

# 5. Stop current server
# Gracefully stop existing Node.js process

# 6. Start new server
npm start
# or if using PM2:
pm2 restart 365extra-backend
```

### Step 2: Database Initialization
No manual migration needed - Mongoose will handle schema updates:
- Existing User documents: fields added automatically
- Existing Order documents: continue to work
- New documents: use updated schema

### Step 3: Test Core Functions

```bash
# Test 1: Server Health
curl http://localhost:4000/health

# Test 2: Authentication
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@365extra.com","password":"admin123"}'

# Test 3: Cart endpoints
# (Will need valid JWT token from Test 2)
curl -X GET http://localhost:4000/api/cart \
  -H "Authorization: Bearer {token}"

# Test 4: Payment initialization
curl -X POST http://localhost:4000/api/payments/initialize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{...checkout data with address}'
```

### Step 4: Frontend Deployment

**Update Frontend Code:**
- [ ] Update cart management component (use `/api/cart` endpoints)
- [ ] Add `street` field to checkout form
- [ ] Change `zipCode` → `postalCode`
- [ ] Add address validation
- [ ] Handle `clearCart=true` URL parameter
- [ ] Update success/error messages

**Deploy Frontend:**
```bash
# 1. Update code
git pull origin main

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Deploy (varies by platform)
# For Netlify/Vercel: auto-deploys on git push
# For traditional: copy build to web server
```

---

## Post-Deployment Verification

### Immediate Tests (Next 1-2 hours)

1. **Server Health**
   - [ ] Backend responds to health check
   - [ ] No crash logs in server console
   - [ ] Database connection active

2. **Cart Functionality**
   - [ ] Users can add items to cart
   - [ ] Cart displays correctly on frontend
   - [ ] Cart persists after page refresh
   - [ ] Can update quantities
   - [ ] Can remove items
   - [ ] Can clear cart

3. **Payment Flow**
   - [ ] Checkout page shows address fields
   - [ ] Address validation works (reject incomplete)
   - [ ] Payment initializes with complete address
   - [ ] Redirects to Paystack correctly
   - [ ] Test payment completes

4. **Notifications**
   - [ ] Admin receives Telegram notification
   - [ ] Buyer receives WhatsApp message (check for address)
   - [ ] Buyer receives email with invoice (check for address)
   - [ ] Invoice contains full address

5. **Cart Clearing**
   - [ ] After payment success, cart is empty
   - [ ] Cart is empty in database and frontend
   - [ ] Frontend shows "Cart cleared" or appropriate message

### Extended Tests (Day 1-2)

1. **Edge Cases**
   - [ ] Payment failure: cart remains
   - [ ] User can retry failed payment
   - [ ] Multiple cart items work correctly
   - [ ] Various address formats handled

2. **Notifications Quality**
   - [ ] WhatsApp message clarity and formatting
   - [ ] Email invoice professional appearance
   - [ ] Address displayed correctly in all notifications
   - [ ] Telegram notification includes all details

3. **Data Integrity**
   - [ ] Orders created with correct addresses
   - [ ] Cart items stored properly
   - [ ] User profiles updated successfully
   - [ ] No duplicate orders from retries

---

## Monitoring

### Monitor During Deployment
```bash
# Watch server logs
tail -f server.log

# Check error logs
tail -f error.log

# Monitor database
mongo 365extra --eval "db.users.count()"
mongo 365extra --eval "db.orders.count()"
```

### Key Metrics to Track
- [ ] Number of active carts
- [ ] Cart clearance rate after payment
- [ ] Payment success rate
- [ ] Notification delivery rate (WhatsApp + Email)
- [ ] Order creation rate
- [ ] Address completion rate

---

## Rollback Plan

If critical issues occur:

### Quick Rollback (< 5 min downtime)
```bash
# 1. Stop current server
pm2 stop 365extra-backend

# 2. Checkout previous version
git checkout {previous-commit-hash}

# 3. Restart with old code
pm2 start 365extra-backend

# Note: Database schema changes will persist
# But old code will ignore new fields
```

### Data Safety
- [ ] Backup database before deployment
- [ ] Keep old code version available
- [ ] Document any manual fixes needed
- [ ] Test rollback procedure

---

## Post-Deployment Support

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Cart not showing | Frontend not calling `/api/cart` | Update frontend code, check token |
| Address required error | Frontend not sending all fields | Add `street` field to form |
| Notifications not sent | Email/WhatsApp credentials invalid | Check .env variables |
| Cart not clearing | Webhook not triggered | Check Paystack webhook URL in settings |
| Duplicate orders | Webhook fired twice | Check Paystack duplicate prevention |

### Support Contact
- [ ] Notify support team of deployment
- [ ] Provide troubleshooting guide
- [ ] Set up monitoring alerts
- [ ] Have rollback plan ready

---

## Success Criteria

Deployment is successful when:
- ✅ No critical errors in server logs
- ✅ Users can add items to cart
- ✅ Cart persists across sessions
- ✅ Complete address required at checkout
- ✅ Payment processes with address
- ✅ Cart clears after successful payment
- ✅ WhatsApp notification includes address
- ✅ Email invoice includes address
- ✅ Failed payments keep cart for retry
- ✅ All orders have complete addresses

---

## Timeline

```
T-30min: Final environment checks
T-15min: Database backup
T-0min:  Begin deployment
T+5min:  Server restart
T+10min: Initial health checks
T+30min: Cart/Payment smoke tests
T+1hr:   Full system test
T+2hr:   Extended monitoring begins
```

---

## Contact & Escalation

**Issues During Deployment:**
1. Check server logs first: `tail -f logs/*`
2. Verify environment variables: `.env` file
3. Check database connection: `mongo` CLI
4. Review recent code changes for syntax errors
5. Escalate if unresolved after 30 minutes

**Critical Issues:**
- Immediate rollback to previous version
- Notify development team
- Document issue for post-mortem

---

## Sign-off

- [ ] Backend Developer: Verified code quality
- [ ] Frontend Developer: Updated frontend code
- [ ] DevOps: Deployment completed
- [ ] QA: Initial testing completed
- [ ] Manager: Approved for live

**Deployment Date:** ______________
**Deployed By:** ______________
**Status:** ☐ Successful ☐ Requires Rollback

---

## Additional Resources

1. **IMPLEMENTATION_NOTES_PAYMENT_CART.md** - Technical details
2. **PAYMENT_API_REFERENCE.md** - API documentation
3. **FRONTEND_INTEGRATION_GUIDE.md** - Frontend requirements
4. **PAYMENT_CART_SUMMARY.md** - Quick reference


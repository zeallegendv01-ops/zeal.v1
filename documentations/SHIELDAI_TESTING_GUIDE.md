# ShieldAI Complete Testing Guide

## Quick Start

### 1. Prerequisites
- Backend server running on `http://localhost:4000`
- MongoDB connected
- `TELEGRAM_BOT_TOKEN` and `ADMIN_TELEGRAM_ID` configured in `.env`
- Browser at `http://localhost:4000` with 365extra.html loaded

### 2. Test Matrix

## Context Menu Protection

### Test 1: Right-click is blocked
**Steps**:
1. Open http://localhost:4000 in browser
2. Right-click anywhere on the page
3. **Expected**: Context menu should NOT appear
4. **Console**: Should show `[ShieldAI] ⚠ Suspicious: context-menu-attempt (+8)`

**Verify**:
```javascript
// In browser console
ShieldAI.getState?.().contextMenuAttempts > 0  // Should be true
```

### Test 2: Share button exception works
**Steps**:
1. Find the share button element on the page
2. Right-click on the share button
3. **Expected**: Context menu SHOULD appear for share button
4. **Console**: Should NOT show context-menu-attempt warning

**Debug**:
```javascript
// In browser console
const shareBtn = document.querySelector('[data-action="share"]');
console.log("Share button found:", !!shareBtn);
console.log("Share button element:", shareBtn);
```

---

## Copy Protection

### Test 3: Copy returns "permission denied" message
**Steps**:
1. Try to copy any text on the page (Ctrl+C / Cmd+C)
2. Paste (Ctrl+V / Cmd+V) in a text editor
3. **Expected**: Text should be "365extras:-- permission denied --"

**Verify**:
```javascript
// Manually copy with JavaScript
document.execCommand('copy');  // Should return false
```

### Test 4: Share button copy exception
**Steps**:
1. Select text in the share button area
2. Copy (Ctrl+C)
3. Paste into text editor
4. **Expected**: Actual text should be copied (not "permission denied")

---

## DevTools Protection

### Test 5: DevTools shortcuts blocked
**Steps**:
1. Press F12 → DevTools should NOT open
2. Press Ctrl+Shift+I → DevTools should NOT open
3. Press Ctrl+Shift+C → DevTools inspector should NOT open
4. Press Cmd+Option+I (Mac) → DevTools should NOT open

**Console Warning**: `[ShieldAI] ⚠ Suspicious: devtools-shortcut-F12 (+30)`

**Verify**:
```javascript
// In console after trying F12
ShieldAI.getState?.().devtoolsOpen  // Should be false after all checks
```

---

## Screenshot Protection

### Test 6: PrintScreen triggers blur overlay
**Steps**:
1. Press PrintScreen key
2. **Expected**: Entire page should blur
3. Blur should persist until mouse moves

**Console**: `[ShieldAI] ⚠ Suspicious: screenshot-attempt (+15)`

### Test 7: Clipboard image paste detects and blurs
**Steps**:
1. Copy an image (e.g., from another tab)
2. Paste it (Ctrl+V) on the page
3. **Expected**: Page blurs immediately

---

## Threat Tracking & Logging

### Test 8: Manual threat analysis trigger
**Steps**:
```bash
# Terminal
curl -X POST http://localhost:4000/api/threat-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "trigger": "manual-test",
    "url": "http://localhost:4000",
    "headlessDetected": true,
    "devtoolsOpen": true,
    "contextMenuAttempts": 3,
    "mouseRoboticScore": 0.9,
    "scrollRoboticScore": 0.8,
    "localThreatScore": 85,
    "copies": 5,
    "drags": 2
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "clientIp": "127.0.0.1",
  "threatScore": 85,
  "threatLevel": "malicious",
  "logged": true,
  "notificationSent": true
}
```

**Verify in MongoDB**:
```javascript
db.threat_logs.findOne({ threatScore: { $gte: 85 } })
// Should return the logged threat with all fields
```

### Test 9: Telegram notification received
**Steps**:
1. Run Test 8 above
2. Open Telegram app
3. Check your admin account for notification from the bot
4. **Expected**: Detailed threat notification with emoji, IP, activities, scores

**Notification should include**:
- ✅ Threat Level indicator
- ✅ Threat Score (85/100)
- ✅ IP address
- ✅ User Agent
- ✅ Activity counts (copies: 5, contextMenuAttempts: 3, etc.)
- ✅ Behavioral scores
- ✅ Robotic analysis
- ✅ Protection actions triggered

---

## Real-World Attack Simulation

### Test 10: Automated bot detection
**Steps**:
```bash
# Using curl (simulates headless browser)
for i in {1..5}; do
  curl -X POST http://localhost:4000/api/threat-analysis \
    -H "Content-Type: application/json" \
    -d '{
      "trigger": "automated-bot-test",
      "url": "http://localhost:4000",
      "headlessDetected": true,
      "mouseMoves": 0,
      "clicks": 100,
      "automationDetected": true,
      "localThreatScore": 92,
      "mouseRoboticScore": 0.99,
      "keyRoboticScore": 0.0
    }' &
done
wait
```

**Expected**:
- ✅ Multiple threats logged with "malicious" level
- ✅ Multiple Telegram notifications sent
- ✅ Critical alert sent if score >= 85
- ✅ /api/threat-logs returns all attempts

### Test 11: Scraper detection
**Steps**:
```bash
# Simulate web scraper
curl -X POST http://localhost:4000/api/threat-analysis \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (compatible; curl/7.0)" \
  -d '{
    "trigger": "scraper-test",
    "url": "http://localhost:4000",
    "copies": 50,
    "drags": 20,
    "contextMenuAttempts": 15,
    "honeypotTriggered": true,
    "sessionDuration": 5000,
    "timeOnPage": 3000,
    "localThreatScore": 88
  }'
```

---

## Analytics & Statistics

### Test 12: Threat logs retrieval
**Steps**:
```bash
# Get all threats
curl http://localhost:4000/api/threat-logs

# Get malicious threats only
curl "http://localhost:4000/api/threat-logs?threatLevel=malicious"

# Get threats from specific IP
curl "http://localhost:4000/api/threat-logs?ip=127.0.0.1"

# Get latest 5 threats
curl "http://localhost:4000/api/threat-logs?limit=5&sort=-timestamp"

# Get with pagination
curl "http://localhost:4000/api/threat-logs?limit=10&skip=10"
```

**Expected**: Array of threat records with all fields populated

### Test 13: Threat statistics
**Steps**:
```bash
curl http://localhost:4000/api/threat-stats
```

**Expected Response**:
```json
{
  "success": true,
  "stats": {
    "total": 6,
    "byLevel": {
      "safe": 0,
      "suspicious": 1,
      "malicious": 5
    },
    "byAction": {
      "block": 5,
      "slow": 1
    },
    "topThreats": [
      { "type": "headless", "count": 4 },
      { "type": "automation", "count": 3 }
    ],
    "topAttackerIps": [
      { "ip": "127.0.0.1", "count": 6 }
    ]
  }
}
```

---

## Rate Limiting

### Test 14: Global rate limit (100 req/min)
**Steps**:
```bash
# Send 105 requests rapidly
for i in {1..105}; do
  curl http://localhost:4000/api/threat-stats &
done
wait
```

**Expected**: 
- First 100 requests: 200 OK
- Requests 101-105: 429 Too Many Requests

### Test 15: Threat analysis rate limit (20 req/min)
**Steps**:
```bash
# Send 25 threat analysis requests
for i in {1..25}; do
  curl -X POST http://localhost:4000/api/threat-analysis \
    -H "Content-Type: application/json" \
    -d '{"trigger":"rate-test","localThreatScore":50}' &
done
wait
```

**Expected**:
- First 20 requests: 200 OK
- Requests 21-25: 429 Too Many Requests

---

## Browser Session Behavior

### Test 16: Session duration tracking
**Steps**:
1. Load page at http://localhost:4000
2. Wait 30 seconds
3. Trigger threat analysis (right-click 5 times)
4. Check threat log

**Expected**:
```json
{
  "sessionDuration": 30000,  // approximately
  "timeOnPage": 5000,        // time before threat detected
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

### Test 17: Suspicious activity accumulation
**Steps**:
1. Load page
2. Right-click 3 times (3 contextMenuAttempts, +24 score)
3. Try DevTools (devtoolsOpen=true, +30 score)
4. Try copying 6 times (copies=6, +10 score)
5. Mouse stays still for 30 seconds (no mouse moves, +20 score)
6. Trigger analysis

**Expected Threat Score**: ~84 points from activities alone

---

## Error Cases

### Test 18: Invalid threat analysis request
**Steps**:
```bash
# Missing required fields
curl -X POST http://localhost:4000/api/threat-analysis \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected**: 400 Bad Request with error message

### Test 19: MongoDB unavailable
**Steps**:
1. Stop MongoDB service
2. Trigger threat analysis
3. **Expected**: 500 error, threat not logged, but API doesn't crash

**Expected Response**:
```json
{
  "success": false,
  "error": "Failed to log threat"
}
```

### Test 20: Telegram API unavailable
**Steps**:
1. Set `TELEGRAM_BOT_TOKEN` to invalid token
2. Trigger threat analysis with score >= 50
3. **Expected**: 
   - Threat still logged to MongoDB
   - Telegram notification fails silently
   - API returns `notificationSent: false`

---

## Performance Tests

### Test 21: Large threat log query
**Steps**:
1. Generate 500+ threat records
2. Query `/api/threat-logs?limit=100`
3. **Expected**: Response in < 500ms

### Test 22: Statistics aggregation
**Steps**:
1. Generate 1000+ threat records
2. Query `/api/threat-stats`
3. **Expected**: Response in < 1 second

---

## Security Tests

### Test 23: Helmet security headers
**Steps**:
```bash
curl -I http://localhost:4000 | grep -i "x-frame-options\|content-security-policy\|x-content-type-options"
```

**Expected Headers**:
- `X-Frame-Options: DENY`
- `Content-Security-Policy: ...`
- `X-Content-Type-Options: nosniff`

### Test 24: CORS configuration
**Steps**:
```bash
curl -H "Origin: http://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -I http://localhost:4000/api/threat-analysis
```

**Expected**: 
- Request allowed if origin matches CORS_ORIGIN
- Otherwise, `Access-Control-Allow-Origin` header missing

---

## Cleanup

### Reset test data
```javascript
// Clear all threat logs from MongoDB
db.threat_logs.deleteMany({})

// Or keep them for statistics analysis
db.threat_logs.countDocuments()  // Check total count
```

---

## Success Criteria Checklist

✅ = All tests in this section passing

- [ ] **Context Menu Protection** (Tests 1-2)
- [ ] **Copy Protection** (Tests 3-4)
- [ ] **DevTools Protection** (Test 5)
- [ ] **Screenshot Protection** (Tests 6-7)
- [ ] **Threat Tracking** (Tests 8-9)
- [ ] **Attack Simulation** (Tests 10-11)
- [ ] **Analytics** (Tests 12-13)
- [ ] **Rate Limiting** (Tests 14-15)
- [ ] **Session Behavior** (Tests 16-17)
- [ ] **Error Handling** (Tests 18-20)
- [ ] **Performance** (Tests 21-22)
- [ ] **Security** (Tests 23-24)

**Overall Status**: All tests passing = ✅ **ShieldAI fully operational**

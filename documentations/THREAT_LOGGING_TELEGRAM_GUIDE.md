# Threat Logging & Telegram Notification Guide

## Overview

The AgroCrown ShieldAI system includes comprehensive threat tracking with MongoDB logging and real-time Telegram Bot notifications to admin. When a threat is detected, the system logs all activity details and immediately notifies the admin via Telegram with the attacker's information and complete activity history.

## Components

### 1. ThreatLog Model (MongoDB)
**File**: `backend/models/ThreatLog.js`

Stores complete threat records with 20+ fields:

```javascript
{
  // Identity Information
  ip: String,                      // Client IP address
  userAgent: String,               // Browser user agent
  referer: String,                 // HTTP referer

  // Threat Analysis
  threatLevel: String,             // 'safe', 'suspicious', or 'malicious'
  threatScore: Number,             // 0-100 threat score
  threatType: String,              // e.g., 'bot', 'scraper', 'automation'
  reason: String,                  // Human-readable threat reason

  // Activity Counters
  mouseMoves: Number,              // Mouse movement count
  clicks: Number,                  // Click count
  scrolls: Number,                 // Scroll count
  touches: Number,                 // Touch event count
  keypresses: Number,              // Keyboard input count
  copies: Number,                  // Copy attempts
  drags: Number,                   // Drag operations
  contextMenuAttempts: Number,     // Right-click attempts

  // Behavioral Analysis Scores
  mouseRobotic: Number,            // Mouse trajectory roboticness (0-1)
  scrollRobotic: Number,           // Scroll pattern roboticness (0-1)
  keystrokeRobotic: Number,        // Keystroke timing roboticness (0-1)

  // Fingerprinting Data
  fingerprint: {
    canvas: String,
    webgl: String,
    fonts: [String],
    screen: Object,
    timezone: String,
    language: String,
    platform: String,
    hardwareConcurrency: Number
  },

  // Action Details
  actionTaken: String,             // 'allow', 'slow', 'challenge', 'block'
  targetUrl: String,               // Page that was accessed
  timestamp: Date,                 // When threat occurred
  sessionDuration: Number,         // How long they were on page (ms)
  timeOnPage: Number,              // Time before threat detected (ms)
  suspiciousEvents: [String],      // Array of suspicious activities

  // Metadata
  createdAt: Date                  // Auto-managed by MongoDB
}
```

**TTL Index**: Threats automatically deleted after 90 days
**Compound Indexes**: For fast queries by IP, threatLevel, and timestamp range

### 2. Threat Notifier (Telegram Integration)
**File**: `backend/utils/threatNotifier.js`

Three functions for different notification scenarios:

#### sendThreatNotification(threatData, adminIds)
Sends detailed threat information to admin(s):

```
📋 THREAT DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━
Threat Level: 🚫 MALICIOUS
Threat Score: 95/100
Reason: Headless browser detected, WebDriver API present, No navigator plugins

👤 Attacker Information:
IP: 192.168.1.100
User Agent: Mozilla/5.0 (Headless)...

🎯 Suspicious Activities:
- 8 context menu attempts
- 15 unauthorized copy attempts
- Honeypot trap triggered
- DevTools detected open
- Robotic mouse movements detected

📊 Behavioral Analysis:
- Mouse Pattern Score: 0.92 (highly robotic)
- Scroll Pattern Score: 0.85 (robotic)
- Keystroke Pattern Score: 0.78 (robotic)

🛡️ Protections Triggered:
- Content copy blocked
- Right-click disabled
- Page content blocked from capture

⏱️ Session Info:
- Time on Page: 2m 34s
- Session Duration: 3m 15s
- Total Suspicious Events: 12
```

**Usage**:
```javascript
const threatNotifier = require('./utils/threatNotifier');

await threatNotifier.sendThreatNotification(threatLog, [adminTelegramId]);
```

**Format**: 
- Markdown with emoji indicators
- Auto-formatted into 4096-char chunks for Telegram limits
- Includes all detected signals and behavioral scores

#### sendCriticalThreatAlert(threatData, adminIds)
Sends high-priority alert for score >= 85:

```
🚨 CRITICAL THREAT ALERT 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━
Score: 95/100
IP: 192.168.1.100
Action: IMMEDIATE BLOCKING APPLIED
```

#### sendThreatSummary(stats, adminIds)
Daily aggregate statistics:

```
📊 Daily Threat Summary (Last 24h)
━━━━━━━━━━━━━━━━━━━━━━━━━
Total Threats: 12
✅ Safe: 2
⚠️ Suspicious: 5
🚫 Malicious: 5

Top Threats:
1. Headless browser detection (3 incidents)
2. WebDriver API present (2 incidents)
3. DevTools detected (2 incidents)

Top Attacker IPs:
192.168.1.100 (5 incidents)
10.0.0.50 (3 incidents)
```

### 3. Threat Analysis Endpoint
**File**: `backend/server.js` - POST `/api/threat-analysis`

**Request**:
```javascript
{
  trigger: "interval",
  url: "https://365extra.com",
  referrer: "https://google.com",
  timeOnPage: 45000,
  
  // Activity Counters
  mouseMoves: 150,
  clicks: 25,
  scrolls: 12,
  touches: 0,
  keypresses: 0,
  copies: 8,
  drags: 3,
  contextMenuAttempts: 5,
  
  // Detections
  devtoolsOpen: true,
  headlessDetected: true,
  automationDetected: false,
  honeypotTriggered: false,
  humanInteracted: true,
  
  // Behavior Scores
  mouseRoboticScore: 0.85,
  scrollRoboticScore: 0.72,
  keyRoboticScore: 0.0,
  
  // Session
  localThreatScore: 78,
  sessionDuration: 180000,
  suspiciousEventCount: 6,
  
  fingerprint: { /* canvas, webgl, fonts, etc */ }
}
```

**Response**:
```javascript
{
  success: true,
  clientIp: "192.168.1.100",
  threatScore: 85,
  threatLevel: "malicious",
  threatType: "bot",
  reason: "Multiple detection signals: headless browser, DevTools open, robotic mouse patterns",
  actionTaken: "block",
  logged: true,
  notificationSent: true,
  details: {
    serverScore: 85,
    aiAnalyzed: false,
    signals: ["headlessDetected", "devtoolsOpen", "mouseRobotic"],
    sessionDuration: 180000
  }
}
```

### 4. Threat Retrieval Endpoints

#### GET `/api/threat-logs`
Retrieve threat history with filtering and pagination

**Query Parameters**:
```
?limit=10&skip=0&threatLevel=malicious&ip=192.168.1.100&sort=-timestamp
```

**Response**:
```javascript
{
  success: true,
  count: 5,
  threats: [
    {
      _id: "507f1f77bcf86cd799439011",
      ip: "192.168.1.100",
      threatScore: 85,
      threatLevel: "malicious",
      reason: "Headless browser detected...",
      contextMenuAttempts: 5,
      timestamp: "2024-01-15T10:30:00Z",
      // ... all other fields
    }
  ]
}
```

#### GET `/api/threat-stats`
Retrieve 7-day threat statistics

**Response**:
```javascript
{
  success: true,
  period: "7 days",
  stats: {
    total: 25,
    byLevel: {
      safe: 5,
      suspicious: 12,
      malicious: 8
    },
    byAction: {
      allow: 5,
      slow: 7,
      challenge: 5,
      block: 8
    },
    topThreats: [
      { type: "headless", count: 8 },
      { type: "webdriver", count: 6 },
      { type: "devtools", count: 4 }
    ],
    topAttackerIps: [
      { ip: "192.168.1.100", count: 8 },
      { ip: "10.0.0.50", count: 5 }
    ]
  }
}
```

## Setup Instructions

### 1. Configure Environment Variables

**File**: `backend/.env`

```bash
# Required for Telegram notifications
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklmnoPQRstuvWXYZ-12345
ADMIN_TELEGRAM_ID=987654321

# For AI-powered threat analysis (optional)
GROQ_API_KEY=your_groq_api_key_here
```

**Get Telegram Bot Token**:
1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow instructions
3. Copy the token (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

**Get Admin Telegram ID**:
1. Send a message to your bot
2. Visit `https://api.telegram.org/bot{TOKEN}/getUpdates`
3. Find your user ID in the response

### 2. MongoDB Setup

ThreatLog collection is automatically created on first threat save. No manual setup required.

Verify with:
```bash
db.threat_logs.getIndexes()
```

### 3. Test Threat Logging

**Trigger a threat manually**:
```bash
curl -X POST http://localhost:4000/api/threat-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "trigger": "test",
    "url": "http://localhost:4000",
    "headlessDetected": true,
    "devtoolsOpen": true,
    "contextMenuAttempts": 3,
    "mouseRoboticScore": 0.9,
    "localThreatScore": 85
  }'
```

**Expected Behavior**:
1. ✅ Threat saved to MongoDB
2. ✅ Telegram notification sent to ADMIN_TELEGRAM_ID
3. ✅ API response includes `logged: true` and `notificationSent: true`

### 4. View Threat Logs

**Get all threats**:
```bash
curl http://localhost:4000/api/threat-logs
```

**Filter by threat level**:
```bash
curl "http://localhost:4000/api/threat-logs?threatLevel=malicious"
```

**Filter by IP**:
```bash
curl "http://localhost:4000/api/threat-logs?ip=192.168.1.100"
```

**Get statistics**:
```bash
curl http://localhost:4000/api/threat-stats
```

## Frontend Integration

The frontend automatically sends all tracking data to the threat analysis endpoint:

```javascript
// From frontend-shield-ai.js analyzeAI()
const payload = {
  contextMenuAttempts: state.contextMenuAttempts,  // ✨ New tracking
  copies: state.copies,
  drags: state.drags,
  sessionDuration: Date.now() - state.startedAt,   // ✨ New field
  suspiciousEventCount: state.suspiciousLog.length, // ✨ New field
  // ... and 20+ other data points
};
```

### Automatic AI Analysis

**Server-Side Scoring** (no cost):
- Fast pre-scoring for obvious threats
- Returns in ~10ms
- Used for headless, automation, honeypot, devtools detection

**Groq LLM Analysis** (optional):
- Triggered for ambiguous scores (11-89 range)
- Uses `llama-3.1-70b-versatile` model
- Analyzes behavior patterns in detail
- Returns detailed threat type and reasoning
- Costs ~$0.0005 per analysis

**Scoring Logic**:
```javascript
if (score < 10) {
  // Clearly safe - no AI needed
  return { threatLevel: "safe", ... };
} else if (score >= 10 && score <= 89) {
  // Ambiguous - use AI for detailed analysis
  return analyzeWithGroq(payload);
} else {
  // Clearly malicious - no AI needed
  return { threatLevel: "malicious", ... };
}
```

## Threat Levels

| Level | Score | Description | Action |
|-------|-------|-------------|--------|
| **safe** | 0-10 | Normal human user | Allow |
| **suspicious** | 11-60 | Shows some bot/automation signals | Slow/Challenge |
| **malicious** | 61-100 | Clear threat indicators | Block |

## Testing Checklist

- [ ] MongoDB threat logs created and queryable
- [ ] Telegram notifications received with complete threat details
- [ ] Context menu attempts tracked and sent to backend
- [ ] Copy blocking returns "365extras:-- permission denied --"
- [ ] Share button exceptions work (can copy from share button)
- [ ] DevTools shortcuts blocked (F12, Ctrl+Shift+I, etc.)
- [ ] Screenshot blur overlay triggers on PrintScreen
- [ ] Session duration calculated correctly
- [ ] Robotic behavior scores calculated
- [ ] /api/threat-logs returns all threats with filtering
- [ ] /api/threat-stats returns aggregated statistics
- [ ] IP extraction working for different environments
- [ ] Rate limiting enforced (100 req/min global, 20 req/min per threat endpoint)
- [ ] Helmet security headers present

## Troubleshooting

### Telegram Notifications Not Working

**Check**:
1. `TELEGRAM_BOT_TOKEN` set correctly in `.env`
2. `ADMIN_TELEGRAM_ID` is a valid Telegram user ID (number)
3. Bot can access Telegram API (internet connectivity)
4. `sendThreatNotification()` called with correct adminIds array

**Debug**:
```javascript
// In threatNotifier.js
console.log("Sending to IDs:", adminIds);
console.log("Token:", process.env.TELEGRAM_BOT_TOKEN?.substring(0, 10) + "***");
```

### Threat Not Being Logged

**Check**:
1. MongoDB connection working (`MongoDB connected:` appears in server logs)
2. ThreatLog model imported in server.js
3. `logThreatAndNotify()` called after AI analysis
4. No errors in server console

**Debug**:
```javascript
// Check MongoDB connection
db.threat_logs.countDocuments()

// Verify indexes
db.threat_logs.getIndexes()
```

### Context Menu Attempts Not Tracking

**Check**:
1. Right-click protection enabled in ShieldAI config
2. `recordSuspicious()` called with "context-menu-attempt"
3. `state.contextMenuAttempts` incremented
4. Payload includes `contextMenuAttempts` field

**Debug** (in browser console):
```javascript
// Check state
console.log(ShieldAI.getState?.());

// Manually trigger threat analysis
ShieldAI.analyzeAI?.("manual");
```

## Performance Notes

- **MongoDB Queries**: 50-100ms for threat retrieval
- **Telegram Notifications**: 500-2000ms (network dependent)
- **Groq LLM Analysis**: 1-5 seconds per request
- **TTL Index Cleanup**: Runs automatically, minimal impact

## Security Considerations

- Threat logs include IP addresses and user agents (PII)
- Consider GDPR compliance for threat data retention
- Telegram bot token is sensitive (treat as secret)
- Logs available via API with no authentication (add if needed)
- Rate limiting prevents abuse of threat analysis endpoint

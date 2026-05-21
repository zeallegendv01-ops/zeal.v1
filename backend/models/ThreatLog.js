const mongoose = require('mongoose');

const ThreatLogSchema = new mongoose.Schema(
  {
    // User identification
    ip: {
      type: String,
      required: true,
      index: true
    },
    userAgent: String,
    referer: String,
    
    // Threat classification
    threatLevel: {
      type: String,
      enum: ['safe', 'suspicious', 'malicious'],
      default: 'suspicious',
      index: true
    },
    threatScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    
    // Threat details
    threatType: String, // 'bot', 'scraper', 'automation', 'suspicious_behavior', etc.
    reason: String, // Human-readable reason for threat
    details: mongoose.Schema.Types.Mixed, // Full threat details from AI
    
    // Activity tracking
    activities: {
      mouseMoves: Number,
      clicks: Number,
      scrolls: Number,
      touches: Number,
      keypresses: Number,
      copies: Number,
      drags: Number,
      devtoolsOpen: Boolean,
      headlessDetected: Boolean,
      automationDetected: Boolean,
      honeypotTriggered: Boolean,
      contextMenuAttempts: Number
    },
    
    // Behavioral scores
    behavioralScores: {
      mouseRobotic: Number,
      scrollRobotic: Number,
      keystrokeRobotic: Number
    },
    
    // Device fingerprint
    fingerprint: {
      canvas: String,
      webgl: mongoose.Schema.Types.Mixed,
      fonts: [String],
      screen: mongoose.Schema.Types.Mixed,
      timezone: String,
      language: String,
      platform: String,
      hardwareConcurrency: Number,
      deviceMemory: Number
    },
    
    // Page/URL info
    targetUrl: String,
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    
    // Response/action taken
    actionTaken: {
      type: String,
      enum: ['allow', 'slow', 'challenge', 'block'],
      index: true
    },
    
    // Temporal tracking
    sessionDuration: Number, // ms
    timeOnPage: Number, // ms
    
    // Suspicious events log (truncated to last 20)
    suspiciousEvents: [
      {
        reason: String,
        score: Number,
        timestamp: Date
      }
    ],
    
    // Flags for follow-up
    requiresReview: {
      type: Boolean,
      default: false,
      index: true
    },
    
    // Admin notes
    adminNotes: String
  },
  {
    timestamps: true,
    collection: 'threat_logs'
  }
);

// Index for efficient querying
ThreatLogSchema.index({ ip: 1, timestamp: -1 });
ThreatLogSchema.index({ threatLevel: 1, timestamp: -1 });
ThreatLogSchema.index({ actionTaken: 1, timestamp: -1 });

// TTL index: auto-delete threat logs after 90 days
ThreatLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const ThreatLog = mongoose.model('ThreatLog', ThreatLogSchema);

module.exports = ThreatLog;

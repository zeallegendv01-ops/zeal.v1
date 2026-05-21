const axios = require('axios');

/**
 * Send threat notification to admin via Telegram
 * @param {Object} threatData - Threat information
 * @param {string} botToken - Telegram bot token
 * @param {number|string} adminId - Admin Telegram ID
 */
async function sendThreatNotification(threatData, botToken, adminId) {
  try {
    if (!botToken || !adminId) {
      console.warn('[ThreatNotifier] Telegram not configured, skipping notification');
      return;
    }

    const {
      ip,
      threatLevel,
      threatScore,
      reason,
      actionTaken,
      activities = {},
      behavioralScores = {},
      targetUrl,
      userAgent,
      threatType
    } = threatData;

    // Format threat level with emoji
    const threatEmoji = {
      'safe': '✅',
      'suspicious': '⚠️',
      'malicious': '🚫'
    }[threatLevel] || '❓';

    // Format action with emoji
    const actionEmoji = {
      'allow': '✅',
      'slow': '⏱️',
      'challenge': '🤖',
      'block': '🚫'
    }[actionTaken] || '❓';

    // Build message
    const message = `
${threatEmoji} *THREAT DETECTED*

*Threat Level:* ${threatLevel.toUpperCase()} (${threatScore}/100)
*Type:* ${threatType || 'Unknown'}
*Action Taken:* ${actionEmoji} ${actionTaken.toUpperCase()}

*Reason:*
\`${reason}\`

*Attacker Details:*
• IP Address: \`${ip}\`
• User Agent: \`${(userAgent || 'Unknown').substring(0, 80)}...\`
• Target URL: ${targetUrl || 'Unknown'}

*Suspicious Activities:*
• Mouse Movements: ${activities.mouseMoves || 0}
• Clicks: ${activities.clicks || 0}
• Scrolls: ${activities.scrolls || 0}
• Keypresses: ${activities.keypresses || 0}
• Copy Attempts: ${activities.copies || 0}
• Context Menu Attempts: ${activities.contextMenuAttempts || 0}
• Drag Operations: ${activities.drags || 0}

*Detection Signals:*
${activities.devtoolsOpen ? '• DevTools Detected ✓\n' : ''}${activities.headlessDetected ? '• Headless Browser Detected ✓\n' : ''}${activities.automationDetected ? '• Automation Framework Detected ✓\n' : ''}${activities.honeypotTriggered ? '• Honeypot Triggered ✓\n' : ''}

*Behavioral Analysis:*
• Mouse Pattern Score: ${(behavioralScores.mouseRobotic || 0).toFixed(2)}/1.0
• Scroll Pattern Score: ${(behavioralScores.scrollRobotic || 0).toFixed(2)}/1.0
• Keystroke Pattern Score: ${(behavioralScores.keystrokeRobotic || 0).toFixed(2)}/1.0

🔍 Check threat logs for full details
⏰ Timestamp: ${new Date().toISOString()}
    `;

    // Send via Telegram Bot API
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await axios.post(telegramApiUrl, {
      chat_id: adminId,
      text: message.trim(),
      parse_mode: 'Markdown'
    }, {
      timeout: 10000
    });

    console.log(`[ThreatNotifier] ✓ Threat notification sent to admin (ID: ${adminId})`);
    return response.data;
  } catch (error) {
    console.error('[ThreatNotifier] ✗ Failed to send threat notification:', error.message);
    // Don't throw - fail gracefully
    return null;
  }
}

/**
 * Send critical threat alert (requires immediate action)
 */
async function sendCriticalThreatAlert(threatData, botToken, adminIds = []) {
  try {
    if (!botToken || !adminIds.length) {
      console.warn('[ThreatNotifier] Telegram not configured for critical alerts');
      return;
    }

    const { ip, threatLevel, threatScore, reason, actionTaken } = threatData;

    const message = `
🚨 *CRITICAL THREAT ALERT* 🚨

*Status:* ${threatLevel.toUpperCase()} - SCORE ${threatScore}/100

${actionTaken === 'block' ? '✅ USER HAS BEEN BLOCKED' : '⚠️ ACTION: ' + actionTaken.toUpperCase()}

*Threat:* ${reason}
*Attacker IP:* \`${ip}\`

⚡ Immediate Review Required
    `;

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    // Send to all admin IDs
    for (const adminId of adminIds) {
      try {
        await axios.post(telegramApiUrl, {
          chat_id: adminId,
          text: message.trim(),
          parse_mode: 'Markdown'
        }, {
          timeout: 5000
        });
        console.log(`[ThreatNotifier] ✓ Critical alert sent to admin ${adminId}`);
      } catch (e) {
        console.error(`[ThreatNotifier] Failed to send to admin ${adminId}:`, e.message);
      }
    }
  } catch (error) {
    console.error('[ThreatNotifier] Critical alert failed:', error.message);
  }
}

/**
 * Send daily threat summary to admin
 */
async function sendThreatSummary(threatStats, botToken, adminId) {
  try {
    if (!botToken || !adminId) return;

    const {
      totalThreats = 0,
      maliciousCount = 0,
      suspiciousCount = 0,
      blockedCount = 0,
      topThreats = [],
      topIPs = []
    } = threatStats;

    const message = `
📊 *Daily Threat Summary*

Total Threats: ${totalThreats}
🚫 Malicious: ${maliciousCount}
⚠️ Suspicious: ${suspiciousCount}
🛑 Blocked: ${blockedCount}

${topThreats.length > 0 ? `*Top Threat Types:*\n${topThreats.map(t => `• ${t.type}: ${t.count}`).join('\n')}\n` : ''}${topIPs.length > 0 ? `*Top Attacker IPs:*\n${topIPs.map(ip => `• ${ip.ip}: ${ip.count} attempts`).join('\n')}` : ''}

⏰ Generated: ${new Date().toISOString()}
    `;

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    await axios.post(telegramApiUrl, {
      chat_id: adminId,
      text: message.trim(),
      parse_mode: 'Markdown'
    }, {
      timeout: 10000
    });

    console.log('[ThreatNotifier] ✓ Daily summary sent');
  } catch (error) {
    console.error('[ThreatNotifier] Daily summary failed:', error.message);
  }
}

module.exports = {
  sendThreatNotification,
  sendCriticalThreatAlert,
  sendThreatSummary
};

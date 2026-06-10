import ShieldAI from '/frontend-shield-ai.js';
  
  // Initialize ShieldAI with custom configuration
  document.addEventListener('DOMContentLoaded', () => {
  ShieldAI.init({
    apiEndpoint: '/api/threat-analysis',
    redirectUrl: '/blocked',
    aiEnabled: true,
    debug: true,
    dryRun: false,
    clearPageOnBlock: true,
    
    // Protections
    blockRightClick: true,
    disableCopy: true,
    disableDrag: true,
    disableTextSelection: true,
    blockShortcuts: true,
    enableScreenshotBlur: true,
    disableContextMenu: true,
    
    // Detection
    detectDevTools: true,
    detectHeadless: true,
    detectAutomation: true,
    fingerprint: true,
    
    // Behavioral tracking
    trackMouse: true,
    trackKeyboard: true,
    trackScroll: false,
    trackTouch: true,
    humanTimeout: 8000,
    allowTouchDevices: true,
    
    // Thresholds
    immediateAnalysisThreshold: 95,
    autoBlockThreshold: 100,
    aiAnalysisInterval: 30000,
    onSuspiciousAction: "log",
    onBlockAction: "log",
    
    // Custom callbacks 
    onBlock: (reason, score) => {
      console.warn(`[365extra] Blocked: ${reason} (score: ${score})`);
    },
    onSuspicious: (reason, score) => {
      console.warn(`[365extra] Suspicious: ${reason} (score: ${score})`);
    }
  });

  console.log('[365extra] ShieldAI module imported and init called');
});

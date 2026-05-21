// =============================================================================
// FRONTEND SHIELD AI — Enhanced Edition for AgroCrown
// =============================================================================
//
// Production-grade bot/scraper/threat detection module with:
// - Copy protection (365extras:-- permission denied --)
// - Screenshot blur protection
// - Context menu disable
// - All advanced detection features

const ShieldAI = (() => {

// ===========================================================================
// SECTION 1 — CONFIGURATION
// ===========================================================================

const DEFAULTS = {
  // Backend endpoint for AI analysis
  apiEndpoint: "/api/threat-analysis",
  
  // Where to redirect blocked users
  redirectUrl: "/blocked",
  
  // Enable AI backend scoring
  aiEnabled: true,
  
  // Log everything, take no action (safe for staging)
  dryRun: false,
  
  // Enable console logging
  debug: false,
  
  // Wipe page content on block (prevents scraping during redirect)
  clearPageOnBlock: true,
  
  // ── Protections ──────────────────────────────────────────────────────────
  blockRightClick: true,
  disableCopy: true,
  disableDrag: true,
  disableTextSelection: true,
  blockShortcuts: true,
  enableScreenshotBlur: true,
  disableContextMenu: true,
  
  // ── Detection ─────────────────────────────────────────────────────────────
  detectDevTools: true,
  detectHeadless: true,
  detectAutomation: true,
  fingerprint: true,
  
  // ── Behavioral ───────────────────────────────────────────────────────────
  trackMouse: true,
  trackKeyboard: true,
  trackScroll: true,
  trackTouch: true,
  
  // Milliseconds before flagging zero interaction (non-mobile)
  humanTimeout: 8000,
  
  // Allow touch-only devices to skip mouse interaction check
  allowTouchDevices: true,
  
  // ── Scoring thresholds ───────────────────────────────────────────────────
  immediateAnalysisThreshold: 60,
  autoBlockThreshold: 85,
  aiAnalysisInterval: 15000,
  
  // ── DevTools detection ───────────────────────────────────────────────────
  devtoolsSizeThreshold: 160,
  devtoolsTimingThreshold: 100,
  
  // ── Actions ──────────────────────────────────────────────────────────────
  onSuspiciousAction: "warn",
  onBlockAction: "redirect",
  
  // ── Callbacks ────────────────────────────────────────────────────────────
  onSuspicious: null,
  onChallenge: null,
  onBlock: null
};

let cfg = {};

// ===========================================================================
// SECTION 2 — STATE
// ===========================================================================

const state = {
  startedAt: Date.now(),
  blocked: false,
  challenged: false,
  
  // Interaction counters
  mouseMoves: 0,
  clicks: 0,
  scrolls: 0,
  touches: 0,
  keypresses: 0,
  copies: 0,
  drags: 0,
  contextMenuAttempts: 0,
  
  // Detection flags
  devtoolsOpen: false,
  headlessDetected: false,
  automationDetected: false,
  honeypotTriggered: false,
  humanInteracted: false,
  
  // Behavioral data
  mouseTrajectory: [],
  scrollEvents: [],
  keystrokeDwells: [],
  keystrokeFlights: [],
  lastKeyDown: null,
  lastKeyDownTime: null,
  
  // Event timeline (capped at 1000)
  timeline: [],
  
  // Suspicious events log
  suspiciousLog: [],
  
  // AI result history
  aiResults: [],
  
  // Computed fingerprint
  fingerprint: null,
  
  // Share button reference
  shareButtonElement: null
};

// ===========================================================================
// SECTION 3 — UTILITIES
// ===========================================================================

function log(...args) {
  if (cfg.debug) console.log("[ShieldAI]", ...args);
}

function now() {
  return performance.now ? Math.round(performance.now()) : Date.now();
}

function timestamp() {
  return Date.now();
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function pushTimeline(type, meta = {}) {
  state.timeline.push({ type, t: now(), ...meta });
  if (state.timeline.length > 1000) state.timeline.shift();
}

function recordSuspicious(reason, score = 0) {
  const entry = { reason, score, t: timestamp() };
  state.suspiciousLog.push(entry);
  
  // Track context menu attempts specifically
  if (reason === "context-menu-attempt") {
    state.contextMenuAttempts++;
  }
  
  log("⚠ Suspicious:", reason, `(+${score})`);
  if (typeof cfg.onSuspicious === "function") {
    cfg.onSuspicious(reason, localThreatScore());
  }
}

// ===========================================================================
// SECTION 4 — ACTIONS
// ===========================================================================

function executeAction(actionName, reason, score) {
  if (state.blocked) return;

  switch (actionName) {
    case "log":
      log(`Action=log reason=${reason} score=${score}`);
      break;

    case "warn":
      console.warn(`[ShieldAI] Suspicious activity detected: ${reason}`);
      break;

    case "challenge":
      triggerChallenge(reason, score);
      break;

    case "redirect":
      triggerBlock(reason, score);
      break;

    case "blank":
      document.body.innerHTML =
        "<div style='font:14px monospace;padding:40px'>Access denied.</div>";
      state.blocked = true;
      break;

    default:
      log("Unknown action:", actionName);
  }
}

function triggerChallenge(reason, score) {
  if (state.challenged || state.blocked) return;

  state.challenged = true;

  log("Challenge triggered:", reason, score);

  if (typeof cfg.onChallenge === "function") {
    cfg.onChallenge(reason, score);
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "__shield_challenge__";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:2147483647;
    background:rgba(0,0,0,0.85);display:flex;
    align-items:center;justify-content:center;
    font-family:monospace;
  `;
  overlay.innerHTML = `
    <div style="background:#fff;padding:40px 48px;border-radius:8px;
    max-width:420px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.4)">
    <div style="font-size:36px;margin-bottom:16px">🤖</div>
    <h2 style="margin:0 0 8px;font-size:20px">Verify you're human</h2>
    <p style="color:#555;font-size:14px;margin:0 0 24px">
      Unusual activity was detected on your session.<br>
      <small style="color:#999">Reason: ${reason}</small>
    </p>
    <button id="__shield_verify__" style="
    background:#111;color:#fff;border:none;padding:12px 28px;
    border-radius:4px;font-size:15px;cursor:pointer;width:100%">
      I'm not a robot
    </button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("__shield_verify__")
    .addEventListener("click", () => {
      overlay.remove();
      state.challenged = false;
    });
}

function triggerBlock(reason, score) {
  if (state.blocked) return;

  state.blocked = true;

  log("🚫 Blocked:", reason, score);

  if (typeof cfg.onBlock === "function") {
    cfg.onBlock(reason, score);
  }

  if (cfg.dryRun) {
    log("[DRY RUN] Would redirect to", cfg.redirectUrl, "reason:", reason);
    return;
  }

  if (cfg.clearPageOnBlock) {
    document.body.innerHTML = "";
  }

  location.href = `${cfg.redirectUrl}?reason=${encodeURIComponent(reason)}&score=${score}`;
}

function handleThreat(reason, localScore) {
  const score = clamp(localScore, 0, 100);

  recordSuspicious(reason, score);

  if (cfg.dryRun) {
    log("[DRY RUN] Threat:", reason, "Score:", score);
    return;
  }

  if (score >= cfg.autoBlockThreshold) {
    executeAction(cfg.onBlockAction, reason, score);
    return;
  }

  if (score >= cfg.immediateAnalysisThreshold) {
    analyzeAI("immediate-threshold");
  }

  executeAction(cfg.onSuspiciousAction, reason, score);
}

// ===========================================================================
// SECTION 5 — PROTECTIONS (Right-click, Copy, Drag, Selection, Shortcuts)
// ===========================================================================

function initProtections() {
  // Find and store share button reference to allow proper sharing
  const shareButtons = document.querySelectorAll('[data-action="share"], .share-btn, [title="Share"]');
  if (shareButtons.length > 0) {
    state.shareButtonElement = shareButtons[0];
  }

  if (cfg.blockRightClick) {
    // Use capture phase to intercept BEFORE other handlers
    document.addEventListener("contextmenu", e => {
      // Allow right-click ONLY on share button
      const isShareButton = state.shareButtonElement && 
        (e.target === state.shareButtonElement || 
         state.shareButtonElement.contains(e.target) ||
         e.target.closest('[data-action="share"]') ||
         e.target.closest('.share-btn') ||
         e.target.closest('[title="Share"]'));
      
      if (!isShareButton) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        recordSuspicious("context-menu-attempt", 8);
      }
    }, true);
  }

  if (cfg.disableCopy) {
    document.addEventListener("copy", e => {
      // Check if this is from a share action by checking if share button is active
      const isShareAction = state.shareButtonElement && 
        (document.activeElement === state.shareButtonElement || 
         state.shareButtonElement.contains(document.activeElement));
      
      if (!isShareAction) {
        e.preventDefault();
        e.clipboardData.setData("text/plain", "365extras:-- permission denied --");
      }
      state.copies++;
      if (!isShareAction) {
        recordSuspicious("copy-attempt", state.copies > 3 ? 10 : 2);
      }
    }, true);

    document.addEventListener("cut", e => {
      const isShareAction = state.shareButtonElement && 
        (document.activeElement === state.shareButtonElement || 
         state.shareButtonElement.contains(document.activeElement));
      
      if (!isShareAction) {
        e.preventDefault();
        e.clipboardData.setData("text/plain", "365extras:-- permission denied --");
        recordSuspicious("cut-attempt", 2);
      }
    }, true);
  }

  if (cfg.disableDrag) {
    document.addEventListener("dragstart", e => {
      e.preventDefault();
      e.stopPropagation();
      state.drags++;
      recordSuspicious("drag-attempt", 3);
    }, true);
  }

  if (cfg.disableTextSelection) {
    const s = document.createElement("style");
    s.textContent = `*{user-select:none!important;-webkit-user-select:none!important;}`;
    document.head.appendChild(s);
  }

  if (cfg.blockShortcuts) {
    document.addEventListener("keydown", e => {
      const key = (e.key || "").toLowerCase();

      const isDevToolsKey =
        key === "f12" ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c", "k"].includes(key)) ||
        (e.metaKey && e.altKey && ["i", "j", "c"].includes(key));

      if (isDevToolsKey) {
        e.preventDefault();
        e.stopPropagation();
        recordSuspicious("devtools-shortcut", 20);
        return false;
      }

      const isSourceKey = e.ctrlKey && ["u", "s", "p"].includes(key);

      if (isSourceKey) {
        e.preventDefault();
        e.stopPropagation();
        recordSuspicious("source-shortcut", 10);
        return false;
      }
    }, true);
  }

  if (cfg.disableContextMenu) {
    const blockContextMenu = e => {
      const isShareButton = state.shareButtonElement && 
        (e.target === state.shareButtonElement || 
         state.shareButtonElement.contains(e.target) ||
         e.target.closest('[data-action="share"]') ||
         e.target.closest('.share-btn') ||
         e.target.closest('[title="Share"]'));

      if (!isShareButton) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        recordSuspicious("context-menu-attempt", 8);
        return false;
      }
    };

    document.addEventListener("contextmenu", blockContextMenu, { capture: true, passive: false });
    window.addEventListener("contextmenu", blockContextMenu, { capture: true, passive: false });
    document.documentElement.addEventListener("contextmenu", blockContextMenu, { capture: true, passive: false });
    if (document.body) {
      document.body.addEventListener("contextmenu", blockContextMenu, { capture: true, passive: false });
    }
    document.oncontextmenu = () => false;
    if (document.body) document.body.oncontextmenu = () => false;
    window.oncontextmenu = () => false;
  }
}

// ===========================================================================
// SECTION 6 — SCREENSHOT BLUR PROTECTION
// ===========================================================================

function initScreenshotBlur() {
  if (!cfg.enableScreenshotBlur) return;

  // Method 1: Detect print screen and apply blur
  const blurOverlay = document.createElement("div");
  blurOverlay.id = "__shield_blur_overlay__";
  blurOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(
      45deg,
      rgba(0, 0, 0, 0.05),
      rgba(0, 0, 0, 0.05) 10px,
      rgba(128, 128, 128, 0.05) 10px,
      rgba(128, 128, 128, 0.05) 20px
    );
    pointer-events: none;
    z-index: 999999;
    display: none;
    opacity: 0.5;
  `;
  document.body.appendChild(blurOverlay);

  // Detect print screen key (PrintScreen)
  document.addEventListener("keydown", e => {
    const key = (e.key || '').toLowerCase();
    const screenshotShortcut =
      e.key === "PrintScreen" ||
      (e.metaKey && e.shiftKey && key === '4') ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 's');

    if (screenshotShortcut) {
      enableVisualBlur();
      recordSuspicious("screenshot-attempt", 15);
    }
  }, true);

  document.addEventListener("keyup", e => {
    if (e.key === "PrintScreen" || e.key.toLowerCase() === 's') {
      setTimeout(() => {
        disableVisualBlur();
      }, 200);
    }
  }, true);

  const enableVisualBlur = () => {
    blurOverlay.style.display = "block";
    document.documentElement.style.filter = "blur(14px) brightness(0.9)";
    document.documentElement.style.transition = "filter 0.2s ease";
  };

  const disableVisualBlur = () => {
    blurOverlay.style.display = "none";
    document.documentElement.style.filter = "";
  };

  window.addEventListener("blur", () => {
    enableVisualBlur();
    recordSuspicious("window-blur", 10);
  });

  window.addEventListener("focus", () => {
    disableVisualBlur();
  });

  window.addEventListener("beforeprint", () => {
    enableVisualBlur();
    recordSuspicious("before-print", 10);
  });

  window.addEventListener("afterprint", () => {
    disableVisualBlur();
  });

  // Method 2: Monitor clipboard for image content (screenshot capture)
  document.addEventListener("paste", e => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.includes("image")) {
        log("⚠ Screenshot detected via clipboard");
        recordSuspicious("screenshot-clipboard", 20);
        // Show blur overlay momentarily
        blurOverlay.style.display = "block";
        setTimeout(() => {
          blurOverlay.style.display = "none";
        }, 500);
      }
    }
  }, true);

  // Method 3: Apply CSS filter to make page blurry when visibility changes (screen lock, alt-tab, etc)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      log("Page hidden - potential screenshot");
      recordSuspicious("visibility-hidden", 10);
    }
  });

  // Method 4: Monitor for screen capture via canvas/WebGL
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const originalToDataURL = canvas.toDataURL;
      canvas.toDataURL = function(...args) {
        log("⚠ Canvas export detected");
        recordSuspicious("canvas-export", 25);
        return originalToDataURL.apply(this, args);
      };
    }
  } catch (e) {
    // Ignore canvas monitoring errors
  }
}

// ===========================================================================
// SECTION 7 — BEHAVIORAL TRACKING
// ===========================================================================

function initBehaviorTracking() {
  if (cfg.trackMouse) {
    document.addEventListener("mousemove", e => {
      state.mouseMoves++;
      state.humanInteracted = true;

      if (state.mouseMoves % 5 === 0) {
        state.mouseTrajectory.push({ x: e.clientX, y: e.clientY, t: now() });
        if (state.mouseTrajectory.length > 200) state.mouseTrajectory.shift();
      }

      pushTimeline("mousemove");
    }, { passive: true });

    document.addEventListener("click", e => {
      state.clicks++;
      state.humanInteracted = true;
      pushTimeline("click", { x: e.clientX, y: e.clientY });
    }, { passive: true });
  }

  if (cfg.trackKeyboard) {
    document.addEventListener("keydown", e => {
      const t = now();

      state.keypresses++;
      state.humanInteracted = true;

      if (state.lastKeyDownTime !== null) {
        const flight = t - state.lastKeyDownTime;
        if (flight < 3000) {
          state.keystrokeFlights.push(flight);
          if (state.keystrokeFlights.length > 100) state.keystrokeFlights.shift();
        }
      }

      state.lastKeyDown = e.key;
      state.lastKeyDownTime = t;

      pushTimeline("keydown", { key: e.key });
    }, { passive: true });

    document.addEventListener("keyup", e => {
      const t = now();

      if (state.lastKeyDownTime !== null && e.key === state.lastKeyDown) {
        const dwell = t - state.lastKeyDownTime;
        if (dwell >= 0 && dwell < 2000) {
          state.keystrokeDwells.push(dwell);
          if (state.keystrokeDwells.length > 100) state.keystrokeDwells.shift();
        }
      }
    }, { passive: true });
  }

  if (cfg.trackScroll) {
    document.addEventListener("scroll", () => {
      state.scrolls++;
      state.scrollEvents.push({ y: window.scrollY, t: now() });
      if (state.scrollEvents.length > 100) state.scrollEvents.shift();
      pushTimeline("scroll");
    }, { passive: true });
  }

  if (cfg.trackTouch) {
    document.addEventListener("touchstart", () => {
      state.touches++;
      state.humanInteracted = true;
      pushTimeline("touch");
    }, { passive: true });
  }
}

// ===========================================================================
// SECTION 8 — BEHAVIORAL ANALYSIS
// ===========================================================================

function analyzeMouseTrajectory() {
  const pts = state.mouseTrajectory;
  if (pts.length < 10) return 0;

  let totalDeviation = 0;

  const start = pts[0];
  const end = pts[pts.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const deviation = Math.abs(dx * (start.y - p.y) - dy * (start.x - p.x)) / len;
    totalDeviation += deviation;
  }

  const avgDeviation = totalDeviation / pts.length;

  if (avgDeviation < 2) return 1.0;
  if (avgDeviation < 5) return 0.7;
  if (avgDeviation < 8) return 0.3;
  return 0;
}

function analyzeScrollPattern() {
  const evts = state.scrollEvents;
  if (evts.length < 5) return 0;

  const deltas = [];
  for (let i = 1; i < evts.length; i++) {
    deltas.push(evts[i].t - evts[i - 1].t);
  }

  const minD = Math.min(...deltas);
  const maxD = Math.max(...deltas);

  if (maxD - minD < 3) return 1.0;
  if (maxD - minD < 10) return 0.5;
  return 0;
}

function analyzeKeystrokes() {
  const flights = state.keystrokeFlights;
  if (flights.length < 5) return 0;

  const avg = flights.reduce((a, b) => a + b, 0) / flights.length;
  const variance = flights.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / flights.length;
  const stddev = Math.sqrt(variance);

  if (stddev < 5) return 1.0;
  if (stddev < 20) return 0.5;
  return 0;
}

// ===========================================================================
// SECTION 9 — DEVTOOLS DETECTION
// ===========================================================================

function initDevToolsDetection() {
  let alreadyDetected = false;

  function onDetected(method) {
    if (alreadyDetected) return;
    alreadyDetected = true;
    state.devtoolsOpen = true;
    handleThreat(`devtools-${method}`, 55);
  }

  setInterval(() => {
    const wGap = window.outerWidth - window.innerWidth;
    const hGap = window.outerHeight - window.innerHeight;
    if (wGap > cfg.devtoolsSizeThreshold || hGap > cfg.devtoolsSizeThreshold) {
      onDetected("size-gap");
    }
  }, 1500);

  setInterval(() => {
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const elapsed = performance.now() - start;
    if (elapsed > cfg.devtoolsTimingThreshold) {
      onDetected("timing");
    }
  }, 3000);

  const el = new Image();
  Object.defineProperty(el, "id", {
    get() { onDetected("console-read"); }
  });
  setInterval(() => {
    if (!state.devtoolsOpen) console.log(el);
  }, 5000);
}

// ===========================================================================
// SECTION 10 — HEADLESS & AUTOMATION DETECTION
// ===========================================================================

function detectHeadlessAndAutomation() {
  const signals = [];

  if (navigator.webdriver) signals.push("webdriver");
  if (window.document.__selenium_unwrapped) signals.push("selenium-unwrapped");
  if (window.__selenium_evaluate) signals.push("selenium-evaluate");
  if (window.__webdriverFunc) signals.push("webdriver-func");
  if (window.__driver_evaluate) signals.push("driver-evaluate");
  if (window._phantom) signals.push("phantom");
  if (window.callPhantom) signals.push("call-phantom");
  if (window.__nightmare) signals.push("nightmare");

  if (navigator.userAgent.includes("HeadlessChrome")) signals.push("headless-chrome-ua");
  if (navigator.userAgent.includes("Electron")) signals.push("electron-ua");
  if (window.chrome && !window.chrome.runtime) signals.push("chrome-no-runtime");

  if (!navigator.languages || navigator.languages.length === 0) signals.push("no-languages");
  if (navigator.plugins.length === 0) signals.push("no-plugins");
  if (typeof window.outerWidth === "undefined") signals.push("no-outer-width");

  if (screen.width === 0 || screen.height === 0) signals.push("zero-screen");
  if (screen.colorDepth < 24) signals.push("low-color-depth");

  if (navigator.permissions) {
    navigator.permissions.query({ name: "notifications" })
      .then(p => {
        if (p.state === "denied" && Notification.permission === "default") {
          handleThreat("permissions-anomaly", 40);
        }
      })
      .catch(() => {});
  }

  if (signals.length > 0) {
    state.headlessDetected = true;
    state.automationDetected = true;
    const score = clamp(signals.length * 20, 0, 100);
    handleThreat(`automation(${signals.slice(0, 3).join(",")})`, score);
    log("Automation signals:", signals);
  }
}

// ===========================================================================
// SECTION 11 — HUMAN INTERACTION VALIDATION
// ===========================================================================

function initHumanValidation() {
  setTimeout(() => {
    const isMobile = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);

    if (!state.humanInteracted && !(isMobile && cfg.allowTouchDevices)) {
      handleThreat("no-human-interaction", 45);
    }
  }, cfg.humanTimeout);
}

// ===========================================================================
// SECTION 12 — HONEYPOT
// ===========================================================================

function initHoneypot() {
  const input = document.createElement("input");
  input.type = "text";
  input.name = "email_confirm";
  input.autocomplete = "off";
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  input.style.cssText = `
    position:absolute;left:-9999px;top:-9999px;
    height:0;width:0;overflow:hidden;opacity:0;pointer-events:none;
  `;
  document.body.appendChild(input);

  input.addEventListener("input", () => {
    state.honeypotTriggered = true;
    handleThreat("honeypot-input", 90);
  });

  const link = document.createElement("a");
  link.href = "#__trap__";
  link.setAttribute("aria-hidden", "true");
  link.tabIndex = -1;
  link.style.cssText = input.style.cssText;
  link.textContent = "sitemap";
  document.body.appendChild(link);

  link.addEventListener("click", e => {
    e.preventDefault();
    state.honeypotTriggered = true;
    handleThreat("honeypot-link", 90);
  });
}

// ===========================================================================
// SECTION 13 — FINGERPRINTING
// ===========================================================================

async function buildFingerprint() {
  const fp = {};

  fp.userAgent = navigator.userAgent;
  fp.language = navigator.language;
  fp.languages = [...(navigator.languages || [])];
  fp.platform = navigator.platform;
  fp.hardwareConcurrency = navigator.hardwareConcurrency;
  fp.deviceMemory = navigator.deviceMemory;
  fp.doNotTrack = navigator.doNotTrack;
  fp.cookieEnabled = navigator.cookieEnabled;
  fp.pluginCount = navigator.plugins.length;

  fp.screen = {
    w: screen.width,
    h: screen.height,
    depth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio
  };

  fp.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  fp.tzOffset = new Date().getTimezoneOffset();

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 200;
    canvas.height = 40;
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 200, 40);
    ctx.fillStyle = "#069";
    ctx.fillText("AgroCrown🔐", 2, 2);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("AgroCrown🔐", 4, 4);
    fp.canvas = canvas.toDataURL().slice(-64);
  } catch {
    fp.canvas = null;
  }

  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      fp.webgl = {
        vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
      };
    }
  } catch {
    fp.webgl = null;
  }

  try {
    const AudioCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx(1, 44100, 44100);
      const osc = ctx.createOscillator();
      const comp = ctx.createDynamicsCompressor();
      osc.connect(comp);
      comp.connect(ctx.destination);
      osc.start(0);
      await ctx.startRendering();
      fp.audio = "supported";
      osc.disconnect();
      comp.disconnect();
    }
  } catch {
    fp.audio = null;
  }

  const testFonts = [
    "Arial", "Helvetica", "Times New Roman", "Courier New",
    "Georgia", "Palatino", "Garamond", "Comic Sans MS",
    "Trebuchet MS", "Verdana", "Impact", "Tahoma"
  ];

  const canvas2 = document.createElement("canvas");
  const ctx2 = canvas2.getContext("2d");
  const baseFonts = ["monospace", "sans-serif", "serif"];
  const testStr = "mmmmmmmmmmlli";
  const testSize = "72px";

  const getWidth = font => {
    ctx2.font = `${testSize} ${font}`;
    return ctx2.measureText(testStr).width;
  };

  const baseWidths = {};
  baseFonts.forEach(f => { baseWidths[f] = getWidth(f); });

  fp.fonts = testFonts.filter(font =>
    baseFonts.some(base => getWidth(`${font},${base}`) !== baseWidths[base])
  );

  state.fingerprint = fp;
  log("Fingerprint built:", fp);
}

// ===========================================================================
// SECTION 14 — LOCAL THREAT SCORING
// ===========================================================================

function localThreatScore() {
  let score = 0;

  if (state.headlessDetected) score += 50;
  if (state.automationDetected) score += 40;
  if (state.honeypotTriggered) score += 60;
  if (state.devtoolsOpen) score += 30;

  if (state.mouseMoves === 0 && state.touches === 0) score += 20;
  if (state.copies > 5) score += 10;
  if (state.contextMenuAttempts > 2) score += 15;
  if (state.drags > 3) score += 10;

  score += Math.round(analyzeMouseTrajectory() * 20);
  score += Math.round(analyzeScrollPattern() * 15);
  score += Math.round(analyzeKeystrokes() * 15);

  if (state.suspiciousLog.length > 10) score += 15;
  if (state.suspiciousLog.length > 20) score += 15;

  return clamp(Math.round(score), 0, 100);
}

// ===========================================================================
// SECTION 15 — AI BACKEND ANALYSIS
// ===========================================================================

let _aiPending = false;

async function analyzeAI(trigger = "interval") {
  if (!cfg.aiEnabled || _aiPending || state.blocked) return;

  _aiPending = true;

  try {
    const score = localThreatScore();

    const payload = {
      trigger,
      url: location.href,
      referrer: document.referrer,
      timeOnPage: Date.now() - state.startedAt,

      mouseMoves: state.mouseMoves,
      clicks: state.clicks,
      scrolls: state.scrolls,
      touches: state.touches,
      keypresses: state.keypresses,
      copies: state.copies,
      drags: state.drags,
      contextMenuAttempts: state.contextMenuAttempts,

      devtoolsOpen: state.devtoolsOpen,
      headlessDetected: state.headlessDetected,
      automationDetected: state.automationDetected,
      honeypotTriggered: state.honeypotTriggered,
      humanInteracted: state.humanInteracted,

      mouseRoboticScore: analyzeMouseTrajectory(),
      scrollRoboticScore: analyzeScrollPattern(),
      keyRoboticScore: analyzeKeystrokes(),

      recentSuspicious: state.suspiciousLog.slice(-10),

      localThreatScore: score,

      fingerprint: state.fingerprint,
      
      // Include session metadata for better tracking
      sessionDuration: Date.now() - state.startedAt,
      suspiciousEventCount: state.suspiciousLog.length
    };

    log("Sending AI payload, trigger:", trigger, "localScore:", score);

    const res = await fetch(cfg.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const result = await res.json();

    state.aiResults.push({ ...result, t: timestamp() });

    log("AI result:", result);

    handleAIResult(result);
  } catch (err) {
    log("AI analysis error:", err.message);
  } finally {
    _aiPending = false;
  }
}

function handleAIResult(result) {
  if (!result || typeof result.action !== "string") return;

  switch (result.action.toLowerCase()) {
    case "block":
      executeAction(cfg.onBlockAction, result.reason || "ai-block", result.score || 100);
      break;

    case "challenge":
      triggerChallenge(result.reason || "ai-challenge", result.score || 70);
      break;

    case "slow":
      recordSuspicious("ai-throttle", result.score || 50);
      break;

    case "allow":
      log("AI: allow");
      break;

    default:
      log("AI: unknown action:", result.action);
  }
}

function updateShieldAIStatus(message) {
  const badge = document.getElementById('shieldAiStatus');
  if (badge) badge.textContent = message;
}

// ===========================================================================
// SECTION 16 — INIT
// ===========================================================================

async function init(userConfig = {}) {
  cfg = { ...DEFAULTS, ...userConfig };

  log("Initializing ShieldAI v2 for AgroCrown");

  if (cfg.fingerprint) {
    buildFingerprint().catch(() => {});
  }

  initProtections();

  initBehaviorTracking();

  initScreenshotBlur();

  if (cfg.detectDevTools) {
    initDevToolsDetection();
  }

  if (cfg.detectHeadless || cfg.detectAutomation) {
    detectHeadlessAndAutomation();
  }

  initHumanValidation();

  initHoneypot();

  if (cfg.aiEnabled && cfg.aiAnalysisInterval > 0) {
    setInterval(() => analyzeAI("interval"), cfg.aiAnalysisInterval);
  }

  log("ShieldAI ready");
  updateShieldAIStatus(cfg.aiEnabled ? "ShieldAI active" : "ShieldAI initialized (AI disabled)");
}

// ===========================================================================
// SECTION 17 — PUBLIC API
// ===========================================================================

return {
  init,
  state,
  analyzeAI,
  localThreatScore,
  triggerChallenge,
  triggerBlock
};

})();

export default ShieldAI;

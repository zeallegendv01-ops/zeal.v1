/*  PWA SERVICE WORKER & INSTALL PROMPT  */

// Dynamic API Base URL
let API_BASE_URL;
const host = window.location.hostname;
const protocol = window.location.protocol;
const port = window.location.port;

if (protocol === 'file:') {
  API_BASE_URL = 'http://localhost:4000/api';
  console.warn('[WARN] Running from file://, defaulting API_BASE_URL to', API_BASE_URL);
} else if (host === 'localhost' || host === '127.0.0.1') {
  if (port === '4000') {
    API_BASE_URL = `${protocol}//${host}:${port}/api`;
  } else {
    API_BASE_URL = `http://localhost:4000/api`;
    console.warn('[WARN] Local dev frontend origin detected, using backend at', API_BASE_URL);
  }
} else {
  API_BASE_URL = `${protocol}//${window.location.host}/api`;
}

console.log('[DEBUG] API_BASE_URL:', API_BASE_URL);

// Global settings object - will be populated from API
let appSettings = {
  taxRate: 10,        // Default fallback
  shippingFee: 2500   // Default fallback
};

let heroPlaylist = [];
let heroCurrentVideoIndex = 0;
let lastHeroVideosJson = ''; // Track playlist changes

const DEFAULT_HERO_TITLE = 'Global Marketplace';
const DEFAULT_HERO_DESCRIPTION = 'Where premium food, real estate, drinks and lifestyle offerings come together in one curated destination for modern buyers and sellers.';
const DEFAULT_ABOUT_IMAGE = '/dist/img/download.jfif';
const DEFAULT_HERO_VIDEO_URL = '/dist/vid/1473139_People_Nature_3840x2160.mp4';

const setHeroVideoUrl = (url) => {
  const container = document.querySelector('.hero-right');
  const current = document.getElementById('heroVideo');
  const heroSection = document.querySelector('.hero');
  if (!container || !current || !heroSection) return;

  const newSrc = url || DEFAULT_HERO_VIDEO_URL;
  const resolvedNewSrc = new URL(newSrc, window.location.origin).href;
  const shouldLoop = heroPlaylist.length <= 1;
  const shouldCrossfade = heroPlaylist.length > 0 && current.src !== resolvedNewSrc;

  // Ensure container has explicit height and correct positioning
  const heroHeight = heroSection.clientHeight;
  if (heroHeight > 0 && !container.style.height) {
    container.style.height = heroHeight + 'px';
  }
  if (window.getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  // If identical source or default fallback, use single player flow
  if (!shouldCrossfade) {
    current.muted = true;
    current.playsInline = true;
    current.loop = shouldLoop;
    current.autoplay = true;
    current.preload = 'metadata';
    current.crossOrigin = 'anonymous';
    current.setAttribute('playsinline', '');
    current.setAttribute('webkit-playsinline', '');
    current.setAttribute('muted', '');

    if (current.src !== resolvedNewSrc) {
      current.src = resolvedNewSrc;
      current.currentTime = 0;
      current.load();
    }

    current.play().catch((error) => {
      console.warn('[WARN] Hero video play failed:', error);
    });
    return;
  }

  // Prepare container and current element styles for crossfade
  Object.assign(current.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    transition: 'opacity 600ms ease'
  });

  // Add a subtle buffering overlay while the next video is preparing
  let bufferOverlay = container.querySelector('.hero-buffer-overlay');
  if (!bufferOverlay) {
    bufferOverlay = document.createElement('div');
    bufferOverlay.className = 'hero-buffer-overlay';
    Object.assign(bufferOverlay.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.12)',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 300ms ease',
      zIndex: 999
    });
    container.appendChild(bufferOverlay);
  }
  // show overlay
  requestAnimationFrame(() => { bufferOverlay.style.opacity = '1'; });

  // Create next video layer
  const next = document.createElement('video');
  next.preload = 'metadata';
  next.muted = true;
  next.autoplay = true;
  next.loop = shouldLoop;
  next.playsInline = true;
  next.crossOrigin = 'anonymous';
  next.setAttribute('playsinline', '');
  next.setAttribute('webkit-playsinline', '');
  next.setAttribute('muted', '');
  next.src = resolvedNewSrc;
  next.load();
  Object.assign(next.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    opacity: '0',
    transition: 'opacity 600ms ease',
    zIndex: (parseInt(current.style.zIndex, 10) || 1) + 1
  });

  // Insert next above current
  container.appendChild(next);

  const cleanup = () => {
    try { if (current && current.parentNode) current.parentNode.removeChild(current); } catch(e){}
    next.id = 'heroVideo';
    // ensure loop and autoplay are set on the new active element
    next.loop = shouldLoop;
    next.autoplay = true;
    next.muted = true;
    next.playsInline = true;
    // Reattach handlers
    next.removeEventListener('error', handleHeroVideoError);
    next.removeEventListener('ended', handleHeroVideoEnded);
    next.addEventListener('error', handleHeroVideoError);
    next.addEventListener('ended', handleHeroVideoEnded);
  };

  const startCrossfade = () => {
    // Start playing next, then crossfade
    next.play().catch(() => {});
    requestAnimationFrame(() => {
      next.style.opacity = '1';
      current.style.opacity = '0';
    });

    // Fade out and remove buffering overlay
    const overlay = container.querySelector('.hero-buffer-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => { try { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch(e){} }, 350);
    }

    // Remove old after transition
    setTimeout(() => cleanup(), 700);
  };

  // Wait until buffered enough to start smooth play
  const onCanPlay = () => {
    next.removeEventListener('canplay', onCanPlay);
    startCrossfade();
  };

  next.addEventListener('canplay', onCanPlay);
  // Fallback: if canplay doesn't fire in 3s, proceed anyway
  const fallbackTimer = setTimeout(() => {
    next.removeEventListener('canplay', onCanPlay);
    startCrossfade();
  }, 3000);
  next.addEventListener('playing', () => clearTimeout(fallbackTimer));
};

const handleHeroVideoError = (event) => {
  const heroEl = document.getElementById('heroVideo');
  if (!heroEl) return;

  console.warn('[WARN] Hero video failed to load:', heroEl.src, event);

  const failedPath = new URL(heroEl.src, window.location.origin).pathname;
  heroPlaylist = heroPlaylist.filter(video => {
    if (!video || !video.url) return false;
    try {
      return new URL(video.url, window.location.origin).pathname !== failedPath;
    } catch {
      return false;
    }
  });

  heroCurrentVideoIndex = 0;
  setHeroVideoUrl(heroPlaylist[0]?.url || '/dist/vid/1473139_People_Nature_3840x2160.mp4');
};

const handleHeroVideoEnded = () => {
  if (heroPlaylist.length <= 1) return;
  heroCurrentVideoIndex = (heroCurrentVideoIndex + 1) % heroPlaylist.length;
  setHeroVideoUrl(heroPlaylist[heroCurrentVideoIndex].url);
};

const initializeHeroPlaylist = (videos) => {
  const filteredPlaylist = Array.isArray(videos) ? videos.filter(video => video && video.url) : [];
  const newPlaylistJson = JSON.stringify(filteredPlaylist);
  
  // Only reinitialize if the playlist actually changed
  if (newPlaylistJson === lastHeroVideosJson) {
    console.log('[DEBUG] Video playlist unchanged, skipping reinitialization');
    return;
  }
  
  console.log('[DEBUG] Video playlist changed, reinitializing', filteredPlaylist.length, 'videos');
  lastHeroVideosJson = newPlaylistJson;
  heroPlaylist = filteredPlaylist;
  heroCurrentVideoIndex = 0;
  
  if (heroPlaylist.length > 0) {
    setHeroVideoUrl(heroPlaylist[0].url);
  } else {
    setHeroVideoUrl(DEFAULT_HERO_VIDEO_URL);
  }
  
  const heroEl = document.getElementById('heroVideo');
  if (heroEl) {
    // Set loop: true only if single video, false if multiple
    heroEl.loop = heroPlaylist.length <= 1;
    heroEl.autoplay = true;
    heroEl.muted = true;
    heroEl.playsInline = true;
    heroEl.removeEventListener('ended', handleHeroVideoEnded);
    heroEl.removeEventListener('error', handleHeroVideoError);
    heroEl.addEventListener('ended', handleHeroVideoEnded);
    heroEl.addEventListener('error', handleHeroVideoError);
  }
};

const applyHeroSettings = () => {
  const title = appSettings.heroTitle || DEFAULT_HERO_TITLE;
  const titleWords = title.split(' ');
  const ghost = document.querySelector('.headline .ghost');
  const solid = document.querySelector('.headline .solid');
  if (ghost) ghost.textContent = titleWords[0] || title;
  if (solid) solid.textContent = titleWords.slice(1).join(' ') || '';

  const heroSub = document.querySelector('.hero-sub');
  if (heroSub) heroSub.textContent = appSettings.heroDescription || DEFAULT_HERO_DESCRIPTION;
  
  const aboutImg = document.getElementById('aboutImage');
  if (aboutImg) {
    aboutImg.src = appSettings.aboutImageUrl || DEFAULT_ABOUT_IMAGE;
    aboutImg.style.width = '100%';
    aboutImg.style.height = '100%';
    aboutImg.style.objectFit = 'cover';
    aboutImg.style.objectPosition = 'center center';
  }
  
  // Only reinitialize playlist if videos changed (avoids interrupting playback)
  initializeHeroPlaylist(appSettings.heroVideos || []);
};

// Settings poll interval reference
let _settingsPollIntervalId = null;

// Internal: fetch settings once and apply them
async function fetchAndApplySettings() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${API_BASE_URL}/settings`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[WARN] Failed to load settings, status:', response.status);
      return null;
    }

    const result = await response.json();
    if (result && result.success && result.data) {
      const newTax = result.data.taxRate !== undefined ? result.data.taxRate : 10;
      const newShipping = result.data.shippingFee !== undefined ? result.data.shippingFee : 2500;

      const changed = (newTax !== appSettings.taxRate) || (newShipping !== appSettings.shippingFee);

      appSettings.taxRate = newTax;
      appSettings.shippingFee = newShipping;
      appSettings.heroTitle = result.data.heroTitle || DEFAULT_HERO_TITLE;
      appSettings.heroDescription = result.data.heroDescription || DEFAULT_HERO_DESCRIPTION;
      appSettings.heroVideos = Array.isArray(result.data.heroVideos) ? result.data.heroVideos : [];
      appSettings.aboutImageUrl = result.data.aboutImage?.url || '';

      if (changed) {
        console.log('[OK] Settings updated:', appSettings);
        // If cart is visible or totals are rendered, refresh display
        if (typeof updateCartDisplay === 'function') updateCartDisplay();
      }

      applyHeroSettings();

      return appSettings;
    }
  } catch (err) {
    console.warn('[WARN] Settings API call failed:', err.message);
    return null;
  }
}

// Fetch settings from backend API and start polling for changes
async function loadAppSettings() {
  await fetchAndApplySettings();

  // Start polling every 10 seconds to pick up changes made via bot/admin
  if (_settingsPollIntervalId) clearInterval(_settingsPollIntervalId);
  _settingsPollIntervalId = setInterval(fetchAndApplySettings, 10000);
}

let deferredPrompt = null;

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then(
      (registration) => {
        console.log('[OK] Service Worker registered:', registration);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      },
      (error) => console.log('[ERROR] Service Worker registration failed:', error)
    );
  });

  // Listen for beforeinstallprompt event (Android & Desktop PWAs)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPrompt();
  });
}

// Show install prompt when available
function showInstallPrompt() {
  const installButton = document.getElementById('installAppBtn');
  const mobileDownloadLink = document.getElementById('mobileDownloadLink');
  if (installButton && deferredPrompt) {
    installButton.style.display = 'flex';
    if (mobileDownloadLink) mobileDownloadLink.style.display = 'block';
    installButton.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);
        deferredPrompt = null;
        installButton.style.display = 'none';
        if (mobileDownloadLink) mobileDownloadLink.style.display = 'none';
      }
    });
  }
}

// Handle successful app installation
window.addEventListener('appinstalled', () => {
  console.log('[OK] App installed successfully!');
  deferredPrompt = null;
  const installButton = document.getElementById('installAppBtn');
  const mobileDownloadLink = document.getElementById('mobileDownloadLink');
  if (installButton) installButton.style.display = 'none';
  if (mobileDownloadLink) mobileDownloadLink.style.display = 'none';
});

/*  MODAL HELPERS  */
function openModal(id){
  const modal = document.getElementById(id);
  if(modal) modal.classList.add('open');
  document.body.style.overflow='hidden';
  if(id==='chartModal'){
    initAnalyticsOnOpen();
  }
  if(id==='cartModal'){
    loadUserAddressForCheckout();
  }
}
function closeModal(id){
  const modal = document.getElementById(id);
  if(modal) modal.classList.remove('open');
  if(!document.querySelector('.modal-backdrop.open') && !document.getElementById('searchOverlay')?.classList.contains('open'))
    document.body.style.overflow='';
}

function toggleCartSidebar(show, page = '1') {
  const sidebar = document.getElementById('cartSidebar');
  const toggleBtn = document.getElementById('cartToggleBtn');
  if (!sidebar) return;

  if (show) {
    sidebar.classList.add('active');
    document.body.style.overflow = 'hidden';
    const pages = sidebar.querySelector('.sidebar-pages');
    if (pages) pages.dataset.page = page;
    const button = sidebar.querySelector('.sidebar-page-toggle .slide-label');
    if (button) button.textContent = page === '2' ? 'Back' : 'Checkout';
    const arrow = sidebar.querySelector('.sidebar-page-toggle i');
    if (arrow) {
      arrow.classList.toggle('fa-arrow-left', page === '2');
      arrow.classList.toggle('fa-arrow-right', page !== '2');
    }
  } else {
    sidebar.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function toggleSidebar(sidebarId, show) {
  const sidebar = document.getElementById(sidebarId);
  if (!sidebar) return;
  
  if (show) {
    sidebar.classList.add('active');
    document.body.style.overflow = 'hidden';
    const pages = sidebar.querySelector('.sidebar-pages');
    if (pages) pages.dataset.page = '1';
    const button = sidebar.querySelector('.sidebar-page-toggle .slide-label');
    if (button) button.textContent = sidebarId === 'cartSidebar' ? 'Checkout' : 'View Actions';
    const arrow = sidebar.querySelector('.sidebar-page-toggle i');
    if (arrow) {
      arrow.classList.remove('fa-arrow-left');
      arrow.classList.add('fa-arrow-right');
    }
  } else {
    sidebar.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function toggleSidebarPage(sidebarId) {
  const sidebar = document.getElementById(sidebarId);
  if (!sidebar) return;
  const pages = sidebar.querySelector('.sidebar-pages');
  if (!pages) return;
  const currentPage = pages.dataset.page === '2' ? '2' : '1';
  const targetPage = currentPage === '1' ? '2' : '1';
  pages.dataset.page = targetPage;

  const buttonLabel = sidebar.querySelector('.sidebar-page-toggle .slide-label');
  if (buttonLabel) {
    if (sidebarId === 'cartSidebar') {
      buttonLabel.textContent = targetPage === '2' ? 'Back' : 'Checkout';
    } else {
      buttonLabel.textContent = targetPage === '2' ? 'Back' : 'View Actions';
    }
  }

  const arrow = sidebar.querySelector('.sidebar-page-toggle i');
  if (arrow) {
    arrow.classList.toggle('fa-arrow-right', targetPage === '1');
    arrow.classList.toggle('fa-arrow-left', targetPage === '2');
  }
}

// Close sidebars on overlay click
document.querySelectorAll('.sidebar-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      toggleSidebar(overlay.id, false);
    }
  });
});

// Handle escape key for sidebars
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.sidebar-overlay.active').forEach(overlay => {
      toggleSidebar(overlay.id, false);
    });
  }
});

document.querySelectorAll('.modal-backdrop').forEach(m=>{
  m.addEventListener('click',e=>{ if(e.target===m) closeModal(m.id); });
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    document.querySelectorAll('.modal-backdrop.open').forEach(m=>closeModal(m.id));
    closeSearch();
  }
});

/*  SCROLL TO TOP FUNCTIONALITY  */
const scrollTopBtn = document.getElementById('scrollTopBtn');

window.addEventListener('scroll', () => {
  if (window.scrollY > 300) {
    scrollTopBtn?.classList.add('show');
  } else {
    scrollTopBtn?.classList.remove('show');
  }
});

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

/*  PRODUCT & LAND CARD CLICK HANDLERS  */
function addProductCardClickHandlers() {
  document.querySelectorAll('.product-card').forEach(card => {
    if (!card.hasListener) {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.product-btn') || e.target.closest('.wrange') || e.target.closest('.card-share-btn')) {
          return; // Don't open modal if clicking "Add to Selection", slider, or share button
        }
        const productId = card.getAttribute('data-product-id');
        const product = allProducts.find(p => p._id === productId);
        if (product) {
          showProductDetails(product);
        }
      });
      card.hasListener = true;
    }
  });
}

function addLandCardClickHandlers() {
  document.querySelectorAll('.land-card').forEach(card => {
    if (!card.hasListener) {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.land-btn') || e.target.closest('.land-range') || e.target.closest('.card-share-btn')) {
          return; // Don't open modal if clicking buttons, slider, or share button
        }
        const landId = card.getAttribute('data-product-id');
        const land = allProducts.find(p => p._id === landId);
        if (land) {
          showLandDetails(land);
        }
      });
      card.hasListener = true;
    }
  });
}

function addApartmentCardClickHandlers() {
  document.querySelectorAll('.apartment-card').forEach(card => {
    if (!card.hasListener) {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.apartment-btn') || e.target.closest('.card-share-btn')) {
          return; // Don't open modal if clicking "Add to Selection" or share button
        }
        const apartmentId = card.getAttribute('data-product-id');
        const apartment = allProducts.find(p => p._id === apartmentId);
        if (apartment) {
          showApartmentDetails(apartment);
        }
      });
      card.hasListener = true;
    }
  });
}

function addCardShareButtonHandlers() {
  document.querySelectorAll('.card-share-btn').forEach(btn => {
    if (!btn.hasListener) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.shareType;
        const id = btn.dataset.shareId;
        const title = decodeURIComponent(btn.dataset.shareTitle || '');
        if (type && id) {
          shareListing(type, id, title);
        }
      });
      btn.hasListener = true;
    }
  });
}

function showProductDetails(product) {
  const price = product.pricePerKg || 0;
  const unit = product.unit || 'kg';
  const quantity = product.quantity || 0;
  const isSoldOut = quantity === 0 || product.status === 'sold-out';
  const certification = product.certification?.organic ? 'Organic (Certified)' : '';
  
  const productImages = Array.isArray(product.images) && product.images.length > 0
    ? product.images.slice(0, 4)
    : [product.image || 'https://via.placeholder.com/400x300?text=Product'];

  const content = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      ${createDetailImageSlider(productImages, `product-detail-${product._id}`)}
      
      <div>
        <h2 style="font-family: var(--serif); font-size: 28px; margin-bottom: 8px; color: #0d0d0b;">${product.name}</h2>
        <p style="color: var(--gold-lt); font-size: 14px; font-weight: 700; letter-spacing: 0.5px;">${product.category}</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(212, 175, 55, 0.04)); padding: 16px; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.15);">
          <div style="font-size: 11px; color: #666; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px;">PRICE PER UNIT</div>
          <div style="font-size: 20px; font-weight: 700; color: #0d0d0b;">${price.toLocaleString()}.00</div>
          <div style="font-size: 12px; color: #999; margin-top: 2px;">/ ${unit}</div>
        </div>
        <div style="background: linear-gradient(135deg, rgba(46, 80, 22, 0.08), rgba(46, 80, 22, 0.04)); padding: 16px; border-radius: 8px; border: 1px solid rgba(46, 80, 22, 0.15);">
          <div style="font-size: 11px; color: #666; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px;">AVAILABLE STOCK</div>
          <div style="font-size: 20px; font-weight: 700; color: #0d0d0b;">${isSoldOut ? 'Out of Stock' : quantity}</div>
          <div style="font-size: 12px; color: #999; margin-top: 2px;">${isSoldOut ? '' : unit}</div>
        </div>
      </div>

      <div class="detail-panel">
        <div style="font-size: 11px; color: #666; margin-bottom: 10px; font-weight: 600; letter-spacing: 0.5px;">SELECT QUANTITY</div>
        <div class="weight-slider-wrap">
          <div class="weight-slider-label">
            <span>Weight (${unit})</span>
            <span class="wval" id="productDetailWeight">${isSoldOut ? `0 ${unit}` : `1 ${unit}`}</span>
          </div>
          <input type="range" class="wrange" id="productDetailWeightSlider" min="${isSoldOut ? 0 : 1}" max="${Math.max(quantity, 1)}" value="${isSoldOut ? 0 : 1}" step="1" ${isSoldOut ? 'disabled' : ''}
            oninput="document.getElementById('productDetailWeight').textContent = this.value + ' ${unit}'; const priceVal = ${price}; const totalValue = (priceVal * this.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); document.getElementById('productDetailTotal').innerHTML = totalValue; document.getElementById('productDetailTotalFooter').innerHTML = totalValue; const selectedQtyEl = document.getElementById('productDetailSelectedQty'); if (selectedQtyEl) selectedQtyEl.textContent = this.value + ' ${unit}'; const actionTotalEl = document.getElementById('productDetailActionTotal'); if (actionTotalEl) actionTotalEl.textContent = 'NGN ' + totalValue;">
          <div style="font-size: 13px; font-weight: 600; color: var(--gold-lt); min-width: 80px; text-align: right;">
            <span id="productDetailTotal">${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div class="detail-total-row">
          <span>Total</span>
          <span style="font-weight:700;">NGN<span id="productDetailTotalFooter">${price.toLocaleString()}.00</span></span>
        </div>
      </div>

      ${certification ? `
        <div class="detail-card" style="display: flex; align-items: center; gap: 12px;">
          <i class="fa-solid fa-leaf" style="color: var(--gold-lt); font-size: 1.1rem;"></i>
          <span style="font-size: 0.95rem; color: var(--gold); font-weight: 700;">${certification}</span>
        </div>
      ` : ''}

      ${product.description ? `
        <div>
          <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 10px; color: #0d0d0b; letter-spacing: 0.5px;">DESCRIPTION</h3>
          <p style="color: rgba(13, 13, 11, 0.7); line-height: 1.7; font-size: 13px;">${product.description}</p>
        </div>
      ` : ''}

      ${product.minLimit ? `
        <div style="background: #fff3cd; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #ffc107; font-size: 13px; color: #856404;">
          <strong>Minimum Order:</strong> ${product.minLimit} ${unit}
        </div>
      ` : ''}

    </div>
  `;
  document.getElementById('productDetailsContent').innerHTML = content;
  document.getElementById('productDetailsActions').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:18px;">
      <div class="order-summary-glass" style="padding:16px;">
        <div style="font-size:0.8rem; font-weight:700; color:rgba(13,13,11,0.7); margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">Checkout Actions</div>
        <div style="display:flex;justify-content:space-between; margin-bottom:10px;"><span>Selected Qty</span><strong id="productDetailSelectedQty">${isSoldOut ? `0 ${unit}` : `1 ${unit}`}</strong></div>
        <div style="display:flex;justify-content:space-between; font-weight:700;"><span>Total</span><span id="productDetailActionTotal">NGN ${price.toLocaleString()}.00</span></div>
      </div>
      <button class="btn-primary ${isSoldOut ? 'btn-disabled' : ''}" onclick="${isSoldOut ? 'void(0)' : `addProductDetailToCart('${product._id}')`}" style="width: 100%; padding: 14px; font-size: 15px; font-weight: 600;" ${isSoldOut ? 'disabled' : ''}>
        <i class="fa-solid fa-basket-shopping" style="margin-right: 8px;"></i> ${isSoldOut ? 'Out of Stock' : 'Add to Selection'}
      </button>
      <button class="cart-continue-btn" onclick="toggleSidebar('productDetailsSidebar', false)">← Back to Products</button>
    </div>
  `;
  toggleSidebar('productDetailsSidebar', true);
}

function addProductDetailToCart(productId) {
  if(!apiService.isAuthenticated()){
    showNotification('Please sign in to add items to your cart', 'error');
    openModal('authModal');
    return;
  }

  const product = allProducts.find(p => p._id === productId);
  if(!product){
    showNotification('Product not found', 'error');
    return;
  }

  const weight = parseInt(document.getElementById('productDetailWeightSlider')?.value || 1);
  addToCart(product, weight);
  toggleSidebar('productDetailsSidebar', false);
}

function getInlineSvgIcon(icon) {
  const style = 'display:inline-block; vertical-align:middle; width:1em; height:1em; margin-right:0.35rem; fill:currentColor;';
  const icons = {
    house: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="${style}"><path d="M3 9.5L12 2l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z"/></svg>`,
    building: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="${style}"><path d="M4 22V8l8-6 8 6v14H4zm7-11h2v2h-2v-2zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm3-8h2v2h-2v-2zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="${style}"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    circle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="${style}"><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
    cross: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="${style}"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    download: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="${style}"><path d="M12 3v12m0 0l-4-4m4 4l4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 19h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    retry: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="${style}"><path d="M12 5a7 7 0 1 0 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 5V1m0 0L8 5m4-4l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="${style}"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 16h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    package: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="${style}"><path d="M4 7l8-4 8 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3v4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 7l8 4 8-4" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
    message: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="${style}"><path d="M4 4h16v12H5.5L4 18.5V4z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 8h8M8 12h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
  };
  return icons[icon] || '';
}

function getApartmentTypeLabel(apartmentType) {
  const labelMap = {
    'room': 'Single Room',
    'self-contained': 'Self-Contained',
    'house': 'House',
    'flat': 'Flat'
  };
  const iconMap = {
    'room': 'house',
    'self-contained': 'house',
    'house': 'house',
    'flat': 'building'
  };
  const label = labelMap[apartmentType] || (apartmentType ? apartmentType.charAt(0).toUpperCase() + apartmentType.slice(1) : 'Apartment');
  return `${getInlineSvgIcon(iconMap[apartmentType] || 'building')} ${label}`;
}

function getApartmentTypeCategoryLabel(apartmentType) {
  if (!apartmentType) return '';
  const normalizedType = apartmentType.toString().toLowerCase().trim();
  const categoryMap = {
    'room': 'Room',
    'self-contained': 'Self-Contained',
    'house': 'House',
    'flat': 'Flat'
  };
  return categoryMap[normalizedType] || (normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1));
}

function getFurnishedLabel(isFurnished) {
  return isFurnished
    ? `${getInlineSvgIcon('check')} Furnished`
    : `${getInlineSvgIcon('circle')} Unfurnished`;
}

function getDetailBullet(icon, text) {
  return `${getInlineSvgIcon(icon)} ${text}`;
}

const detailSliderState = {};

function sanitizeSliderId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function createDetailImageSlider(images, sliderId) {
  const safeId = sanitizeSliderId(sliderId);
  const sliderImages = Array.isArray(images) && images.length > 0 ? images.slice(0, 4) : ['https://via.placeholder.com/800x400?text=No+Image'];
  const mainImage = sliderImages[0];

  const thumbnails = sliderImages.map((src, index) => `
      <img
        src="${src}"
        onclick="setDetailSlide('${safeId}', ${index})"
        style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid rgba(255,255,255,0.8); opacity: ${index === 0 ? '1' : '0.6'}; transition: opacity 0.2s;"
        alt="Thumbnail ${index + 1}" />
    `).join('');

  detailSliderState[safeId] = { images: sliderImages, index: 0 };

  return `
    <div id="${safeId}-slider" style="position: relative; display: flex; flex-direction: column; gap: 12px;">
      <div style="position: relative;">
        <img id="${safeId}-main" src="${mainImage}" alt="Detail Image" style="width: 100%; height: 300px; object-fit: cover; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.12);" />
        ${sliderImages.length > 1 ? `
          <button onclick="prevDetailSlide('${safeId}')" style="position:absolute; top:50%; left:10px; transform:translateY(-50%); background:rgba(0,0,0,0.45); color:#fff; border:none; border-radius:50%; width:34px; height:34px; cursor:pointer;">‹</button>
          <button onclick="nextDetailSlide('${safeId}')" style="position:absolute; top:50%; right:10px; transform:translateY(-50%); background:rgba(0,0,0,0.45); color:#fff; border:none; border-radius:50%; width:34px; height:34px; cursor:pointer;">›</button>
        ` : ''}
      </div>
      <div id="${safeId}-thumbs" style="display: flex; gap: 10px; justify-content: flex-start; overflow-x: auto;">
        ${thumbnails}
      </div>
    </div>
  `;
}

function setDetailSlide(sliderId, index) {
  const state = detailSliderState[sliderId];
  if (!state || index < 0 || index >= state.images.length) return;
  state.index = index;
  const main = document.getElementById(`${sliderId}-main`);
  if (main) {
    main.src = state.images[index];
  }
  const thumbs = document.querySelectorAll(`#${sliderId}-thumbs img`);
  thumbs.forEach((thumb, thumbIndex) => {
    thumb.style.opacity = thumbIndex === index ? '1' : '0.6';
  });
}

function prevDetailSlide(sliderId) {
  const state = detailSliderState[sliderId];
  if (!state) return;
  const nextIndex = (state.index - 1 + state.images.length) % state.images.length;
  setDetailSlide(sliderId, nextIndex);
}

function nextDetailSlide(sliderId) {
  const state = detailSliderState[sliderId];
  if (!state) return;
  const nextIndex = (state.index + 1) % state.images.length;
  setDetailSlide(sliderId, nextIndex);
}

function showApartmentDetails(apartment) {
  const inferredApartmentType = (() => {
    const desc = (apartment.description || '').toLowerCase();
    if (desc.includes('self-contained') || desc.includes('self contained')) return 'self-contained';
    if (desc.includes('flat')) return 'flat';
    if (desc.includes('room')) return 'room';
    if (desc.includes('house')) return 'house';
    return apartment.type || 'apartment';
  })();
  const apartmentType = apartment.apartmentType || apartment.apartment_type || inferredApartmentType;
  const listingType = apartment.listingType || apartment.listing_type || (apartment.pricePerMonth || apartment.pricePer_month ? 'rent' : 'sale');
  const rawRentPrice = apartment.pricePerMonth || apartment.price_per_month || apartment.rentPrice || apartment.rent_price || apartment.price || 0;
  const rawSalePrice = apartment.price || apartment.salePrice || apartment.sale_price || apartment.pricePerMonth || 0;
  const pricePerUnit = listingType === 'rent'
    ? parseFloat(rawRentPrice) || parseFloat(rawSalePrice) || 0
    : parseFloat(rawSalePrice) || parseFloat(rawRentPrice) || 0;
  const priceUnit = apartment.priceUnit || apartment.price_unit || 'month';
  const listingLabel = listingType === 'rent' ? 'For Rent' : 'For Sale';
  const priceDisplay = pricePerUnit > 0
    ? `NGN${pricePerUnit.toLocaleString()}${listingType === 'rent' ? `/${priceUnit}` : ''}`
    : 'Price on request';

  const typeLabel = getApartmentTypeLabel(apartmentType);

  const bedrooms = Number(apartment.bedrooms || apartment.beds || apartment.bedroom || 0);
  const bathrooms = Number(apartment.bathrooms || apartment.baths || apartment.bathroom || 0);
  const area = Number(apartment.apartmentAreaSqMeters || apartment.areaSqMeters || apartment.apartment_area_sq_meters || apartment.area || 0);
  const address = apartment.apartmentAddress || apartment.apartment_address || apartment.location || apartment.address || 'Location not specified';
  const category = apartment.category || 'Apartment';

  const apartmentImages = Array.isArray(apartment.images) && apartment.images.length > 0
    ? apartment.images.slice(0, 4)
    : [apartment.image || 'https://via.placeholder.com/400x300?text=Apartment'];

  const content = `
    <div style="display: flex; flex-direction: column; gap: 3px;padding-bottom: 20px; overflow-y:auto; height:100%;">
      ${createDetailImageSlider(apartmentImages, `apartment-detail-${apartment._id}`)}
      
      <div>
        <h2 style="font-family: var(--serif); font-size: 28px; margin-bottom: 8px;">${apartment.name || 'Apartment Listing'}</h2>
        <p style="color: #666; font-size: 14px;"><i class="fa-solid fa-map-location-marker"></i> ${address}</p>
        <p style="color: #999; font-size: 12px; margin-top: 4px;">Category: ${category}</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
        <div style="background: #f4f2ed; padding: 15px; border-radius: 6px;">
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Price</div>
          <div style="font-size: 18px; font-weight: 700; color: #0d0d0b;">${priceDisplay}</div>
        </div>
        <div style="background: #f4f2ed; padding: 15px; border-radius: 6px;">
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Type</div>
          <div style="font-size: 18px; font-weight: 700; color: #0d0d0b;">${typeLabel}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
        <div style="background: #f4f2ed; padding: 12px; border-radius: 6px; text-align: center;">
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Bedrooms</div>
          <div style="font-size: 18px; font-weight: 700; color: #0d0d0b;">${bedrooms > 0 ? bedrooms : 'N/A'}</div>
        </div>
        <div style="background: #f4f2ed; padding: 12px; border-radius: 6px; text-align: center;">
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Bathrooms</div>
          <div style="font-size: 18px; font-weight: 700; color: #0d0d0b;">${bathrooms > 0 ? bathrooms : 'N/A'}</div>
        </div>
        <div style="background: #f4f2ed; padding: 12px; border-radius: 6px; text-align: center;">
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Area</div>
          <div style="font-size: 18px; font-weight: 700; color: #0d0d0b;">${area > 0 ? area + 'm²' : 'N/A'}</div>
        </div>
      </div>

      <div style="display: flex; gap: 10px; font-size: 14px;">
        <div style="background: rgba(42, 90, 30, 0.1); padding: 10px; border-radius: 6px; flex: 1; display:flex; align-items:center; justify-content:center;">
          ${getFurnishedLabel(apartment.furnished)}
        </div>
        <div style="background: rgba(212, 175, 55, 0.1); padding: 10px; border-radius: 6px; flex: 1; display:flex; align-items:center; justify-content:center;">
          ${listingLabel}
        </div>
      </div>

      ${apartment.apartmentFeatures && apartment.apartmentFeatures.length > 0 ? `
        <div>
          <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Features</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${apartment.apartmentFeatures.map(f => `<span style="background: #f4f2ed; padding: 6px 12px; border-radius: 4px; font-size: 13px;">${f}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${apartment.description ? `
        <div>
          <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Description</h3>
          <p style="color: rgba(13, 13, 11, 0.7); line-height: 1.6;">${apartment.description}</p>
        </div>
      ` : ''}

    </div>
  `;
  document.getElementById('apartmentDetailsContent').innerHTML = content;
  document.getElementById('apartmentDetailsActions').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:18px;overflow-y:auto; height:100%;">
      <div class="order-summary-glass" style="padding:16px;">
        <div style="font-size:0.8rem; font-weight:700; color:rgba(13,13,11,0.7); margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">Listing Actions</div>
        <div style="display:flex;justify-content:space-between; margin-bottom:10px;"><span>Type</span><strong>${listingLabel}</strong></div>
        <div style="display:flex;justify-content:space-between; font-weight:700;"><span>Price</span><span>${priceDisplay}</span></div>
      </div>
      <button class="btn-primary" onclick="toggleSidebar('apartmentDetailsSidebar', false); addToCart({...${ JSON.stringify(apartment).replace(/'/g, "\\'")}}, 1)" style="width: 100%;">
        <i class="fa-solid fa-basket-shopping" style="margin-right: 8px;"></i> Add to Selection
      </button>
      <button class="cart-continue-btn" onclick="toggleSidebar('apartmentDetailsSidebar', false)">← Back to Listings</button>
    </div>
  `;
  toggleSidebar('apartmentDetailsSidebar', true);
}

function showLandDetails(land) {
  const totalPrice = land.landPricingType === 'fixed' 
    ? land.pricePerPlot 
    : (land.pricePerSqMeter * land.areaSqMeters);

  const legalStatusLabel = {
    'freehold': 'Freehold',
    'leasehold': 'Leasehold',
    'government': 'Government Land',
    'communal': 'Communal',
    'unknown': 'Unknown'
  };

  const landImages = Array.isArray(land.images) && land.images.length > 0
    ? land.images.slice(0, 4)
    : [land.image || 'https://via.placeholder.com/400x300?text=Land'];

  const content = `
    <div style="display: flex; flex-direction: column; gap: 5px;">
      ${createDetailImageSlider(landImages, `land-detail-${land._id}`)}
      
      <div>
        <h2 style="font-family: var(--serif); font-size: 28px; margin-bottom: 8px; color: #0d0d0b;">${land.name}</h2>
        <p style="color: #666; font-size: 14px;"><i class="fa-solid fa-map-marker-alt" style="color: var(--gold-lt); margin-right: 6px;"></i> ${land.location}</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(212, 175, 55, 0.04)); padding: 16px; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.15);">
          <div style="font-size: 11px; color: #666; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px;">TOTAL PRICE</div>
          <div style="font-size: 20px; font-weight: 700; color: #0d0d0b;">NGN ${totalPrice.toLocaleString()}</div>
        </div>
        <div style="background: linear-gradient(135deg, rgba(46, 80, 22, 0.08), rgba(46, 80, 22, 0.04)); padding: 16px; border-radius: 8px; border: 1px solid rgba(46, 80, 22, 0.15);">
          <div style="font-size: 11px; color: #666; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px;">AREA</div>
          <div style="font-size: 20px; font-weight: 700; color: #0d0d0b;">${land.areaSqMeters.toLocaleString()}</div>
          <div style="font-size: 12px; color: #999; margin-top: 2px;">m²</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        <div style="background: #f9f7f4; padding: 14px; border-radius: 8px; border: 1px solid #e9e6de;">
          <div style="font-size: 11px; color: #666; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px;">LEGAL STATUS</div>
          <div style="font-size: 14px; font-weight: 700; color: #0d0d0b;">${legalStatusLabel[land.legalStatus || 'unknown']}</div>
        </div>
        <div style="background: #f9f7f4; padding: 14px; border-radius: 8px; border: 1px solid #e9e6de;">
          <div style="font-size: 11px; color: #666; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px;">NUMBER OF PLOTS</div>
          <div style="font-size: 14px; font-weight: 700; color: #0d0d0b;">${land.numberOfPlots || 1}</div>
        </div>
      </div>

      ${land.description ? `
        <div>
          <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 10px; color: #0d0d0b; letter-spacing: 0.5px;">DESCRIPTION</h3>
          <p style="color: rgba(13, 13, 11, 0.7); line-height: 1.7; font-size: 13px;">${land.description}</p>
        </div>
      ` : ''}

    </div>
  `;
  document.getElementById('landDetailsContent').innerHTML = content;
  document.getElementById('landDetailsActions').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:18px;">
      <div class="order-summary-glass" style="padding:16px;">
        <div style="font-size:0.8rem; font-weight:700; color:rgba(13,13,11,0.7); margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">Property Actions</div>
        <div style="display:flex;justify-content:space-between; margin-bottom:10px;"><span>Area</span><strong>${land.areaSqMeters > 0 ? land.areaSqMeters + 'm²' : 'N/A'}</strong></div>
        <div style="display:flex;justify-content:space-between; font-weight:700;"><span>Total</span><span>NGN ${totalPrice.toLocaleString()}</span></div>
      </div>
      <button class="btn-primary" onclick="addLandDetailToCart('${land._id}')" style="width: 100%; padding: 14px; font-size: 15px; font-weight: 600;">
        <i class="fa-solid fa-handshake" style="margin-right: 8px;"></i> Inquire Now
      </button>
      <button class="cart-continue-btn" onclick="toggleSidebar('landDetailsSidebar', false)">← Back to Listings</button>
    </div>
  `;
  toggleSidebar('landDetailsSidebar', true);
}

function addLandDetailToCart(landId) {
  if(!apiService.isAuthenticated()){
    showNotification('Please sign in to inquire about land', 'error');
    openModal('authModal');
    return;
  }

  const land = allProducts.find(p => p._id === landId);
  if(!land){
    showNotification('Land property not found', 'error');
    return;
  }

  addToCart(land, 1);
  toggleSidebar('landDetailsSidebar', false);
}

/*  AUTH TABS  */
function switchAuthTab(tab,btn){
  document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.getElementById(tab+'Panel').classList.add('active');
}

function openForgotPasswordPanel(){
  switchAuthTab('forgot', null);
}

/*  GLOBAL SEARCH OVERLAY  */
let globalProducts = [
  {_id:'1', type:'product', name:"Artesian Smoked Catfish",price:45000,img:"https://images.unsplash.com/photo-1599056377759-3388006e62e0?auto=format&fit=crop&w=400&q=70",category:'Seafood',description:'Smoked fish',tags:"artesian smoked catfish fish"},
  {_id:'2', type:'product', name:"Traditional Pure Garri", price:18000,img:"https://images.unsplash.com/photo-1590540179852-2110a54f813a?auto=format&fit=crop&w=400&q=70",category:'Grains',description:'Cassava garri',tags:"traditional pure garri cassava grain"},
  {_id:'3', type:'product', name:"Whole Exquisite Kola Nuts",price:32000,img:"https://images.unsplash.com/photo-1614701838030-f7034d61053f?auto=format&fit=crop&w=400&q=70",category:'Nuts',description:'Kola nut',tags:"whole exquisite kola nuts cola nut"},
];
let searchResultsData = [];
let selectedSearchIndex = -1;
let searchSortOrder = 'relevance';
let searchCategoryFilter = 'all';
let recentSearches = JSON.parse(window.localStorage.getItem('searchHistory') || '[]');
let popularSearchTerms = ['organic produce', 'farm-to-table', 'farmland', 'self-contained', 'riverside living', 'apartment', 'wholesale'];
let searchCategories = [];

async function loadGlobalProducts(){
  try{
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${API_BASE_URL}/products`, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    if(data.success){
      console.log('Global products loaded:', data.data);
      globalProducts = data.data.map(p => ({
        _id: p._id || p.id || '',
        type: p.type || 'product',
        name: p.name || p.title || '',
        price: p.pricePerKg || p.pricePerMonth || p.price || 0,
        img: p.image ? p.image.replace("w=700", "w=400").replace("q=80", "q=70") : 'https://via.placeholder.com/400',
        category: p.category || p.apartmentType || p.type || '',
        description: p.description || '',
        tags: `${(p.name || '').toLowerCase()} ${(p.category || '').toLowerCase()} ${(p.description || '').toLowerCase()} ${(p.apartmentAddress || '').toLowerCase()} ${(p.location || '').toLowerCase()}`.trim(),
        sourceItem: p
      }));
    } else {
      console.warn('Failed to load products:', data.message);
    }
  }catch(e){
    console.error('Error loading products:', e.message);
    // Use fallback products if API fails
  }

  await loadSearchCategories().catch(catError => {
    console.warn('[WARN] Failed to load search categories:', catError);
  });
}

async function loadSearchCategories() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${API_BASE_URL}/products/categories`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.success && Array.isArray(data.data)) {
      searchCategories = data.data
        .filter(cat => cat && String(cat).trim() !== '')
        .map(cat => String(cat).trim());
      console.log('[DEBUG] Search categories loaded:', searchCategories);
      if (document.getElementById('searchOverlay')?.classList.contains('open')) {
        renderSearchCategoryFilters();
      }
    } else {
      throw new Error(data.message || 'Unexpected categories payload');
    }
  } catch (error) {
    console.warn('[WARN] Could not load categories from backend:', error.message || error);
    searchCategories = [];
  }
}

function openSearch(){
  const searchOverlay = document.getElementById('searchOverlay');
  if(searchOverlay) searchOverlay.classList.add('open');
  document.body.style.overflow='hidden';
  const searchInput = document.getElementById('searchInput');
  if(searchInput) setTimeout(()=>searchInput.focus(),60);
  renderGlobalSearch('');
}
function closeSearch(){
  const searchOverlay = document.getElementById('searchOverlay');
  if(searchOverlay) searchOverlay.classList.remove('open');
  const searchInput = document.getElementById('searchInput');
  if(searchInput) searchInput.value='';
  if(!document.querySelector('.modal-backdrop.open')) document.body.style.overflow='';
}
const searchOverlay = document.getElementById('searchOverlay');
if(searchOverlay) searchOverlay.addEventListener('click',e=>{
  if(e.target===searchOverlay) closeSearch();
});
const searchClose = document.getElementById('searchClose');
if(searchClose) searchClose.addEventListener('click',closeSearch);

function renderGlobalSearch(q) {
  const res = document.getElementById('searchResults');
  const none = document.getElementById('searchNoResults');
  const count = document.getElementById('searchCount');
  const filters = document.getElementById('searchCategoryFilters');
  const suggestions = document.getElementById('searchSuggestions');
  const emptyState = document.getElementById('searchEmptyState');
  if (!res || !none || !count || !filters || !suggestions || !emptyState) return;

  const term = q.trim().toLowerCase();
  const source = allProducts.length ? allProducts : globalProducts;
  if (!term) {
    searchResultsData = [];
    selectedSearchIndex = -1;
    renderSearchCategoryFilters();

    if (searchCategoryFilter !== 'all') {
      const matched = source
        .filter(item => isSearchCategoryMatch(item, searchCategoryFilter))
        .map(item => ({
          ...item,
          img: item.img || item.image || (item.sourceItem && (item.sourceItem.img || item.sourceItem.image)) || 'https://via.placeholder.com/400'
        }))
        .sort(sortSearchItems);

      searchResultsData = matched;
      selectedSearchIndex = matched.length ? 0 : -1;
      emptyState.style.display = 'none';
      none.style.display = matched.length ? 'none' : 'block';
      res.innerHTML = matched.map((item, index) => `
        <div class="search-result-card" data-search-index="${index}" tabindex="0">
          <div class="result-thumbnail"><img src="${item.img || 'https://via.placeholder.com/400'}" alt="${item.name}" loading="lazy"></div>
          <div class="search-result-info">
            <div class="search-result-badge ${item.type}">${item.type}</div>
            <h4>${highlightMatch(item.name || '', '')}</h4>
            <p>${highlightMatch(item.category || item.description || '', '')}</p>
            <div class="result-meta">
              <span>${item.priceLabel || (item.price > 0 ? `NGN ${Number(item.price).toLocaleString()}` : 'Price unavailable')}</span>
              <span>${item.category || ''}</span>
            </div>
            <div class="search-card-actions">
              <button type="button" class="search-card-action" data-search-index="${index}" aria-label="View ${item.name}">View item</button>
            </div>
          </div>
        </div>
      `).join('');

      attachSearchResultHandlers(res);

      updateSearchSelection();
      count.textContent = matched.length
        ? `${matched.length} result${matched.length === 1 ? '' : 's'} for "${searchCategoryFilter}"`
        : `No results in "${searchCategoryFilter}"`;
      return;
    }

    emptyState.style.display = 'block';
    none.style.display = 'none';
    res.innerHTML = '';
    count.textContent = 'Search products, lands and apartments by typing a keyword.';
    renderSearchSuggestions();
    return;
  }

  emptyState.style.display = 'none';
  const matched = getMatchedSearchItems(source, term)
    .filter(item => searchCategoryFilter === 'all' || item.category?.toString().trim().toLowerCase() === searchCategoryFilter.toLowerCase() || item.type === searchCategoryFilter.toLowerCase())
    .sort(sortSearchItems);

  searchResultsData = matched;
  selectedSearchIndex = matched.length ? 0 : -1;

  count.textContent = matched.length
    ? `${matched.length} result${matched.length === 1 ? '' : 's'} for "${q}"`
    : `No results for "${q}"`;

  none.style.display = matched.length ? 'none' : 'block';
  res.innerHTML = matched.map((item, index) => `
    <div class="search-result-card" data-search-index="${index}" tabindex="0">
      <div class="result-thumbnail"><img src="${item.img || 'https://via.placeholder.com/400'}" alt="${item.name}" loading="lazy"></div>
      <div class="search-result-info">
        <div class="search-result-badge ${item.type}">${item.type}</div>
        <h4>${highlightMatch(item.name || '', term)}</h4>
        <p>${highlightMatch(item.category || item.description || '', term)}</p>
        <div class="result-meta">
          <span>${item.priceLabel || (item.price > 0 ? `NGN ${Number(item.price).toLocaleString()}` : 'Price unavailable')}</span>
          <span>${item.category || ''}</span>
        </div>
        <div class="search-card-actions">
          <button type="button" class="search-card-action" data-search-index="${index}" aria-label="View ${item.name}">View item</button>
        </div>
      </div>
    </div>
  `).join('');

  attachSearchResultHandlers(res);

  updateSearchSelection();
}

function getMatchedSearchItems(source, term) {
  return source.map(item => {
    const sourceItem = item.sourceItem || item;
    const type = (item.type || sourceItem.type || 'product').toString();
    const name = item.name || item.title || sourceItem.name || sourceItem.title || '';
    const category = item.category || sourceItem.category || sourceItem.apartmentType || sourceItem.apartment_type || type || 'Unknown';
    const description = item.description || item.summary || sourceItem.description || sourceItem.details || '';
    const rawPrice = Number(
      item.price || item.pricePerKg || item.pricePerMonth || item.cost || item.amount ||
      item.pricePerPlot || item.pricePerSqMeter || item.pricePerMeter || item.pricePerUnit ||
      sourceItem.price || sourceItem.pricePerKg || sourceItem.pricePerMonth || sourceItem.cost || sourceItem.amount ||
      sourceItem.pricePerPlot || sourceItem.pricePerSqMeter || sourceItem.pricePerMeter || sourceItem.pricePerUnit ||
      0
    );
    const img = item.img || item.image || sourceItem.img || sourceItem.image || (Array.isArray(sourceItem.images) ? sourceItem.images[0] : undefined) || sourceItem.thumbnail || sourceItem.banner || sourceItem.picture || sourceItem.photos?.[0] || 'https://via.placeholder.com/400';
    const listingType = item.listingType || sourceItem.listingType || sourceItem.listing_type || '';
    const landPricingType = item.landPricingType || sourceItem.landPricingType || sourceItem.land_pricing_type || '';

    const priceLabel = (() => {
      if (type === 'product') {
        return rawPrice > 0 ? `NGN ${rawPrice.toLocaleString()}.00 / unit` : 'Price unavailable';
      }
      if (type === 'apartment') {
        if (listingType === 'rent') return rawPrice > 0 ? `NGN ${rawPrice.toLocaleString()}.00 / month` : 'Price unavailable';
        if (listingType === 'sale') return rawPrice > 0 ? `NGN ${rawPrice.toLocaleString()}` : 'Price unavailable';
        return rawPrice > 0 ? `NGN ${rawPrice.toLocaleString()}` : 'Price unavailable';
      }
      if (type === 'land') {
        const pricing = landPricingType.toString().toLowerCase();
        if (pricing === 'per-plot') {
          return rawPrice > 0 ? `NGN ${rawPrice.toLocaleString()}.00 / plot` : 'Price unavailable';
        }
        if (pricing === 'per-sq-meter' || pricing === 'per-sqm' || pricing === 'per-meter' || pricing === 'per-square-meter') {
          return rawPrice > 0 ? `NGN ${rawPrice.toLocaleString()}.00 / sq m` : 'Price unavailable';
        }
        return rawPrice > 0 ? `NGN ${rawPrice.toLocaleString()}` : 'Price unavailable';
      }
      return rawPrice > 0 ? `NGN ${rawPrice.toLocaleString()}` : 'Price unavailable';
    })();

    return {
      _id: item._id || item.id || sourceItem._id || sourceItem.id || '',
      type: type.toString().toLowerCase(),
      name,
      category,
      description,
      img,
      price: rawPrice,
      priceLabel,
      listingType,
      sourceItem
    };
  }).filter(item => {
    const t = (term || '').toString().trim().toLowerCase();
    if (!t) return true;

    const name = (item.name || '').toString().toLowerCase();
    const category = (item.category || '').toString().toLowerCase();
    const description = (item.description || '').toString().toLowerCase();
    const tags = (item.sourceItem?.tags || '').toString().toLowerCase();
    const apartmentType = (item.sourceItem?.apartmentType || item.sourceItem?.apartment_type || '').toString().toLowerCase();
    const location = (item.sourceItem?.location || item.sourceItem?.apartmentAddress || item.sourceItem?.address || '').toString().toLowerCase();
    const fields = [name, category, description, tags, apartmentType, location].join(' ');

    return fields.includes(t);
  });
}

function isSearchCategoryMatch(item, filter) {
  const normalized = filter.toString().trim().toLowerCase();
  const categoryValue = (item.category || item.apartmentType || item.type || '').toString().trim().toLowerCase();
  if (normalized === 'land' && item.type === 'land') return true;
  if (item.type === 'apartment' && categoryValue === normalized) return true;
  return categoryValue === normalized || item.type === normalized;
}

function sortSearchItems(a, b) {
  if (searchSortOrder === 'price-asc') {
    return Number(a.price || 0) - Number(b.price || 0);
  }
  if (searchSortOrder === 'price-desc') {
    return Number(b.price || 0) - Number(a.price || 0);
  }
  return 0;
}

function highlightMatch(text, term) {
  if (!term) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

function renderSearchCategoryFilters() {
  const container = document.getElementById('searchCategoryFilters');
  if (!container) return;
  const source = allProducts.length ? allProducts : globalProducts;

  const productCategories = searchCategories.length
    ? [...new Set(searchCategories.map(cat => String(cat).trim()).filter(Boolean))]
    : [...new Set(source.map(item => item.category || '').filter(Boolean).map(cat => String(cat).trim()))];

  const typeCategories = [...new Set(source.map(item => {
    if (item.type === 'land') return 'Land';
    if (item.type === 'apartment') return item.apartmentType || item.apartment_type || 'Apartment';
    return null;
  }).filter(Boolean).map(cat => String(cat).trim()))];

  const categoryMap = new Map();
  [...productCategories, ...typeCategories].forEach(cat => {
    const key = cat.toString().trim().toLowerCase();
    if (!categoryMap.has(key)) {
      categoryMap.set(key, cat.toString().trim());
    }
  });

  const categories = [...categoryMap.values()];
  const pills = ['all', ...categories].map(cat => `
    <span class="search-pill ${searchCategoryFilter === cat.toString().toLowerCase() ? 'active' : ''}" onclick="applySearchCategoryFilter('${cat.replace(/'/g, "\\'")}')">${cat === 'all' ? 'All' : cat}</span>
  `).join('');

  container.innerHTML = pills;
}

function applySearchCategoryFilter(category) {
  searchCategoryFilter = category.toString().trim().toLowerCase();
  renderGlobalSearch(document.getElementById('searchInput')?.value || '');
}

function renderSearchSuggestions() {
  const container = document.getElementById('searchSuggestions');
  if (!container) return;

  const recent = recentSearches.slice(-5).reverse();
  const productSuggestions = globalProducts
    .filter(item => item.name)
    .map(item => item.name)
    .filter((name, index, arr) => arr.indexOf(name) === index)
    .slice(0, 6);

  const categorySuggestions = globalProducts
    .map(item => item.category || item.apartmentType || item.type || '')
    .filter(Boolean)
    .filter((term, index, arr) => arr.indexOf(term) === index)
    .slice(0, 4);

  const items = [...new Set([...recent, ...productSuggestions, ...categorySuggestions, ...popularSearchTerms])].slice(0, 8);
  if (items.length === 0) {
    items.push(...popularSearchTerms.slice(0, 8));
  }

  container.innerHTML = items.map(term => `
    <button type="button" class="search-suggestion-pill" onclick="selectSearchSuggestion('${term.replace(/'/g, "\\'")}')">${term}</button>
  `).join('');
}

function selectSearchSuggestion(term) {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.value = term;
  saveRecentSearch(term);
  renderGlobalSearch(term);
}

function attachSearchResultHandlers(container) {
  if (!container) return;

  container.querySelectorAll('.search-result-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.searchIndex, 10);
      if (!isNaN(idx) && searchResultsData[idx]) {
        openSearchResult(searchResultsData[idx]);
      }
    });

    card.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const idx = parseInt(card.dataset.searchIndex, 10);
        if (!isNaN(idx) && searchResultsData[idx]) {
          openSearchResult(searchResultsData[idx]);
        }
      }
    });
  });

  container.querySelectorAll('.search-card-action').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const idx = parseInt(button.dataset.searchIndex, 10);
      if (!isNaN(idx) && searchResultsData[idx]) {
        openSearchResult(searchResultsData[idx]);
      }
    });
  });
}

function openSharedItemFromUrl() {
  const params = new URLSearchParams(window.location.search);
  let type = params.get('shareType');
  let id = params.get('shareId');

  if (!type || !id) {
    const match = window.location.pathname.match(/\/share\/(product|land|apartment)\/([^\/]+)/i);
    if (match) {
      type = match[1];
      id = decodeURIComponent(match[2]);
    }
  }

  if (!type || !id) return;

  const item = allProducts.find(p => p._id === id || p.id === id || p.name?.toLowerCase() === id.toLowerCase());
  if (!item) return;

  if (type === 'land') showLandDetails(item);
  else if (type === 'apartment') showApartmentDetails(item);
  else showProductDetails(item);

  if (params.has('shareType') && params.has('shareId')) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function updateSearchSelection() {
  const cards = document.querySelectorAll('.search-result-card');
  cards.forEach((card, index) => {
    card.classList.toggle('selected', index === selectedSearchIndex);
    if (index === selectedSearchIndex) card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  });
}

function openSearchResult(searchItem) {
  if (!searchItem || !searchItem.sourceItem) return;
  const item = allProducts.find(p => p._id === searchItem._id || p.id === searchItem._id || p.name === searchItem.name);
  if (item) {
    closeSearch();
    if (item.type === 'land') showLandDetails(item);
    else if (item.type === 'apartment') showApartmentDetails(item);
    else showProductDetails(item);
  } else {
    closeSearch();
    const fallback = searchItem.sourceItem;
    if (fallback.type === 'land') showLandDetails(fallback);
    else if (fallback.type === 'apartment') showApartmentDetails(fallback);
    else showProductDetails(fallback);
  }
  saveRecentSearch(document.getElementById('searchInput')?.value || searchItem.name || '');
}

function saveRecentSearch(term) {
  if (!term) return;
  const normalized = term.trim().toLowerCase();
  if (!normalized || recentSearches.includes(normalized)) return;
  recentSearches.push(normalized);
  if (recentSearches.length > 8) recentSearches.shift();
  window.localStorage.setItem('searchHistory', JSON.stringify(recentSearches));
}

const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', function () { renderGlobalSearch(this.value); });
  searchInput.addEventListener('keydown', function (e) {
    if (searchResultsData.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedSearchIndex = Math.min(selectedSearchIndex + 1, searchResultsData.length - 1);
      updateSearchSelection();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedSearchIndex = Math.max(selectedSearchIndex - 1, 0);
      updateSearchSelection();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSearchIndex >= 0 && searchResultsData[selectedSearchIndex]) {
        openSearchResult(searchResultsData[selectedSearchIndex]);
      }
    }
    if (e.key === 'Escape') {
      closeSearch();
    }
  });
}
const searchSort = document.getElementById('searchSort');
if (searchSort) {
  searchSort.addEventListener('change', function () {
    searchSortOrder = this.value;
    renderGlobalSearch(document.getElementById('searchInput')?.value || '');
  });
}

/*  PRODUCT SECTION SEARCH  */

/*  HAMBURGER  */
let mOpen=false;
const menuBtn = document.getElementById('menuBtn');
if(menuBtn) menuBtn.addEventListener('click',function(){
  mOpen=!mOpen;
  const mobileMenu = document.getElementById('mobileMenu');
  if(mobileMenu) mobileMenu.classList.toggle('open',mOpen);
  const s=this.querySelectorAll('span');
  if(mOpen){s[0].style.transform='translateY(6.5px) rotate(45deg)';s[1].style.opacity='0';s[2].style.transform='translateY(-6.5px) rotate(-45deg)';}
  else s.forEach(x=>{x.style.transform='';x.style.opacity='';});
});
function closeMobile(){
  mOpen=false;
  const mobileMenu = document.getElementById('mobileMenu');
  if(mobileMenu) mobileMenu.classList.remove('open');
  const btn = document.getElementById('menuBtn');
  if(btn) btn.querySelectorAll('span').forEach(s=>{s.style.transform='';s.style.opacity='';});
}

/*  SCROLL REVEAL  */
const obs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting) e.target.classList.add('visible');});
},{threshold:0.1});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));

/*  CHART  */
let chartInstance=null;
let analyticsData=null;

// Default chart data structure
const chartData={
  revenue:{type:'bar',labels:[],datasets:[]},
  volume:{type:'line',labels:[],datasets:[]},
  demand:{type:'bar',labels:[],datasets:[]},
  breakdown:{type:'doughnut',labels:[],datasets:[]}
};

// Fetch analytics from API
async function fetchAnalytics(){
  try {
    const response=await fetch(`${API_BASE_URL}/analytics/dashboard`);
    if(!response.ok) throw new Error('Failed to fetch analytics');
    const result=await response.json();
    if(result.success){
      analyticsData=result.data;
      updateChartsWithData();
    }
  } catch(err){
    console.warn('Analytics fetch failed, using demo data:', err);
    useDemoChartData();
  }
}

// Update charts with real data
function updateChartsWithData(){
  if(!analyticsData) return;
  
  const {monthly, productVolume, breakdown}=analyticsData;
  const products=analyticsData.products || [];

  // Revenue chart - monthly data
  chartData.revenue={
    type:'bar',
    labels:monthly?.labels || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    datasets:[{label:'Revenue (K)',data:monthly?.revenue || [0],backgroundColor:'rgba(184,147,58,0.75)',borderColor:'#b8933a',borderWidth:1,borderRadius:2}]
  };

  // Volume chart - product-based
  const volumeDatasets=products.map(p=>({
    label:`${p.name} (${p.totalSold.toFixed(1)}T)`,
    data:new Array(12).fill(p.totalSold/12),
    borderColor:p.color,
    backgroundColor:p.color+'15',
    tension:0.4,
    fill:true,
    pointRadius:4,
    pointBackgroundColor:p.color
  }));
  
  chartData.volume={
    type:'line',
    labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    datasets:volumeDatasets
  };

  // Demand chart - quarterly by product
  chartData.demand={
    type:'bar',
    labels:['Q1','Q2','Q3','Q4'],
    datasets:products.slice(0,4).map(p=>({
      label:p.name,
      data:[p.totalOrders/4, p.totalOrders/4, p.totalOrders/4, p.totalOrders/4],
      backgroundColor:p.color+'CC',
      borderRadius:2
    }))
  };

  // Breakdown chart - product mix
  chartData.breakdown={
    type:'doughnut',
    labels:breakdown?.labels || products.map(p=>p.name),
    datasets:[{
      data:breakdown?.data || products.map(p=>p.totalOrders),
      backgroundColor:(breakdown?.colors || products.map(p=>p.color)),
      borderColor:'#f4f2ed',
      borderWidth:3,
      hoverOffset:8
    }]
  };
}

// Fallback demo data
function useDemoChartData(){
  chartData.revenue={
    type:'bar',
    labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    datasets:[{label:'Revenue (K)',data:[120,145,180,160,220,195,240,260,210,190,230,280],backgroundColor:'rgba(184,147,58,0.75)',borderColor:'#b8933a',borderWidth:1,borderRadius:2}]
  };
  chartData.volume={
    type:'line',
    labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    datasets:[
      {label:'Catfish (T)',data:[1.2,1.5,1.8,1.4,2.1,1.9,2.3,2.6,2.0,1.8,2.2,2.8],borderColor:'#b8933a',backgroundColor:'rgba(184,147,58,0.1)',tension:0.4,fill:true,pointRadius:4,pointBackgroundColor:'#b8933a'},
      {label:'Garri (T)',data:[2.4,2.8,3.2,2.9,3.5,3.1,3.8,4.1,3.6,3.2,3.7,4.3],borderColor:'#2a4a1e',backgroundColor:'rgba(42,74,30,0.08)',tension:0.4,fill:true,pointRadius:4,pointBackgroundColor:'#2a4a1e'},
      {label:'Kola (T)',data:[0.4,0.5,0.6,0.5,0.7,0.6,0.8,0.9,0.7,0.6,0.7,0.9],borderColor:'#e6c97a',backgroundColor:'rgba(230,201,122,0.08)',tension:0.4,fill:true,pointRadius:4,pointBackgroundColor:'#e6c97a'},
    ]
  };
  chartData.demand={
    type:'bar',
    labels:['Q1','Q2','Q3','Q4'],
    datasets:[
      {label:'Catfish',data:[4.5,6.2,7.1,8.0],backgroundColor:'rgba(184,147,58,0.8)',borderRadius:2},
      {label:'Garri',data:[8.4,10.1,11.6,13.2],backgroundColor:'rgba(42,74,30,0.75)',borderRadius:2},
      {label:'Kola',data:[1.4,1.8,2.0,2.3],backgroundColor:'rgba(230,201,122,0.8)',borderRadius:2},
    ]
  };
  chartData.breakdown={
    type:'doughnut',
    labels:['Smoked Catfish','Pure Garri','Kola Nuts'],
    datasets:[{data:[38,45,17],backgroundColor:['#b8933a','#2a4a1e','#e6c97a'],borderColor:'#f4f2ed',borderWidth:3,hoverOffset:8}]
  };
}

function initChart(key){
  const ctx=document.getElementById('mainChart').getContext('2d');
  if(chartInstance){chartInstance.destroy();chartInstance=null;}
  const d=chartData[key];
  chartInstance=new Chart(ctx,{
    type:d.type,
    data:{labels:d.labels,datasets:d.datasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{display:d.datasets&&d.datasets.length>1,position:'top',labels:{font:{family:"'Syne',sans-serif",size:11},color:'#0d0d0b',boxWidth:12,padding:20}},
        tooltip:{backgroundColor:'#0d0d0b',titleFont:{family:"'Syne',sans-serif",size:11},bodyFont:{family:"'Syne',sans-serif",size:11},padding:12,cornerRadius:2},
      },
      scales:d.type==='doughnut'?{}:{
        x:{grid:{color:'rgba(13,13,11,0.06)'},ticks:{font:{family:"'Syne',sans-serif",size:10},color:'rgba(13,13,11,0.45)'}},
        y:{grid:{color:'rgba(13,13,11,0.06)'},ticks:{font:{family:"'Syne',sans-serif",size:10},color:'rgba(13,13,11,0.45)'}},
      },
      animation:{duration:500,easing:'easeInOutQuart'},
    }
  });
}
function switchChart(key,btn){
  document.querySelectorAll('.chart-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  initChart(key);
}

// Load settings on page ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadAppSettings);
} else {
  loadAppSettings();
}

// Initialize charts when modal opens
function initAnalyticsOnOpen(){
  if(!analyticsData) fetchAnalytics().then(()=>{
    initChart('revenue');
    updateAnalyticsStats();
  });
  else {
    initChart('revenue');
    updateAnalyticsStats();
  }
}

function updateAnalyticsStats(){
  if(!analyticsData) return;
  const {summary, products}=analyticsData;
  
  // Update stats display
  const totalVolume=products.reduce((sum,p)=>sum+p.totalSold,0).toFixed(1);
  
  document.getElementById('statRevenue').textContent=''+formatNumber(summary.totalRevenue);
  document.getElementById('statVolume').textContent=totalVolume+'T';
  document.getElementById('statOrders').textContent=summary.totalOrders;
}

function formatNumber(num){
  if(num>=1000000) return(num/1000000).toFixed(1)+'M';
  if(num>=1000) return(num/1000).toFixed(1)+'K';
  return num.toString();
}

//  USER ANALYTICS 
async function loadUserAnalytics(){
  try {
    const response=await fetch(`${API_BASE_URL}/analytics/user`,{
      headers:{'Authorization':`Bearer ${apiService.getToken()}`}
    });
    if(!response.ok) throw new Error('Failed to fetch user analytics');
    const result=await response.json();
    if(result.success){
      displayUserAnalytics(result.data);
    }
  } catch(err){
    console.error('User analytics error:', err);
    showNotification('Failed to load dashboard','error');
  }
}

function displayUserAnalytics(data){
  const {summary,recentTransactions,topProducts}=data;
  
  // Update summary stats
  const dashboard=document.getElementById('dashboardContent');
  const statsHtml=`
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;margin-bottom:30px;">
      <div style="background:#f4f2ed;padding:15px;border-radius:8px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:#0d0d0b;">${summary.completedOrders}</div>
        <div style="font-size:12px;color:#666;margin-top:5px;">Orders Placed</div>
      </div>
      <div style="background:#f4f2ed;padding:15px;border-radius:8px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:#0d0d0b;">${formatNumber(summary.totalSpent)}</div>
        <div style="font-size:12px;color:#666;margin-top:5px;">Total Spent</div>
      </div>
      <div style="background:#f4f2ed;padding:15px;border-radius:8px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:#0d0d0b;">${formatNumber(summary.weekSpent)}</div>
        <div style="font-size:12px;color:#666;margin-top:5px;">This Week</div>
      </div>
      <div style="background:#f4f2ed;padding:15px;border-radius:8px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:#0d0d0b;">${formatNumber(summary.todaySpent)}</div>
        <div style="font-size:12px;color:#666;margin-top:5px;">Today</div>
      </div>
    </div>
  `;
  
  // Recent transactions
  let transactionsHtml='';
  if(recentTransactions.length>0){
    transactionsHtml=recentTransactions.map(t=>`
      <div style="padding:12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;color:#0d0d0b;">${new Date(t.date).toLocaleDateString()}</div>
          <div style="font-size:12px;color:#999;">${t.items.map(i=>i.name).join(', ')}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:600;color:#0d0d0b;">${t.total.toLocaleString()}</div>
          <div style="font-size:12px;color:#999;text-transform:capitalize;">${t.status}</div>
        </div>
      </div>
    `).join('');
  } else {
    transactionsHtml='<p style="text-align:center;color:#999;">No transactions yet</p>';
  }
  
  // Top products
  let productsHtml='';
  if(topProducts.length>0){
    productsHtml=topProducts.map(p=>`
      <div style="padding:12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
        <div style="flex:1;">
          <div style="font-weight:600;color:#0d0d0b;">${p.name}</div>
          <div style="font-size:12px;color:#999;">${p.count} orders</div>
        </div>
        <div style="text-align:right;color:#0d0d0b;font-weight:600;">${p.total.toFixed(1)}T</div>
      </div>
    `).join('');
  } else {
    productsHtml='<p style="text-align:center;color:#999;">No purchase history yet</p>';
  }
  
  dashboard.innerHTML=statsHtml+
    `<h3 style="margin:30px 0 15px 0;font-family:'Cormorant Garamond',serif;font-size:18px;">Recent Transactions</h3>
     <div id="recentTransactionsContainer" style="border-top:1px solid #ddd;padding-top:15px;">${transactionsHtml}</div>
     <h3 style="margin:30px 0 15px 0;font-family:'Cormorant Garamond',serif;font-size:18px;">Top Products</h3>
     <div id="topProductsContainer" style="border-top:1px solid #ddd;padding-top:15px;">${productsHtml}</div>
     <button class="glass-btn-secondary" onclick="toggleSidebar('dashboardSidebar', false);logout();" style="width:100%;margin-top:20px;">Logout</button>`;
}

/*  CART ENGINE  */
const GUEST_CART_KEY = '365extra_cart';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('365extra_user') || 'null');
  } catch {
    return null;
  }
}

function getCartStorageKeyForUser(user) {
  if (!user?.email) return GUEST_CART_KEY;
  return `365extra_cart_${encodeURIComponent(user.email.toLowerCase())}`;
}

function getActiveCartKey() {
  return getCartStorageKeyForUser(getCurrentUser());
}

function loadCartFromStorage() {
  try {
    const key = getActiveCartKey();
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error loading cart from localStorage:', e);
    return [];
  }
}

function saveCart() {
  const key = getActiveCartKey();
  localStorage.setItem(key, JSON.stringify(cart));
  updateCartDisplay();
}

function saveCartForUser(user) {
  if (!user || !user.email) return;
  const key = getCartStorageKeyForUser(user);
  localStorage.setItem(key, JSON.stringify(cart));
}

function restoreCartForUser(user) {
  if (!user || !user.email) return;
  const key = getCartStorageKeyForUser(user);
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      cart = JSON.parse(stored);
      saveCart();
    }
  } catch (e) {
    console.error('Error restoring cart for user:', e);
  }
}

let cart = loadCartFromStorage();
let allProducts = []; // Store all products for cart operations
let currentCategoryFilter = null; // Track active category filter
let batchLoadingState = {
  isExpanded: false,
  itemsPerBatch: 12,
  currentDisplayCount: 12
};

function addToCart(product, weight){
  const stockQty = product.quantity ?? product.numberOfPlots ?? 0;
  const isSoldOut = stockQty === 0 || product.status === 'sold-out';
  if (isSoldOut) {
    showNotification(`${product.name} is currently out of stock`, 'error');
    return;
  }
  if (weight > stockQty) {
    showNotification(`We apologize, but only ${stockQty} ${product.unit || 'units'} are currently available. Please adjust your quantity.`, 'error');
    return;
  }

  // Combine same product entries by total kilograms instead of creating duplicate cart lines.
  const existing = cart.find(item => item._id === product._id);

  if(existing){
    const existingTotalKg = (existing.weight || 1) * existing.quantity;
    existing.quantity = existingTotalKg + weight;
    existing.weight = 1;
    existing.pricePerKg = product.pricePerKg || existing.pricePerKg;
  } else {
    cart.push({...product, weight: 1, quantity: weight});
  }

  saveCart();
  showNotification(`${product.name} added to cart!`, 'success');
  updateCartDisplay();
  toggleCartSidebar(true);
  loadUserAddressForCheckout();
}

function removeFromCart(cartIndex){
  if(cartIndex >= 0 && cartIndex < cart.length){
    cart.splice(cartIndex, 1);
    saveCart();
  }
}

function updateCartItemQuantity(cartIndex, newQuantity){
  if(cartIndex >= 0 && cartIndex < cart.length){
    cart[cartIndex].quantity = Math.max(0, newQuantity);
    if(cart[cartIndex].quantity === 0) removeFromCart(cartIndex);
    else saveCart();
  }
}

// Load user's saved address for checkout
async function loadUserAddressForCheckout(){
  try {
    if(!apiService.isAuthenticated()) return;
    
    const response = await apiService.getMe();
    if(response.success && response.data && response.data.address){
      const addr = response.data.address;
      document.getElementById('shippingStreet').value = addr.street || '';
      document.getElementById('shippingCity').value = addr.city || '';
      document.getElementById('shippingState').value = addr.state || '';
      document.getElementById('shippingPostalCode').value = addr.postalCode || '';
      document.getElementById('shippingCountry').value = addr.country || 'Nigeria';
    }
  } catch (error) {
    console.log('Could not load saved address');
  }
}

function updateCheckoutAddressSummary(){
  const summaryEl = document.getElementById('checkoutAddressSummaryText');
  if(!summaryEl) return;

  const street = document.getElementById('shippingStreet')?.value?.trim();
  const city = document.getElementById('shippingCity')?.value?.trim();
  const state = document.getElementById('shippingState')?.value?.trim();
  const postalCode = document.getElementById('shippingPostalCode')?.value?.trim();
  const country = document.getElementById('shippingCountry')?.value?.trim();

  if (street || city || state || postalCode || country) {
    summaryEl.innerHTML = `
      <strong>${street || 'Street address not set'}</strong><br>
      ${city ? city + ', ' : ''}${state ? state + ', ' : ''}${postalCode ? postalCode + ', ' : ''}${country || ''}
    `;
  } else {
    summaryEl.textContent = 'No delivery address added yet. Please enter your address before proceeding to checkout.';
  }
}

let shouldReopenCartAfterAddressSave = false;
let pendingCartSidebarPage = '1';

async function openAddressModal(){
  const cartSidebar = document.getElementById('cartSidebar');
  const pages = cartSidebar?.querySelector('.sidebar-pages');
  if (cartSidebar && cartSidebar.classList.contains('active')) {
    shouldReopenCartAfterAddressSave = true;
    pendingCartSidebarPage = pages?.dataset.page || '1';
    toggleCartSidebar(false);
  } else {
    pendingCartSidebarPage = '1';
  }

  if(apiService.isAuthenticated()){
    await loadUserAddressForCheckout();
  }
  updateCheckoutAddressSummary();
  openModal('addressModal');
}

function saveAddressAndClose(){
  const shippingAddress = {
    street: document.getElementById('shippingStreet')?.value?.trim() || '',
    city: document.getElementById('shippingCity')?.value?.trim() || '',
    state: document.getElementById('shippingState')?.value?.trim() || '',
    postalCode: document.getElementById('shippingPostalCode')?.value?.trim() || '',
    country: document.getElementById('shippingCountry')?.value?.trim() || 'Nigeria'
  };

  const requiredFields = { street: 'Street Address', city: 'City', state: 'State/Province', postalCode: 'Postal Code', country: 'Country' };
  const missingFields = [];
  for (const [field, label] of Object.entries(requiredFields)) {
    if (!shippingAddress[field]) missingFields.push(label);
  }

  if (missingFields.length > 0) {
    showNotification(`Please complete your address: ${missingFields.join(', ')}`, 'error');
    return;
  }

  updateCheckoutAddressSummary();
  closeModal('addressModal');
  showNotification('Address saved. You can now proceed to checkout.', 'success');

  if (shouldReopenCartAfterAddressSave) {
    shouldReopenCartAfterAddressSave = false;
    setTimeout(() => toggleCartSidebar(true, pendingCartSidebarPage), 100);
  }
}

function clearCart(){
  cart = [];
  const key = getActiveCartKey();
  localStorage.removeItem(key);
  updateCartDisplay();
}

function updateCartDisplay(){
  const itemCount = cart.length;
  
  // Separate items by type - apartments and land handled together
  const productItems = cart.filter(item => item.type !== 'land' && item.type !== 'apartment');
  const realEstateItems = cart.filter(item => item.type === 'land' || item.type === 'apartment');
  const landItems = cart.filter(item => item.type === 'land');
  const apartmentItems = cart.filter(item => item.type === 'apartment');
  
  // Calculate totals
  const totalWeight = productItems.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
  const totalPlots = landItems.reduce((sum, item) => sum + (item.plotsRequested || item.quantity), 0);
  const totalArea = landItems.reduce((sum, item) => sum + (item.areaSqMeters * (item.plotsRequested || item.quantity)), 0);

  const navBadge = document.getElementById('cartNavBadge');
  const toggleBadge = document.getElementById('cartCountBadge');
  if(navBadge){
    navBadge.textContent = itemCount;
    navBadge.classList.toggle('show', itemCount > 0);
  }
  if(toggleBadge){
    toggleBadge.textContent = itemCount;
    toggleBadge.classList.toggle('show', itemCount > 0);
  }
  const pill = document.getElementById('cartCountPill');
  if(pill) pill.textContent = itemCount;

  const empty = document.getElementById('cartEmpty');
  const list = document.getElementById('cartItemsList');
  const footer = document.getElementById('cartFooter');

  if(!empty || !list || !footer) return;

  if(cart.length === 0){
    empty.style.display = 'block';
    list.innerHTML = '';
    footer.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  footer.style.display = 'block';

  list.innerHTML = cart.map((item, index) => {
    // Check item type and render appropriately
    if (item.type === 'land') {
      return renderCartLandItem(item, index);
    } else if (item.type === 'apartment') {
      return renderCartApartmentItem(item, index);
    } else {
      return renderCartProductItem(item, index);
    }
  }).join('');

  // Calculate subtotal for products, land, and apartments
  const subtotal = cart.reduce((sum, item) => {
    if (item.type === 'land') {
      const unitPrice = item.landPricingType === 'fixed' 
        ? item.pricePerPlot 
        : (item.pricePerSqMeter * item.areaSqMeters);
      return sum + (unitPrice * (item.plotsRequested || item.quantity));
    } else if (item.type === 'apartment') {
      const unitPrice = item.listingType === 'rent' ? item.pricePerMonth : item.price;
      return sum + (unitPrice * (item.quantity || 1));
    } else {
      return sum + (item.pricePerKg * item.weight * item.quantity);
    }
  }, 0);

  const subEl = document.getElementById('cartSubtotal');
  const weightEl = document.getElementById('cartTotalWeight');
  const totalEl = document.getElementById('cartTotal');
  
  // Calculate full total with tax and shipping (matches Paystack calculation)
  // Uses settings fetched from backend API
  const hasProductItems = productItems.length > 0;
  const shippingCost = hasProductItems ? appSettings.shippingFee : 0; // Use settings from API
  const taxRate = appSettings.taxRate / 100; // Convert percentage to decimal
  const tax = subtotal * taxRate; // Use settings from API
  const total = Math.round((subtotal + shippingCost + tax) * 100) / 100; // Round like backend for consistency
  
  if(subEl) subEl.textContent = `NGN${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  // Update weight/land/apartment label and value based on cart composition
  if(weightEl) {
    const apartmentCount = apartmentItems.length;
    let displayText = '';
    
    if (apartmentItems.length > 0 && (landItems.length > 0 || productItems.length > 0)) {
      // Mixed cart with apartments
      const parts = [];
      if (productItems.length > 0) parts.push(`<span style="color: var(--primary-lt);">Products: ${totalWeight} kg</span>`);
      if (landItems.length > 0) parts.push(`<span style="color: var(--gold-lt);">Land: ${totalPlots} Plot${totalPlots !== 1 ? 's' : ''}</span>`);
      if (apartmentItems.length > 0) parts.push(`<span style="color: #1e90ff;">Apartments: ${apartmentCount}</span>`);
      weightEl.innerHTML = parts.join(' | ');
    } else if (apartmentItems.length > 0) {
      // Apartments only
      weightEl.textContent = `${apartmentCount} Apartment${apartmentCount > 1 ? 's' : ''}`;
    } else if (landItems.length > 0 && productItems.length > 0) {
      // Products + Land (no apartments)
      weightEl.innerHTML = `<span style="color: var(--primary-lt);">Products: ${totalWeight} kg</span> | <span style="color: var(--gold-lt);">Land: ${totalPlots} Plot${totalPlots !== 1 ? 's' : ''} (${totalArea.toLocaleString()} sq m)</span>`;
    } else if (landItems.length > 0) {
      // Land only
      weightEl.textContent = `${totalPlots} Plot${totalPlots !== 1 ? 's' : ''} | ${totalArea.toLocaleString()} sq m`;
    } else {
      // Products only
      weightEl.textContent = `${totalWeight} kg`;
    }
  }
  
  // Display total with breakdown
  if(totalEl) {
    let shippingRow = '';
    if (hasProductItems) {
      shippingRow = `<div style="display: flex; justify-content: space-between;"><span>Shipping:</span> <span>NGN${shippingCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`;
    } else {
      const realEstateType = apartmentItems.length > 0 && landItems.length === 0 ? 'Apartments' : 'Land';
      shippingRow = `<div style="display: flex; justify-content: space-between; color: rgba(13, 13, 11, 0.5);"><span>Shipping:</span> <span>Not applicable (${realEstateType} only)</span></div>`;
    }
    
    totalEl.innerHTML = `
      <div style="display: grid; gap: 8px; font-size: 0.9rem; color: rgba(13, 13, 11, 0.7);">
        <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span> <span>NGN${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Tax (${appSettings.taxRate}%):</span> <span>NGN${tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
        ${shippingRow}
        <div style="border-top: 2px solid var(--gold); padding-top: 8px; display: flex; justify-content: space-between; font-weight: 600; color: var(--ink); font-size: 1rem;">
          <span>Total:</span> <span>NGN${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    `;
  }

  // Toggle checkout sections based on cart composition
  const landCheckoutSection = document.getElementById('landCheckoutSection');
  const productsCheckoutSection = document.getElementById('productsCheckoutSection');
  
  if (productItems.length === 0 && realEstateItems.length > 0) {
    // Land/Apartment only - show real estate checkout
    if (landCheckoutSection) landCheckoutSection.style.display = 'block';
    if (productsCheckoutSection) productsCheckoutSection.style.display = 'none';
  } else {
    // Products only or mixed - show standard checkout
    if (landCheckoutSection) landCheckoutSection.style.display = 'none';
    if (productsCheckoutSection) productsCheckoutSection.style.display = 'block';
  }

  // Update cart toggle button badge
  const toggleBtn = document.getElementById('cartToggleBtn');
  const badge = toggleBtn?.querySelector('.cart-badge');
  if (badge) {
    badge.textContent = itemCount;
  }
  
  updateCheckoutAddressSummary();
  // Show/hide cart toggle button based on cart items
  if (toggleBtn) {
    toggleBtn.style.display = itemCount > 0 ? 'flex' : 'none';
  }
}

function renderCartProductItem(item, index) {
  const subtotal = item.pricePerKg * item.weight * item.quantity;
  const totalKg = (item.weight || 1) * item.quantity;
  return `
    <div class="cart-item">
      <img src="${item.image || 'https://via.placeholder.com/80?text=Product'}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/80?text=Product'">
      <div class="cart-item-info">
        <div class="ci-name">${item.name}</div>
        <div class="ci-meta">${parseFloat(item.pricePerKg).toLocaleString()}.00 / unit • ${totalKg}kg selected</div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updateCartItemQuantity(${index}, ${item.quantity - 1})">-</button>
          <span class="qty-num">${totalKg}</span>
          <button class="qty-btn" onclick="updateCartItemQuantity(${index}, ${item.quantity + 1})">+</button>
        </div>
      </div>
      <div class="ci-right">
        <div class="ci-subtotal">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <button class="ci-remove" onclick="removeFromCart(${index})">
          <i class="fa-solid fa-trash"></i> Remove
        </button>
      </div>
    </div>
  `;
}

function renderCartLandItem(item, index) {
  const unitPrice = item.landPricingType === 'fixed' 
    ? item.pricePerPlot 
    : (item.pricePerSqMeter * item.areaSqMeters);
  const subtotal = unitPrice * (item.plotsRequested || item.quantity);
  const plotCount = item.plotsRequested || item.quantity;

  return `
    <div class="cart-item land-cart-item">
      <img src="${item.image || 'https://via.placeholder.com/80?text=Land'}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/80?text=Land'">
      <div class="cart-item-info">
        <div class="ci-name">${item.name}</div>
        <div class="ci-location"><i class="fa-solid fa-map-marker-alt"></i> ${item.location}</div>
        <div class="ci-meta">
          ${item.areaSqMeters.toLocaleString()} m  
          ${item.landPricingType === 'fixed' ? 'Fixed Price' : `${item.pricePerSqMeter.toLocaleString()} / m`}
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updateCartItemQuantity(${index}, ${plotCount - 1})">-</button>
          <span class="qty-num">${plotCount} Plot${plotCount > 1 ? 's' : ''}</span>
          <button class="qty-btn" onclick="updateCartItemQuantity(${index}, ${plotCount + 1})">+</button>
        </div>
      </div>
      <div class="ci-right">
        <div class="ci-subtotal">${subtotal.toLocaleString()}</div>
        <button class="ci-remove" onclick="removeFromCart(${index})">
          <i class="fa-solid fa-trash"></i> Remove
        </button>
      </div>
    </div>
  `;
}

function renderCartApartmentItem(item, index) {
  const unitPrice = item.listingType === 'rent' ? item.pricePerMonth : item.price;
  const subtotal = unitPrice * (item.quantity || 1);
  const qty = item.quantity || 1;
  const priceUnit = item.priceUnit || item.price_unit || 'month';

  const typeLabel = getApartmentTypeLabel(item.apartmentType);

  const listingLabel = item.listingType === 'rent' ? 'For Rent' : 'For Sale';

  return `
    <div class="cart-item apartment-cart-item">
      <img src="${item.image || 'https://via.placeholder.com/80?text=Apartment'}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/80?text=Apartment'">
      <div class="cart-item-info">
        <div class="ci-name">${item.name}</div>
        <div class="ci-meta" style="font-size: 0.8rem; color: #666;">
          ${typeLabel} • ${item.bedrooms}BR/${item.bathrooms}BA • ${item.apartmentAreaSqMeters}m²
        </div>
        <div class="ci-location" style="font-size: 0.75rem; color: #999;">
          <i class="fa-solid fa-map-marker-alt"></i> ${item.apartmentAddress || 'Address not specified'}
        </div>
        <div style="font-size: 0.75rem; color: #666; margin-top: 4px; display:flex; flex-wrap:wrap; align-items:center; gap:0.25rem;">
          ${getFurnishedLabel(item.furnished)} • ${listingLabel}
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updateCartItemQuantity(${index}, ${qty - 1})">-</button>
          <span class="qty-num">${qty}</span>
          <button class="qty-btn" onclick="updateCartItemQuantity(${index}, ${qty + 1})">+</button>
        </div>
      </div>
      <div class="ci-right">
        <div class="ci-subtotal">NGN${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div style="font-size: 0.7rem; color: #999; margin-bottom: 8px;">
          ${item.listingType === 'rent' ? `/${priceUnit}` : 'total'}
        </div>
        <button class="ci-remove" onclick="removeFromCart(${index})">
          <i class="fa-solid fa-trash"></i> Remove
        </button>
      </div>
    </div>
  `;
}

/*  PRODUCT FETCHING  */
let lastProductCount = 0;
let lastProductsSignature = '';
let productCheckInterval = null;

// LocalStorage helpers for offline persistence
function saveProductsToLocalStorage(products) {
  try {
    localStorage.setItem('agrocrown_products', JSON.stringify({
      data: products,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('[LocalStorage] Failed to save products:', error.message);
  }
}

function getProductsFromLocalStorage() {
  try {
    const stored = localStorage.getItem('agrocrown_products');
    if (stored) {
      const { data } = JSON.parse(stored);
      return Array.isArray(data) ? data : null;
    }
  } catch (error) {
    console.warn('[LocalStorage] Failed to retrieve products:', error.message);
  }
  return null;
}

async function fetchProducts(options = {}){
  try{
    const params = new URLSearchParams();
    if (options.category) params.set('category', options.category);
    if (options.min !== undefined && options.min !== null && options.min !== '') params.set('min', Number(options.min));
    if (options.max !== undefined && options.max !== null && options.max !== '') params.set('max', Number(options.max));
    if (options.sort) params.set('sort', options.sort);

    const url = `${API_BASE_URL}/products${params.toString() ? `?${params.toString()}` : ''}`;
    console.log('[DEBUG] Fetching products from', url);
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    console.log('[DEBUG] Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('[DEBUG] Response data:', data);
    // Diagnostic: log any product without numeric pricePerKg
    if (Array.isArray(data.data)) {
      data.data.forEach(p => {
        if (p.type === 'product' && (p.pricePerKg === undefined || p.pricePerKg === null)) {
          console.warn('[DEBUG] Product missing pricePerKg:', p._id, p.name, p.pricePerKg);
        }
      });
    }
    if(data.success){
      // Preserve batch state across cache updates
      const savedState = saveFilterState();
      
      allProducts = data.data; // Store all products
      // Save to localStorage for offline access
      saveProductsToLocalStorage(data.data);
      // Compute signature based on id + updatedAt to detect edits
      try{
        lastProductsSignature = data.data.map(p => `${p._id}:${p.updatedAt||''}`).join('|');
      }catch(e){
        lastProductsSignature = '';
      }
      lastProductCount = data.data.length;
      console.log('[DEBUG] Rendering', data.data.length, 'products');
      renderProducts(data.data);
      
      // Restore batch loading state after rendering
      restoreFilterState(savedState);
    } else {
      console.error('[DEBUG] Response not successful:', data.message);
      allProducts = [];
      renderProducts([]);
      showNotification('Product not found', 'error');
    }
  }catch(error){
    console.error('[DEBUG] Failed to fetch products:', error);
    console.error('[DEBUG] Product list unavailable. Attempting to load from cache...');
    
    // Preserve batch state when loading from cache
    const savedState = saveFilterState();
    
    // Try to load from localStorage when offline
    const cachedProducts = getProductsFromLocalStorage();
    if (cachedProducts && cachedProducts.length > 0) {
      console.log('[DEBUG] Loading', cachedProducts.length, 'products from localStorage');
      allProducts = cachedProducts;
      renderProducts(cachedProducts);
      // Restore batch loading state after rendering
      restoreFilterState(savedState);
      showNotification('Showing cached products (offline mode)', 'info');
    } else {
      allProducts = [];
      renderProducts([]);
      showNotification('Product not found', 'error');
    }
  }
}

// Categories are now extracted dynamically from products in renderCategories()
// This ensures categories always match the products in the database
// No dedicated /api/categories endpoint needed

// Save current filter state before updates
function saveFilterState() {
  return {
    category: currentCategoryFilter,
    sort: productFilterState.sort,
    minPrice: productFilterState.min,
    maxPrice: productFilterState.max,
    batchExpanded: batchLoadingState.isExpanded
  };
}

// Restore filter state after product update
function restoreFilterState(state) {
  if (!state) return;
  currentCategoryFilter = state.category || null;
  productFilterState.sort = state.sort || 'name';
  productFilterState.min = state.minPrice || '';
  productFilterState.max = state.maxPrice || '';
  batchLoadingState.isExpanded = state.batchExpanded || false;
}

// Auto-check for new products every 30 seconds
function startProductPolling(){
  if(productCheckInterval) return; // Prevent duplicate intervals
  
  productCheckInterval = setInterval(async () => {
    try{
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${API_BASE_URL}/products`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if(data.success){
        // compute signature from id + updatedAt to detect edits as well as count changes
        let sig = '';
        try { sig = data.data.map(p => `${p._id}:${p.updatedAt || ''}`).join('|'); } catch (e) { sig = ''; }

        if (data.data.length !== lastProductCount || sig !== lastProductsSignature) {
          console.log(`Products updated: ${lastProductCount} -> ${data.data.length}`);
          
          // PRESERVE FILTER STATE before updating products
          const savedState = saveFilterState();
          
          allProducts = data.data;
          lastProductCount = data.data.length;
          lastProductsSignature = sig;
          // Save updated products to localStorage
          saveProductsToLocalStorage(data.data);
          
          // Restore filter state and reapply filters immediately
          restoreFilterState(savedState);

          if (currentCategoryFilter) {
            const isApartmentCategory = allProducts.some(p => p.type === 'apartment' && getApartmentTypeCategoryLabel(p.apartmentType) === currentCategoryFilter);
            const isLandCategory = currentCategoryFilter === 'Land';

            if (isApartmentCategory) {
              const filteredProducts = allProducts.filter(p => p.type === 'apartment' && getApartmentTypeCategoryLabel(p.apartmentType) === currentCategoryFilter);
              renderProducts(filteredProducts);
            } else if (isLandCategory) {
              const filteredProducts = allProducts.filter(p => p.type === 'land');
              renderProducts(filteredProducts);
            } else {
              applyProductFilters();
            }
          } else if (productFilterState.min || productFilterState.max || productFilterState.sort !== 'name') {
            applyProductFilters();
          } else {
            renderProducts(allProducts);
          }

          // Show notification on refresh
          showNotification('Product list has been updated.', 'success');
        }
      }
    } catch (error) {
      console.log('Product polling check failed (connection may be offline)');
    }
  }, 10000); // Check every 10 seconds for faster updates
}

// Fetch latest products when the user focuses the window
window.addEventListener('focus', () => {
  try {
    fetchProducts();
  } catch (err) {
    console.log('Focus fetch failed', err);
  }
});

function stopProductPolling(){
  if(productCheckInterval){
    clearInterval(productCheckInterval);
    productCheckInterval = null;
  }
}

function renderProducts(products){
  const grid = document.getElementById('productGrid');
  const noMsg = document.getElementById('noProductsMsg');
  const countEl = document.getElementById('prodCount');

  if(!Array.isArray(products) || products.length === 0){
    grid.innerHTML = '<div class="no-products-msg">Product not found.</div>';
    renderCategories(allProducts.length ? allProducts : products);
    return;
  }

  // Reset batch loading state when rendering new products
  batchLoadingState.isExpanded = false;
  batchLoadingState.currentDisplayCount = 12;

  // Determine how many items to display
  const itemsToShow = batchLoadingState.isExpanded ? products.length : Math.min(batchLoadingState.itemsPerBatch, products.length);
  const displayedProducts = products.slice(0, itemsToShow);
  const hasMore = products.length > batchLoadingState.itemsPerBatch;

  // Render the products
  grid.innerHTML = displayedProducts.map(product => {
    // Check product type
    if (product.type === 'land') {
      return renderLandCard(product, products.length);
    } else if (product.type === 'apartment') {
      return renderApartmentCard(product, products.length);
    } else {
      return renderProductCard(product, products.length);
    }
  }).join('');

  // Add "Show More" button if there are more products to display
  if (hasMore) {
    const showMoreContainer = document.createElement('div');
    showMoreContainer.id = 'showMoreContainer';
    showMoreContainer.style.cssText = 'grid-column: 1 / -1; display: flex; justify-content: center; padding: 20px; margin-top: 10px;';
    
    const showMoreBtn = document.createElement('button');
    showMoreBtn.id = 'showMoreBtn';
    showMoreBtn.className = 'show-more-btn';
    showMoreBtn.textContent = 'Show More';
    showMoreBtn.onclick = toggleBatchLoading;
    
    showMoreContainer.appendChild(showMoreBtn);
    grid.parentNode.insertBefore(showMoreContainer, grid.nextSibling);
  } else {
    // Remove show more container if no more items
    const container = document.getElementById('showMoreContainer');
    if (container) container.remove();
  }

  // Initialize progressive image loading for ultra-high quality effect
  initProgressiveImageLoading();
  updateProductSearch(products.length);
  
  // Render categories based on full product list so tags stay visible while filtering
  renderCategories(allProducts.length ? allProducts : products);
  
  // Add click handlers to cards
  addProductCardClickHandlers();
  addLandCardClickHandlers();
  addApartmentCardClickHandlers();
  addCardShareButtonHandlers();
}

function toggleBatchLoading() {
  const btn = document.getElementById('showMoreBtn');
  if (!btn) return;
  
  batchLoadingState.isExpanded = !batchLoadingState.isExpanded;
  btn.textContent = batchLoadingState.isExpanded ? 'Show Less' : 'Show More';
  
  // Re-render only the products part with new display count
  const grid = document.getElementById('productGrid');
  if (grid && allProducts.length > 0) {
    const itemsToShow = batchLoadingState.isExpanded ? allProducts.length : batchLoadingState.itemsPerBatch;
    const displayedProducts = allProducts.slice(0, itemsToShow);
    
    grid.innerHTML = displayedProducts.map(product => {
      if (product.type === 'land') {
        return renderLandCard(product, allProducts.length);
      } else if (product.type === 'apartment') {
        return renderApartmentCard(product, allProducts.length);
      } else {
        return renderProductCard(product, allProducts.length);
      }
    }).join('');

    // Re-initialize handlers and image loading
    initProgressiveImageLoading();
    addProductCardClickHandlers();
    addLandCardClickHandlers();
    addApartmentCardClickHandlers();
    addCardShareButtonHandlers();
    
    // Smooth scroll to top of grid
    grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Dynamically render product categories
function renderCategories(products) {
  const categoryContainer = document.querySelector('.product-category');
  if (!categoryContainer) {
    console.warn('[WARN] Category container not found');
    return;
  }
  
  if (!products || products.length === 0) {
    console.warn('[WARN] renderCategories - No products received');
    categoryContainer.innerHTML = '';
    categoryContainer.style.display = 'none';
    return;
  }
  
  categoryContainer.style.display = 'flex';
  console.log('[DEBUG] renderCategories - products received:', products.length);
  
  // Extract unique categories from products
  const productCategories = [...new Set(products.filter(p => !p.type || p.type === 'product').map(p => {
    const cat = p.category || null;
    if (!cat) {
      console.warn('[WARN] Product missing category:', p.name || p._id);
    }
    return cat;
  }).filter(Boolean))];
  
  // Extract unique apartment types (for display as categories) - now supports custom types
  const apartmentTypes = [...new Set(products.filter(p => p.type === 'apartment').map(p => getApartmentTypeCategoryLabel(p.apartmentType)).filter(Boolean))];
  
  // Check if there are any land items
  const hasLand = products.some(p => p.type === 'land');
  
  // Combine all categories: product categories + apartment types + land
  const allCategories = [
    ...productCategories,
    ...apartmentTypes,
    ...(hasLand ? ['Land'] : [])
  ];
  
  // Sort categories alphabetically
  allCategories.sort();
  
  console.log('[DEBUG] Extracted categories:', allCategories);
  
  if (allCategories.length === 0) {
    console.warn('[WARN] No categories found in products');
    categoryContainer.innerHTML = '';
    categoryContainer.style.display = 'none';
    return;
  }
  
  // Create category tags + "Show All" button
  const allCategoriesHtml = `
    <span class="category show-all-btn" onclick="showAllProducts()">All</span>
    ${allCategories.map(cat => `
      <span class="category" onclick="filterByCategory('${cat}')">${cat}</span>
    `).join('')}
  `;
  
  categoryContainer.innerHTML = allCategoriesHtml;

  if (currentCategoryFilter) {
    document.querySelectorAll('.product-category .category').forEach(tag => {
      if (tag.textContent.trim().toLowerCase() === currentCategoryFilter.toLowerCase()) {
        tag.classList.add('active');
      }
    });
  } else {
    document.querySelector('.show-all-btn')?.classList.add('active');
  }
  
  console.log('[OK] Categories rendered:', allCategories);
}

let activeProductDropdown = null;
let productFilterState = {
  min: '',
  max: '',
  sort: 'name'
};

function setupProductFilterBar() {
  const priceBtn = document.getElementById('priceFilterBtn');
  const sortBtn = document.getElementById('sortDropdownBtn');
  const applyPriceBtn = document.getElementById('applyPriceFilterBtn');
  const clearPriceBtn = document.getElementById('clearPriceFilterBtn');
  const sortAlphaBtn = document.getElementById('sortAlphaBtn');
  const sortAscBtn = document.getElementById('sortAscBtn');
  const sortDescBtn = document.getElementById('sortDescBtn');

  if (priceBtn) {
    priceBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleProductDropdown('priceFilterDropdown', 'priceFilterBtn');
    });
  }

  if (sortBtn) {
    sortBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleProductDropdown('sortDropdownMenu', 'sortDropdownBtn');
    });
  }

  if (applyPriceBtn) {
    applyPriceBtn.addEventListener('click', () => {
      productFilterState.min = document.getElementById('filterMinPrice')?.value || '';
      productFilterState.max = document.getElementById('filterMaxPrice')?.value || '';
      applyProductFilters();
      updatePriceControlLabel();
      closeProductDropdowns();
    });
  }

  if (clearPriceBtn) {
    clearPriceBtn.addEventListener('click', () => {
      productFilterState.min = '';
      productFilterState.max = '';
      const minInput = document.getElementById('filterMinPrice');
      const maxInput = document.getElementById('filterMaxPrice');
      if (minInput) minInput.value = '';
      if (maxInput) maxInput.value = '';
      applyProductFilters();
      updatePriceControlLabel();
      closeProductDropdowns();
    });
  }

  if (sortAlphaBtn) {
    sortAlphaBtn.addEventListener('click', () => {
      selectSortOption('name');
    });
  }

  if (sortAscBtn) {
    sortAscBtn.addEventListener('click', () => {
      selectSortOption('asc');
    });
  }

  if (sortDescBtn) {
    sortDescBtn.addEventListener('click', () => {
      selectSortOption('desc');
    });
  }

  const resetBtn = document.getElementById('resetFiltersBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetProductFilterBar();
      applyProductFilters();
      closeProductDropdowns();
    });
  }

  document.addEventListener('click', handleProductFilterDocumentClick);
  updateSortControlLabel();
  updatePriceControlLabel();
}

function toggleProductDropdown(menuId, buttonId) {
  const menu = document.getElementById(menuId);
  const button = document.getElementById(buttonId);
  if (!menu || !button) return;

  const isOpen = menu.classList.contains('open');
  closeProductDropdowns();

  if (!isOpen) {
    menu.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    activeProductDropdown = menuId;
  }
}

function closeProductDropdowns() {
  document.querySelectorAll('.dropdown-menu.open').forEach(menu => menu.classList.remove('open'));
  document.querySelectorAll('#priceFilterBtn, #sortDropdownBtn').forEach(btn => btn?.setAttribute('aria-expanded', 'false'));
  activeProductDropdown = null;
}

function handleProductFilterDocumentClick(event) {
  if (activeProductDropdown) {
    const dropdown = document.getElementById(activeProductDropdown);
    if (dropdown && !dropdown.contains(event.target) && !event.target.closest('.control-btn')) {
      closeProductDropdowns();
    }
  }
}

function selectSortOption(direction) {
  productFilterState.sort = direction;
  updateSortControlLabel();
  applyProductFilters();
  closeProductDropdowns();
}

function updateSortControlLabel() {
  const label = document.getElementById('sortControlValue');
  if (!label) return;
  if (productFilterState.sort === 'desc') {
    label.textContent = 'Price: High to Low';
  } else if (productFilterState.sort === 'asc') {
    label.textContent = 'Price: Low to High';
  } else if (productFilterState.sort === 'name') {
    label.textContent = 'Name: A to Z';
  } else {
    label.textContent = 'Sort';
  }
}

function applyProductFilters() {
  const params = {
    min: productFilterState.min || undefined,
    max: productFilterState.max || undefined,
    sort: productFilterState.sort || undefined,
  };

  if (currentCategoryFilter) {
    params.category = currentCategoryFilter;
  }

  console.log('[DEBUG] Applying product filters', params);
  fetchProducts(params);
}

function resetProductFilterBar() {
  productFilterState.min = '';
  productFilterState.max = '';
  productFilterState.sort = 'name';
  currentCategoryFilter = null;
  batchLoadingState.isExpanded = false;
  batchLoadingState.currentDisplayCount = 12;
  const minInput = document.getElementById('filterMinPrice');
  const maxInput = document.getElementById('filterMaxPrice');
  if (minInput) minInput.value = '';
  if (maxInput) maxInput.value = '';
  updateSortControlLabel();
  updatePriceControlLabel();
}

function updatePriceControlLabel() {
  const label = document.getElementById('priceControlValue');
  if (!label) return;

  const minValue = productFilterState.min ? `₦${productFilterState.min}` : '';
  const maxValue = productFilterState.max ? `₦${productFilterState.max}` : '';

  if (minValue && maxValue) {
    label.textContent = `${minValue} – ${maxValue}`;
  } else if (minValue) {
    label.textContent = `${minValue}+`;
  } else if (maxValue) {
    label.textContent = `Up to ${maxValue}`;
  } else {
    label.textContent = 'All prices';
  }
}

// Show all products and reset category filters
function updateCategoryActiveTags(activeCategory) {
  document.querySelectorAll('.product-category .category').forEach(tag => {
    tag.classList.toggle('active', activeCategory && tag.textContent.trim().toLowerCase() === activeCategory.toLowerCase());
  });
  if (!activeCategory) {
    document.querySelector('.show-all-btn')?.classList.add('active');
  }
}

function showAllProducts() {
  currentCategoryFilter = null;
  resetProductFilterBar();
  fetchProducts();
  updateCategoryActiveTags(null);
}

// Filter products by category (with toggle support)
function filterByCategory(category) {
  // Toggle: if same category clicked, deselect it; otherwise select the new category
  if (currentCategoryFilter === category) {
    currentCategoryFilter = null; // Deselect the category
    console.log('[DEBUG] Category filter cleared');
  } else {
    currentCategoryFilter = category;
    console.log('[DEBUG] Category filter set to:', category);
  }
  
  // Reset batch loading when changing category
  batchLoadingState.isExpanded = false;

  const isApartmentCategory = allProducts.some(p => p.type === 'apartment' && getApartmentTypeCategoryLabel(p.apartmentType) === category);
  const isLandCategory = category === 'Land';

  if (currentCategoryFilter && isApartmentCategory && allProducts.length > 0) {
    const filteredProducts = allProducts.filter(p => p.type === 'apartment' && getApartmentTypeCategoryLabel(p.apartmentType) === category);
    renderProducts(filteredProducts);
    updateCategoryActiveTags(category);
    return;
  }

  if (currentCategoryFilter && isLandCategory && allProducts.length > 0) {
    const filteredProducts = allProducts.filter(p => p.type === 'land');
    renderProducts(filteredProducts);
    updateCategoryActiveTags(category);
    return;
  }
  
  const params = {
    category: currentCategoryFilter || undefined,
    min: productFilterState.min || undefined,
    max: productFilterState.max || undefined,
    sort: productFilterState.sort || undefined
  };

  fetchProducts(params);
  updateCategoryActiveTags(currentCategoryFilter);
}

function renderProductCard(product, totalCount) {
  // Handle numeric price carefully: allow 0 values and numeric strings
  const price = (product.pricePerKg !== undefined && product.pricePerKg !== null)
    ? parseFloat(product.pricePerKg)
    : 0;
  const displayPrice = Number.isFinite(price) ? price.toFixed(2) : '0.00';
  const unit = product.unit || 'kg';
  const quantity = product.quantity || 0;
  const category = product.category || 'Other';
  const certification = product.certification?.organic ? 'Organic (Certified)' : '';
  const isSoldOut = quantity === 0 || product.status === 'sold-out';
  const sliderMin = isSoldOut ? 0 : 1;
  const sliderValue = isSoldOut ? 0 : 1;
  const sliderMax = Math.max(quantity, 1);
  const addButtonLabel = isSoldOut ? 'Out of Stock' : '<i class="fa-solid fa-basket-shopping"></i> Add to Selection';
  const addButtonDisabled = isSoldOut ? 'disabled' : '';
  const statusBadge = isSoldOut
    ? `<span class="stock-badge stock-badge--sold-out">Out of Stock</span>`
    : `<span class="stock-badge stock-badge--available">${quantity} In-Stock </span>`;

  return `
    <div class="product-card ${isSoldOut ? 'sold-out' : ''}" data-product-id="${product._id}" data-name="${product.name.toLowerCase()} ${product.description ? product.description.toLowerCase() : ''}" data-price="${price}">
      <img src="${product.image}" alt="${product.name}" loading="lazy">
      <div class="product-card-overlay"></div>
      <button type="button" class="card-share-btn" data-share-type="product" data-share-id="${product._id}" data-share-title="${encodeURIComponent(product.name)}" aria-label="Share ${product.name}"><i class="fa-solid fa-share-nodes"></i></button>
      <div class="product-info">
        <div class="product-num">${category}</div>
        <h3>${product.name}</h3>
        <div class="product-price" id="price-${product._id}">${price.toLocaleString()}.00 / ${unit}</div>
        ${certification ? `<div style="font-size: 0.65rem; color: var(--gold-lt); margin-bottom: 4px;">${certification}</div>` : ''}
        <div style="margin-bottom: 8px; display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
          ${statusBadge}
          ${product.minLimit ? `<span style="font-size:0.65rem; color:rgba(255,255,255,0.75);">Min: ${product.minLimit}</span>` : ''}
        </div>
        <div class="weight-slider-wrap">
          <div class="weight-slider-label">
            <span>Weight (${unit})</span>
            <span class="wval" id="wv-${product._id}" style="min-width: 35px; text-align: right;">${sliderValue} ${unit}</span>
          </div>
          <input type="range" class="wrange" min="${sliderMin}" max="${sliderMax}" value="${sliderValue}" step="1" ${isSoldOut ? 'disabled' : ''}
            oninput="updateProductPrice('${product._id}', ${price}, this.value)">
        </div>
        <button class="product-btn ${isSoldOut ? 'product-btn--disabled' : ''}" onclick="addToCartFromCard('${product._id}')" ${addButtonDisabled}>${addButtonLabel}</button>
      </div>
    </div>
  `;
}

function renderApartmentCard(apartment, totalCount) {
  const inferredApartmentType = (() => {
    const desc = (apartment.description || '').toLowerCase();
    if (desc.includes('self-contained') || desc.includes('self contained')) return 'self-contained';
    if (desc.includes('flat')) return 'flat';
    if (desc.includes('room')) return 'room';
    if (desc.includes('house')) return 'house';
    return apartment.type || 'apartment';
  })();
  const apartmentType = apartment.apartmentType || apartment.apartment_type || inferredApartmentType;
  const listingType = apartment.listingType || apartment.listing_type || (apartment.pricePerMonth || apartment.price_per_month ? 'rent' : (apartment.price || apartment.salePrice || apartment.sale_price ? 'sale' : 'rent'));
  const rawRentPrice = apartment.pricePerMonth || apartment.price_per_month || apartment.rentPrice || apartment.rent_price || apartment.price || 0;
  const rawSalePrice = apartment.price || apartment.salePrice || apartment.sale_price || apartment.pricePerMonth || 0;
  const pricePerUnit = listingType === 'rent'
    ? parseFloat(rawRentPrice) || parseFloat(rawSalePrice) || 0
    : parseFloat(rawSalePrice) || parseFloat(rawRentPrice) || 0;
  const priceUnit = apartment.priceUnit || apartment.price_unit || 'month';
  const listingLabel = listingType === 'rent' ? `/${priceUnit}` : 'total';
  const displayPrice = pricePerUnit > 0 ? parseInt(pricePerUnit).toLocaleString() : 'Price on request';
  
  const typeLabel = {
    'room': 'Room',
    'self-contained': 'Self-Con',
    'house': 'House',
    'flat': 'Flat'
  }[apartmentType] || `${apartmentType.charAt(0).toUpperCase() + apartmentType.slice(1)}`;
  
  const bedrooms = Number(apartment.bedrooms || apartment.beds || apartment.bedroom || 0);
  const bathrooms = Number(apartment.bathrooms || apartment.baths || apartment.bathroom || 0);
  const area = Number(apartment.apartmentAreaSqMeters || apartment.areaSqMeters || apartment.apartment_area_sq_meters || apartment.area || 0);
  const addressText = apartment.apartmentAddress || apartment.apartment_address || apartment.location || apartment.address || apartment.description || 'Location not specified';
  const apartmentName = apartment.name || 'Apartment Listing';
  const apartmentCategory = apartment.category || 'Apartment';

  const priceLine = displayPrice === 'Price on request'
    ? displayPrice
    : `NGN${displayPrice} ${listingLabel}`;

  return `
    <div class="apartment-card" data-product-id="${apartment._id}" data-name="${apartmentName.toLowerCase()} ${addressText}" data-price="${pricePerUnit}">
      <img src="${apartment.image || 'https://via.placeholder.com/400x300?text=Apartment'}" alt="${apartmentName}" loading="lazy">
      <button type="button" class="card-share-btn" data-share-type="apartment" data-share-id="${apartment._id}" data-share-title="${encodeURIComponent(apartmentName)}" aria-label="Share ${apartmentName}"><i class="fa-solid fa-share-nodes"></i></button>
      <div class="product-info">
        <div class="product-num">${apartmentCategory}</div>
        <div class="product-num">${typeLabel}</div>
        <h3>${apartmentName}</h3>
        <div class="product-price" id="price-${apartment._id}">${priceLine}</div>
        <div style="font-size: 0.65rem; color: rgba(255,255,255,0.6); margin-bottom: 8px;">
          ${bedrooms > 0 ? bedrooms : 'N/A'}BR / ${bathrooms > 0 ? bathrooms : 'N/A'}BA • ${area > 0 ? area + 'm²' : 'N/A'} • ${apartment.furnished ? 'Furnished' : 'Unfurnished'}
        </div>
        <div style="font-size: 0.65rem; color: rgba(255,255,255,0.6); margin-bottom: 8px;">
          <i class="fa-solid fa-map-marker-alt"></i> ${addressText}
        </div>
        <button class="product-btn apartment-btn" onclick="event.stopPropagation(); addApartmentToCart('${apartment._id}')"><i class="fa-solid fa-basket-shopping"></i> Add to Selection</button>
      </div>
    </div>
  `;
}

function renderLandCard(land, totalCount) {
  const totalPrice = land.landPricingType === 'fixed' 
    ? land.pricePerPlot 
    : (land.pricePerSqMeter * land.areaSqMeters);
  
  const accessibilityEmoji = {
    'road-access': '',
    'water-access': '',
    'both': '',
    'limited': ''
  };

  const legalStatusLabel = {
    'freehold': 'Freehold',
    'leasehold': 'Leasehold',
    'government': 'Government Land',
    'communal': 'Communal',
    'unknown': 'Unknown'
  };

  // Defensive checks for undefined fields
  const landName = land.name || 'Land Property';
  const landLocation = land.location || 'Unknown Location';
  const landImage = land.image || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&q=70';
  const landDescription = land.description || 'Premium land property available for purchase.';
  const pricePerUnit = land.landPricingType === 'fixed' ? land.pricePerPlot : land.pricePerSqMeter;

  return `
    <div class="land-card" data-product-id="${land._id}" data-name="${landName.toLowerCase()} ${landLocation.toLowerCase()}" data-price="${totalPrice}">
      <div class="land-card-header">
        <img src="${landImage}" alt="${landName}" loading="lazy">
        <div class="land-card-overlay"></div>
        <button type="button" class="card-share-btn" data-share-type="land" data-share-id="${land._id}" data-share-title="${encodeURIComponent(landName)}" aria-label="Share ${landName}"><i class="fa-solid fa-share-nodes"></i></button>
        <div class="land-badge">${land.numberOfPlots || 1} Plot${(land.numberOfPlots || 1) > 1 ? 's' : ''}</div>
      </div>
      
      <div class="land-card-content">
        <h3>${landName}</h3>
        
        <p class="land-location"><i class="fa-solid fa-map-marker-alt"></i> ${landLocation}</p>
        
        ${landDescription ? `<p class="land-description">${landDescription}</p>` : ''}
        
        <div class="land-details">
          <div class="detail-item">
            <span class="detail-label"> Area</span>
            <span class="detail-value">${(land.areaSqMeters || 0).toLocaleString()} m</span>
          </div>
          <div class="detail-item">
            <span class="detail-label"> Status</span>
            <span class="detail-value">${legalStatusLabel[land.legalStatus || 'unknown']}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label"> Access</span>
            <span class="detail-value">${accessibilityEmoji[land.accessibility || 'limited']} ${(land.accessibility || 'limited').replace('-', ' ').toUpperCase()}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label"> Plots</span>
            <span class="detail-value">${land.numberOfPlots || 1}</span>
          </div>
        </div>

        <div class="land-pricing">
          <div class="pricing-breakdown">
            ${land.landPricingType === 'per-meter'
              ? `<div class="pricing-line">
                  <span>${(land.pricePerSqMeter || 0).toLocaleString()}</span>
                  <span class="pricing-unit">/ m</span>
                </div>
                <div class="pricing-calc"> ${(land.areaSqMeters || 0).toLocaleString()} m = </div>`
              : `<div class="pricing-line">
                  <span>${(land.pricePerPlot || 0).toLocaleString()}</span>
                  <span class="pricing-unit">/ plot</span>
                </div>`
            }
          </div>
          <div class="land-price" id="price-${land._id}">${totalPrice.toLocaleString()}</div>
        </div>

        <div class="land-range-selector">
          <div class="range-header">
            <label for="land-range-${land._id}">Select Plots:</label>
            <span class="range-value" id="range-value-${land._id}">1</span>
          </div>
          <input type="range" 
            class="land-range" 
            id="land-range-${land._id}" 
            min="${land.minLimit || 1}" 
            max="${land.maxLimit || land.numberOfPlots}" 
            value="1" 
            oninput="updateLandRange('${land._id}', ${pricePerUnit}, ${land.areaSqMeters || 0}, '${land.landPricingType}')"
            style="width: 100%;">
          <div class="range-limits-info">
            <span class="range-min">Min: ${land.minLimit || 1}</span>
            <span class="range-max">Max: ${land.maxLimit || land.numberOfPlots}</span>
          </div>
        </div>

        <button class="land-btn" onclick="addLandToCart('${land._id}', '${land.landPricingType}', ${land.numberOfPlots}, '${landName}')">
          <i class="fa-solid fa-handshake"></i> Inquire Now
        </button>
      </div>
    </div>
  `;
}

function updateProductPrice(productId, pricePerKg, weight) {
  const weightDisplay = document.getElementById(`wv-${productId}`);
  const priceDisplay = document.getElementById(`price-${productId}`);
  const card = document.querySelector(`[data-product-id="${productId}"]`);
  const unit = card?.querySelector('.weight-slider-label span:first-child')?.textContent?.match(/\(([^)]+)\)/)?.[1] || 'kg';
  
  if (weightDisplay) {
    weightDisplay.textContent = weight + ' ' + unit;
  }
  
  if (priceDisplay) {
    const totalPrice = pricePerKg * parseInt(weight);
    priceDisplay.textContent = `${(totalPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${weight}`;
  }
}

function shareListing(type, id, title) {
  const shareUrl = `${window.location.origin}${window.location.pathname}?shareType=${encodeURIComponent(type)}&shareId=${encodeURIComponent(id)}`;
  const shareData = {
    title: `365extra ${type.charAt(0).toUpperCase() + type.slice(1)}: ${title}`,
    text: `Discover this ${type} on 365extra: ${title}`,
    url: shareUrl
  };

  if (navigator.share) {
    navigator.share(shareData)
      .then(() => showNotification('Share dialog opened successfully.', 'success'))
      .catch((err) => {
        console.warn('Share failed:', err);
        navigator.clipboard?.writeText(shareUrl)
          .then(() => showNotification('Link copied to clipboard for sharing.', 'success'))
          .catch(() => {
            prompt('Copy this link to share:', shareUrl);
          });
      });
    return;
  }

  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl)
      .then(() => showNotification('Link copied to clipboard for sharing.', 'success'))
      .catch(() => {
        prompt('Copy this link to share:', shareUrl);
      });
    return;
  }

  prompt('Copy this link to share:', shareUrl);
}

function updateLandQuantity(landId, pricePerUnit, quantity, pricingType) {
  const priceDisplay = document.getElementById(`price-${landId}`);
  if (priceDisplay) {
    const totalPrice = pricingType === 'fixed' ? pricePerUnit * parseInt(quantity) : pricePerUnit;
    priceDisplay.textContent = `${totalPrice.toLocaleString()}`;
  }
}

function updateLandRange(landId, pricePerUnit, areaSqMeters, pricingType) {
  const rangeSlider = document.getElementById(`land-range-${landId}`);
  const rangeValue = document.getElementById(`range-value-${landId}`);
  const priceDisplay = document.getElementById(`price-${landId}`);
  
  if (!rangeSlider || !rangeValue || !priceDisplay) return;
  
  const selectedPlots = parseInt(rangeSlider.value);
  
  // Update plots/units display
  rangeValue.textContent = selectedPlots;
  
  // Calculate total price based on pricing type
  let totalPrice;
  if (pricingType === 'fixed') {
    // For fixed pricing: price per plot  number of plots selected
    totalPrice = pricePerUnit * selectedPlots;
  } else {
    // For per-meter pricing: price per m  total area of selected plots
    totalPrice = pricePerUnit * (areaSqMeters * selectedPlots);
  }
  
  priceDisplay.textContent = `${totalPrice.toLocaleString()}`;
}

// Progressive Image Loading: Ultra-High Quality Effect (Blur-Up Technique)
// Used by Netflix, Medium, Google - shows blurred placeholder then sharp image
function initProgressiveImageLoading() {
  const images = document.querySelectorAll('.product-card img, .land-card img');
  
  images.forEach(img => {
    // Skip if image is already loaded or external URL (not Base64)
    if (img.complete || !img.src.startsWith('data:')) {
      return;
    }

    // Add loading class for blur effect
    img.classList.add('image-loading');
    
    // Create Intersection Observer for lazy loading with blur-up
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const image = entry.target;
          
          // Image is visible - trigger progressive load
          if (image.src) {
            // For Base64 images: simulate progressive by applying blur initially
            image.style.filter = 'blur(15px)';
            
            // Trigger progressive decode
            if ('decode' in image) {
              image.decode()
                .then(() => {
                  // Smooth transition from blur to sharp
                  image.style.transition = 'filter 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                  image.style.filter = 'blur(0px)';
                  image.classList.remove('image-loading');
                  image.classList.add('image-loaded');
                })
                .catch(() => {
                  // Fallback
                  image.style.filter = 'blur(0px)';
                  image.classList.add('image-loaded');
                });
            } else {
              // Fallback for browsers without decode support
              image.onload = () => {
                image.style.filter = 'blur(0px)';
                image.classList.add('image-loaded');
              };
            }
          }
          
          observer.unobserve(image);
        }
      });
    }, {
      rootMargin: '50px' // Start loading 50px before visible
    });
    
    observer.observe(img);
  });
}

function addToCartFromCard(productId){
  // Check if user is authenticated
  if(!apiService.isAuthenticated()){
    showNotification('Please sign in to add items to your cart', 'error');
    openModal('authModal');
    return;
  }

  // Find the product in allProducts array by _id
  const product = allProducts.find(p => p._id === productId);
  if(!product){
    showNotification('Product not found', 'error');
    return;
  }

  // Get the weight from the product card using data-product-id attribute
  const card = document.querySelector(`[data-product-id="${productId}"]`);
  const weight = card ? parseInt(card.querySelector('.wrange').value) : 10;

  addToCart(product, weight);
}

function addApartmentToCart(apartmentId){
  if(!apiService.isAuthenticated()){
    showNotification('Please sign in to add items to your cart', 'error');
    openModal('authModal');
    return;
  }

  const apartment = allProducts.find(p => p._id === apartmentId);
  if(!apartment){
    showNotification('Apartment not found', 'error');
    return;
  }

  addToCart(apartment, 1);
}

// Add land to cart
function addLandToCart(landId, pricingType, maxPlots){
  // Check if user is authenticated
  if(!apiService.isAuthenticated()){
    showNotification('Please sign in to inquire about land', 'error');
    openModal('authModal');
    return;
  }

  // Find the land in allProducts array
  const land = allProducts.find(p => p._id === landId);
  if(!land){
    showNotification('Land property not found', 'error');
    return;
  }

  // Get quantity if multiple plots available
  let quantity = 1;
  if (maxPlots > 1) {
    const qtyInput = document.getElementById(`land-qty-${landId}`);
    quantity = qtyInput ? parseInt(qtyInput.value) : 1;
  }

  // Create cart item for land
  const cartItemKey = `${land._id}_land_${quantity}plots`;
  const existing = cart.find(item => item._id === land._id && item.type === 'land');
  
  if(existing){
    existing.quantity += quantity;
  } else {
    cart.push({
      ...land,
      type: 'land',
      quantity: quantity,
      plotsRequested: quantity
    });
  }
  
  saveCart();
  showNotification(`${land.name} added to inquiry list!`, 'success');
  updateCartDisplay();
  toggleCartSidebar(true);
  loadUserAddressForCheckout();
}

function updateProductSearch(total){
  const cards = document.querySelectorAll('#productGrid .product-card, #productGrid .land-card');
  const noMsg = document.getElementById('noProductsMsg');
  const countEl = document.getElementById('prodCount');
  const psClear = document.getElementById('psClear');

  document.getElementById('productSearch').addEventListener('input', function(){
    const q = this.value.trim().toLowerCase();
    psClear.style.display = q ? 'block' : 'none';
    let vis = 0;
    cards.forEach(c => {
      const name = (c.dataset.name || '').trim().toLowerCase();
      const category = (c.dataset.category || '').trim().toLowerCase();
      const match = !q || name.includes(q) || category.includes(q);
      c.classList.toggle('hidden', !match);
      if(match) vis++;
    });
    noMsg.style.display = vis ? 'none' : 'block';
    countEl.textContent = vis + ' item' + (vis !== 1 ? 's' : '');
  });

  psClear.addEventListener('click', function(){
    document.getElementById('productSearch').value = '';
    this.style.display = 'none';
    cards.forEach(c => c.classList.remove('hidden'));
    noMsg.style.display = 'none';
    countEl.textContent = total + ' items';
  });

  countEl.textContent = total + ' items';
}

/*  NOTIFICATIONS  */
function showNotification(message, type = 'info') {
  const containerId = 'globalNotificationContainer';
  let container = document.getElementById(containerId);

  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 10000;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    min-width: 260px;
    max-width: 340px;
    background: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#34495e'};
    color: white;
    padding: 14px 16px;
    border-radius: 12px;
    box-shadow: 0 12px 30px rgba(0,0,0,0.16);
    opacity: 0;
    transform: translateY(-12px);
    transition: transform 0.25s ease, opacity 0.25s ease;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `;
  notification.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex:1;">
      <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}" style="font-size:1rem;"></i>
      <span style="flex:1;line-height:1.3;">${message}</span>
    </div>
    <button type="button" aria-label="Close notification" style="background:transparent;border:none;color:white;cursor:pointer;font-size:1rem;line-height:1;">
      <i class="fa-solid fa-times"></i>
    </button>
  `;

  const closeButton = notification.querySelector('button');
  closeButton.addEventListener('click', () => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-12px)';
    setTimeout(() => notification.remove(), 250);
  });

  container.appendChild(notification);
  requestAnimationFrame(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    if (!notification.parentElement) return;
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-12px)';
    setTimeout(() => notification.remove(), 250);
  }, 4500);
}

/*  AUTHENTICATION  */
async function handleLogin(){
  const email = document.querySelector('#loginPanel input[type="email"]').value.trim();
  const password = document.querySelector('#loginPanel input[type="password"]').value;

  if(!email || !password){
    showNotification('Please fill in all fields', 'error');
    return;
  }

  const btn = document.querySelector('#loginPanel .auth-submit');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
  btn.disabled = true;

  try {
    const response = await apiService.login(email, password);
    if(response.success){
      // Save user info for UI personalization
      if(response.user){
        localStorage.setItem('365extra_user', JSON.stringify(response.user));
        restoreCartForUser(response.user);
      }

      showNotification('Welcome back!', 'success');
      closeModal('authModal');
      updateAuthButton();
      
      if(cart.length === 0){
        // Show welcome modal if cart is empty
        setTimeout(() => showEmptyCartWelcomeModal(response.user), 500);
      } else {
        // Check if we were trying to checkout
        setTimeout(() => handleCheckout(), 1000);
      }
    } else {
      showNotification(response.message || 'Login failed', 'error');
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  } catch (error) {
    showNotification('Login failed. Please try again.', 'error');
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function handleRegister(){
  const firstName = document.querySelector('#registerPanel input[placeholder="First"]').value.trim();
  const lastName = document.querySelector('#registerPanel input[placeholder="Last"]').value.trim();
  const email = document.querySelector('#registerPanel input[type="email"]').value.trim();
  const phone = document.querySelector('#registerPanel input[type="tel"]').value.trim();
  const password = document.querySelector('#registerPanel input[type="password"]').value;
  const accountType = document.querySelector('#registerAccountType').value;

  if(!firstName || !lastName || !email || !password || !accountType){
    showNotification('Please fill in all required fields', 'error');
    return;
  }

  const btn = document.querySelector('#registerPanel .auth-submit');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';
  btn.disabled = true;

  try {
    const response = await apiService.register(firstName, lastName, email, password, accountType, phone);
    if(response.success){
      // Save user info for UI personalization
      if(response.user){
        localStorage.setItem('365extra_user', JSON.stringify(response.user));
        clearCart();
      }

      showNotification('Account created successfully!', 'success');
      closeModal('authModal');
      updateAuthButton();
      
      // New users always get the welcome modal since cart is empty
      setTimeout(() => showEmptyCartWelcomeModal(response.user), 500);
    } else {
      showNotification(response.message || 'Registration failed', 'error');
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  } catch (error) {
    showNotification('Registration failed. Please try again.', 'error');
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// Auth UI helpers
function updateAuthButton(){
  const authBtn = document.getElementById('authBtn');
  const mobileAuthLink = document.getElementById('mobileAuthLink');
  const user = JSON.parse(localStorage.getItem('365extra_user') || 'null');
  const isAuth = apiService.isAuthenticated() && user;
  const label = isAuth ? `Hi, ${user.firstName}` : 'Register';

  if(authBtn){
    authBtn.textContent = label;
  }
  if(mobileAuthLink){
    mobileAuthLink.textContent = label;
  }
}

function handleAuthButtonClick(){
  if(apiService.isAuthenticated()){
    // Show dashboard instead of logging out directly
    loadUserAnalytics();
    toggleSidebar('dashboardSidebar', true);
  } else {
    openModal('authModal');
    switchAuthTab('register', document.querySelector('.auth-tab:nth-child(2)'));
  }
}

function logout(){
  const user = getCurrentUser();
  if (user) saveCartForUser(user);

  apiService.clearToken();
  localStorage.removeItem('365extra_user');
  clearCart();

  showNotification('Logged out successfully', 'success');
  updateAuthButton();
  closeModal('authModal');
  closeModal('cartModal');
  closeModal('emptyCartModal');
}

function showEmptyCartWelcomeModal(user){
  if(!user) return;
  const modal = document.getElementById('emptyCartModal');
  if(modal){
    const nameElement = document.getElementById('welcomeUserName');
    if(nameElement){
      nameElement.innerHTML = `Welcome, <em>${user.firstName}</em>!`;
    }
    openModal('emptyCartModal');
  }
}

// Add auth form event listeners
document.addEventListener('DOMContentLoaded', () => {
  updateAuthButton();

  // Login form
  const loginForm = document.querySelector('#loginPanel');
  if(loginForm){
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin();
    });
  }

  // Register form
  const registerForm = document.querySelector('#registerPanel');
  if(registerForm){
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleRegister();
    });
  }

  // Also handle button clicks
  document.querySelectorAll('.auth-submit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if(btn.closest('#loginPanel')) handleLogin();
      else if(btn.closest('#registerPanel')) handleRegister();
      else if(btn.closest('#forgotPanel')) handleForgotPassword();
    });
  });
});

async function handleForgotPassword(){
  const email = document.querySelector('#forgotPanel input[type="email"]').value.trim();

  if(!email){
    showNotification('Please enter your email address', 'error');
    return;
  }

  const btn = document.querySelector('#forgotPanel .auth-submit:first-of-type');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
  btn.disabled = true;

  try {
    const response = await apiService.forgotPassword(email);
    if(response.success){
      showNotification('Check your email for the password reset link!', 'success');
      setTimeout(() => switchAuthTab('login', document.querySelector('.auth-tab')), 2000);
    } else {
      showNotification(response.message || 'Failed to send reset link', 'error');
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  } catch (error) {
    showNotification('Error sending reset link', 'error');
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

/*  CHECKOUT FUNCTIONALITY  */

async function loadPaystackScript(){
  if (typeof window.PaystackPop !== 'undefined') {
    return window.PaystackPop;
  }

  // Try to re-use existing script tag if present
  const existing = document.querySelector('script[src="https://js.paystack.co/v1/paystack.js"]');
  if (existing) {
    if (typeof window.PaystackPop !== 'undefined') {
      return window.PaystackPop;
    }

    return new Promise((resolve, reject) => {
      const resolveIfReady = () => {
        if (typeof window.PaystackPop !== 'undefined') {
          resolve(window.PaystackPop);
        } else {
          setTimeout(() => {
            if (typeof window.PaystackPop !== 'undefined') {
              resolve(window.PaystackPop);
            } else {
              reject(new Error('Paystack script loaded but PaystackPop is missing'));
            }
          }, 100);
        }
      };

      existing.addEventListener('load', resolveIfReady);
      existing.addEventListener('error', () => reject(new Error('Failed to load Paystack script')));

      if (existing.readyState && (existing.readyState === 'loaded' || existing.readyState === 'complete')) {
        resolveIfReady();
      }
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/paystack.js';
    script.async = true;
    script.onload = () => {
      if (typeof window.PaystackPop !== 'undefined') {
        resolve(window.PaystackPop);
      } else {
        setTimeout(() => {
          if (typeof window.PaystackPop !== 'undefined') {
            resolve(window.PaystackPop);
          } else {
            reject(new Error('Paystack script loaded but PaystackPop is missing'));
          }
        }, 100);
      }
    };
    script.onerror = () => reject(new Error('Failed to load Paystack script'));
    document.body.appendChild(script);
  });
}

async function handleCheckout(){
  // Check if user is authenticated
  if(!apiService.isAuthenticated()){
    showNotification('Please sign in to proceed with your order', 'error');
    openModal('authModal');
    return;
  }

  // Check if cart is not empty
  if(cart.length === 0){
    showNotification('Your cart is empty', 'error');
    return;
  }

  // Collect and validate address
  const shippingAddress = {
    street: document.getElementById('shippingStreet')?.value?.trim() || '',
    city: document.getElementById('shippingCity')?.value?.trim() || '',
    state: document.getElementById('shippingState')?.value?.trim() || '',
    postalCode: document.getElementById('shippingPostalCode')?.value?.trim() || '',
    country: document.getElementById('shippingCountry')?.value?.trim() || 'Nigeria'
  };

  // Validate required address fields
  const requiredFields = { street: 'Street Address', city: 'City', state: 'State/Province', postalCode: 'Postal Code', country: 'Country' };
  const missingFields = [];
  
  for (const [field, label] of Object.entries(requiredFields)) {
    if (!shippingAddress[field]) {
      missingFields.push(label);
    }
  }

  if (missingFields.length > 0) {
    showNotification(`Please complete your address: ${missingFields.join(', ')}`, 'error');
    return;
  }

  try {
    // Show loading state
    const checkoutBtn = document.getElementById('cartCheckout');
    const originalText = checkoutBtn.innerHTML;
    checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    checkoutBtn.disabled = true;

    console.log('Cart contents:', cart);

    // Collect delivery notes
    const notes = document.getElementById('shippingNotes')?.value?.trim() || '';

    // Initialize payment (this will create the order on successful payment)
    console.log('Sending payment data with address:', {
      items: cart.map(item => ({
        product: item._id,
        quantity: item.quantity,
        weight: item.weight || 1,
        pricePerKg: item.pricePerKg || undefined,
        price: item.price || undefined,
        pricePerMonth: item.pricePerMonth || undefined,
        type: item.type
      })),
      shippingAddress: shippingAddress,
      notes: notes
    });

    const paymentResponse = await apiService.initializePayment({
      items: cart.map(item => ({
        product: item._id,
        quantity: item.quantity,
        weight: item.weight || 1,
        pricePerKg: item.pricePerKg || undefined,
        price: item.price || undefined,
        pricePerMonth: item.pricePerMonth || undefined,
        type: item.type
      })),
      shippingAddress: shippingAddress,
      notes: notes
    });

    console.log('Payment response:', paymentResponse);

    if(!paymentResponse.success){
      throw new Error(paymentResponse.message || 'Failed to initialize payment');
    }

    if (!paymentResponse.data || !paymentResponse.data.authorization_url) {
      throw new Error('Invalid payment response: missing authorization URL');
    }

    console.log('Payment initialized, response data:', paymentResponse.data);
    
    closeModal('cartModal');
    
    // Try to open Paystack modal first
    let paymentHandled = false;
    let PaystackPop;

    try {
      PaystackPop = await loadPaystackScript();
    } catch (err) {
      console.warn('Paystack failed to load, falling back to redirect:', err);
    }

    try {
      if (paymentResponse.data.publicKey && PaystackPop) {
        console.log('\n========== PAYSTACK SETUP ==========');
        console.log('Amount in Kobo:', paymentResponse.data.amountInKobo);
        console.log('Amount in Naira:', paymentResponse.data.amountInNaira);
        console.log('====================================\n');
        const handler = PaystackPop.setup({
          key: paymentResponse.data.publicKey,
          email: paymentResponse.data.customerEmail,
          amount: paymentResponse.data.amountInKobo, // Use amount already in kobo from backend
          currency: 'NGN',
          ref: paymentResponse.data.reference,
          callback: function(response){
            verifyPayment(response.reference);
          },
          onClose: function(){
            showNotification('Payment cancelled', 'error');
            const checkoutBtn = document.getElementById('cartCheckout');
            checkoutBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Proceed to Checkout';
            checkoutBtn.disabled = false;
          }
        });
        handler.openIframe();
        paymentHandled = true;
      }
    } catch (err) {
      console.error('Paystack modal error:', err);
    }

    // If modal didn't work, open authorization URL
    if (!paymentHandled) {
      console.log('Using redirect fallback, opening:', paymentResponse.data.authorization_url);
      showNotification('Redirecting to payment...', 'info');
      setTimeout(() => {
        window.location.href = paymentResponse.data.authorization_url;
      }, 500);
    }

  } catch (error) {
    console.error('Checkout error:', error);
    showNotification(error.message || 'Checkout failed. Please try again.', 'error');
    
    // Reset button
    const checkoutBtn = document.getElementById('cartCheckout');
    checkoutBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Proceed to Checkout';
    checkoutBtn.disabled = false;
  }
}

async function verifyPayment(reference){
  try {
    const response = await apiService.verifyPayment(reference);
    if(response.success && response.data){
      // Extract order ID from response metadata if available
      const orderId = response.data.metadata?.orderId || response.data.id;
      
      showNotification('Payment successful! Your order has been placed.', 'success');
      clearCart();
      closeModal('cartModal');
      
      // Show payment success modal with invoice download option
      setTimeout(() => {
        showPaymentSuccessModal(orderId, response.data);
      }, 1000);
    } else {
      // Handle failed payment
      const failureReason = response.failureReason || 'Payment was declined';
      showPaymentFailureModal(failureReason, reference);
      
      // Keep cart and modal open so user can retry
      const checkoutBtn = document.getElementById('cartCheckout');
      if (checkoutBtn) {
        checkoutBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Proceed to Checkout';
        checkoutBtn.disabled = false;
      }
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    showNotification('Payment verification failed. Please try again or contact support.', 'error');
    
    // Reset button
    const checkoutBtn = document.getElementById('cartCheckout');
    if (checkoutBtn) {
      checkoutBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Proceed to Checkout';
      checkoutBtn.disabled = false;
    }
  }
}

function showPaymentSuccessModal(orderId, orderData) {
  // Create success modal
  const modal = document.createElement('div');
  modal.id = 'paymentSuccessModal';
  modal.className = 'modal-backdrop open';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 12px;
      padding: 40px;
      max-width: 500px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.4s ease-out;
    ">
      <div style="font-size: 60px; margin-bottom: 20px;">${getInlineSvgIcon('check')}</div>
      
      <h2 style="color: #0d0d0b; font-size: 28px; margin-bottom: 10px; font-family: 'Cormorant Garamond', serif;">Payment Successful!</h2>
      
      <p style="color: #666; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        Your payment has been received and your order is being processed. You will receive an invoice via email shortly.
      </p>

      <div style="
        background: linear-gradient(135deg, #f9f9f9 0%, #f0f0f0 100%);
        border-left: 4px solid #ffd700;
        padding: 15px;
        margin-bottom: 20px;
        border-radius: 5px;
        text-align: left;
      ">
        <p style="margin: 0 0 8px 0; color: #0d0d0b; font-weight: bold; font-size: 13px;">Order Reference</p>
        <p style="margin: 0; color: #666; font-size: 12px; font-family: monospace; word-break: break-all;">
          ${orderId || 'Processing...'}
        </p>
      </div>

      <div style="display: grid; gap: 10px; margin-bottom: 20px;">
        <button onclick="downloadInvoice('${orderId}')" style="
          background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
          color: #0d0d0b;
          border: none;
          padding: 12px 20px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
          ${getInlineSvgIcon('download')} Download Invoice
          transition: background 0.2s;
        " onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='#f0f0f0'">
          Close
        </button>
      </div>

      <p style="color: #999; font-size: 12px; line-height: 1.6; text-align:left;">
        ${getDetailBullet('info', 'Invoice has been sent to your email')}<br>
        ${getDetailBullet('package', 'Tracking info will arrive within 24 hours')}<br>
        ${getDetailBullet('message', 'Need help? Contact us on Telegram')}
      </p>
    </div>

    <style>
      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    </style>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closePaymentSuccessModal();
    }
  });
}

function closePaymentSuccessModal() {
  const modal = document.getElementById('paymentSuccessModal');
  if (modal) {
    modal.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => {
      modal.remove();
      if (!document.querySelector('.modal-backdrop.open') && !document.getElementById('searchOverlay')?.classList.contains('open')) {
        document.body.style.overflow = '';
      }
    }, 300);
  }
}

function showPaymentFailureModal(failureReason, reference) {
  // Create failure modal
  const modal = document.createElement('div');
  modal.id = 'paymentFailureModal';
  modal.className = 'modal-backdrop open';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 12px;
      padding: 40px;
      max-width: 500px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.4s ease-out;
    ">
      <div style="font-size: 60px; margin-bottom: 20px;">${getInlineSvgIcon('cross')}</div>
      
      <h2 style="color: #d32f2f; font-size: 28px; margin-bottom: 10px; font-family: 'Cormorant Garamond', serif;">Payment Failed</h2>
      
      <p style="color: #666; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        Unfortunately, your payment could not be processed. Your order details have been saved.
      </p>

      <div style="
        background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
        border-left: 4px solid #d32f2f;
        padding: 15px;
        margin-bottom: 20px;
        border-radius: 5px;
        text-align: left;
      ">
        <p style="margin: 0 0 8px 0; color: #0d0d0b; font-weight: bold; font-size: 13px;">Failure Reason</p>
        <p style="margin: 0; color: #666; font-size: 12px; font-family: monospace; word-break: break-all;">
          ${failureReason || 'Your payment was declined by the processor'}
        </p>
      </div>

      <div style="
        background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
        border-left: 4px solid #27ae60;
        padding: 15px;
        margin-bottom: 20px;
        border-radius: 5px;
        text-align: left;
      ">
        <p style="margin: 0 0 8px 0; color: #0d0d0b; font-weight: bold; font-size: 13px;">${getInlineSvgIcon('check')} What You Can Do</p>
        <ul style="margin: 0; padding-left: 15px; color: #555; font-size: 12px; line-height: 1.6;">
          <li>Check your card details and try again</li>
          <li>Use a different payment method</li>
          <li>Contact your bank for any restrictions</li>
          <li>Reach out to our support team via Telegram</li>
        </ul>
      </div>

      <div style="display: grid; gap: 10px; margin-bottom: 20px;">
        <button onclick="retryPayment()" style="
          background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
          color: #0d0d0b;
          border: none;
          padding: 12px 20px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
          ${getInlineSvgIcon('retry')} Try Again
          transition: background 0.2s;
        " onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='#f0f0f0'">
          Keep Shopping
        </button>
      </div>

      <p style="color: #999; font-size: 12px; line-height: 1.6; text-align:left;">
        ${getDetailBullet('info', 'Your cart is still saved')}<br>
        ${getDetailBullet('message', 'Check your email for details')}<br>
        ${getDetailBullet('message', 'Support available 24/7 on Telegram')}
      </p>
    </div>

    <style>
      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    </style>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closePaymentFailureModal();
    }
  });
}

function closePaymentFailureModal() {
  const modal = document.getElementById('paymentFailureModal');
  if (modal) {
    modal.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => {
      modal.remove();
      if (!document.querySelector('.modal-backdrop.open') && !document.getElementById('searchOverlay')?.classList.contains('open')) {
        document.body.style.overflow = '';
      }
    }, 300);
  }
}

function retryPayment() {
  closePaymentFailureModal();
  showNotification('Please proceed to checkout again to retry your payment.', 'info');
}

async function handleLandCheckout() {
  try {
    // Land/Apartment checkout - initialize payment without address requirement
    const checkoutBtn = document.getElementById('landPayNowBtn');
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    // Get current user info
    const userResponse = await apiService.getMe();
    if (!userResponse.success) {
      showNotification('Unable to retrieve your information. Please login again.', 'error');
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay Now';
      return;
    }

    const user = userResponse.data;
    const orderItems = cart.map(item => ({
      product: item.id || item._id,
      quantity: item.quantity || item.plotsRequested || 1,
      price: item.type === 'land' 
        ? (item.landPricingType === 'fixed' ? item.pricePerPlot : item.pricePerSqMeter)
        : (item.type === 'apartment' 
          ? (item.listingType === 'rent' ? item.pricePerMonth : item.price)
          : item.pricePerKg),
      type: item.type,
      weight: item.weight || item.areaSqMeters || item.apartmentAreaSqMeters,
      title: item.name
    }));

    // For land/apartments, we don't require shipping address - use user's location info
    const orderData = {
      items: orderItems,
      userEmail: user.email,
      userId: user._id,
      // For real estate, use generic address or skip
      shippingAddress: {
        street: 'Real Estate Transaction',
        city: user.address?.city || 'TBD',
        state: user.address?.state || 'TBD',
        postalCode: user.address?.postalCode || 'TBD',
        country: user.address?.country || 'Nigeria'
      }
    };

    // Initialize payment
    const paymentResponse = await apiService.initializePayment(orderData);
    
    if (!paymentResponse.success || !paymentResponse.data) {
      throw new Error(paymentResponse.data?.message || 'Payment initialization failed');
    }

    // Load Paystack if available
    let PaystackPop;
    try {
      PaystackPop = await loadPaystackScript();
    } catch (err) {
      console.warn('Paystack failed to load for real estate payment, falling back to redirect:', err);
    }
    
    // Try to open Paystack modal first
    let paymentHandled = false;
    
    try {
      if (paymentResponse.data.publicKey && PaystackPop) {
        console.log('PaystackPop available for real estate payment, opening modal...');
        const handler = PaystackPop.setup({
          key: paymentResponse.data.publicKey,
          email: paymentResponse.data.customerEmail,
          amount: paymentResponse.data.amountInKobo,
          currency: 'NGN',
          ref: paymentResponse.data.reference,
          callback: function(response){
            verifyPayment(response.reference);
          },
          onClose: function(){
            showNotification('Payment cancelled', 'error');
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay Now';
          }
        });
        handler.openIframe();
        paymentHandled = true;
      }
    } catch (err) {
      console.error('Paystack modal error:', err);
    }

    // If modal didn't work, use redirect
    if (!paymentHandled) {
      console.log('Using redirect fallback for real estate payment');
      showNotification('Redirecting to payment...', 'info');
      setTimeout(() => {
        window.location.href = paymentResponse.data.authorization_url;
      }, 500);
    }

  } catch (error) {
    console.error('Land/Apartment checkout error:', error);
    showNotification(error.message || 'Checkout failed. Please try again.', 'error');
    
    // Reset button
    const checkoutBtn = document.getElementById('landPayNowBtn');
    checkoutBtn.disabled = false;
    checkoutBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay Now';
  }
}

async function callRealEstateDealer() {
  try {
    // Fetch dealer contact info from database settings
    const settingsResponse = await apiService.getSettings();
    const settings = settingsResponse?.data?.dealerContact || {};
    
    const dealerPhone = settings.phone || '+2348123456789';
    const dealerWhatsApp = settings.whatsapp || '2348123456789';
    const dealerName = settings.name || 'Real Estate Specialist';
    const dealerEmail = settings.email || 'dealer@365extra.com';

    // Create contact modal
    const modal = document.createElement('div');
    modal.id = 'dealerContactModal';
    modal.className = 'modal-backdrop open';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        animation: slideUp 0.3s ease-out;
      ">
        <h3 style="margin: 0 0 10px 0; color: #0d0d0b;"> <i class="fa-solid fa-phone"></i> Contact ${dealerName}</h3>
        <p style="color: #666; margin: 0 0 25px 0; font-size: 0.9rem;">Choose how you'd like to get in touch</p>

        <div style="display: grid; gap: 10px;">
          <button onclick="openWhatsAppDealer('${dealerWhatsApp}')" style="
            background: linear-gradient(135deg, #25D366 0%, #20BA5A 100%);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
            font-size: 0.95rem;
          " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            <i class="fa-brands fa-whatsapp"></i> WhatsApp Chat
          </button>

          <button onclick="callDealerPhone('${dealerPhone}')" style="
            background: linear-gradient(135deg, #0d0d0b 0%, #333 100%);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
            font-size: 0.95rem;
          " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            <i class="fa-solid fa-phone"></i> Call Now
          </button>

          <button onclick="closeDealerModal()" style="
            background: #f0f0f0;
            color: #0d0d0b;
            border: 1px solid #ddd;
            padding: 12px 20px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
            font-size: 0.95rem;
          " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
            Cancel
          </button>
        </div>

        <p style="margin: 20px 0 0 0; padding: 15px; background: rgba(255,215,0,0.1); border-radius: 6px; border-left: 3px solid #ffd700; font-size: 0.85rem; color: #666;">
          ${getDetailBullet('info', 'Your cart will be saved while you contact the dealer')}
        </p>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeDealerModal();
      }
    });

  } catch (error) {
    console.error('Error opening dealer contact:', error);
    showNotification('Unable to open dealer contact. Please try again.', 'error');
  }
}

function openWhatsAppDealer(whatsappNumber) {
  const cartSummary = cart.map(item => {
    if (item.type === 'land') {
      return `${item.name} (${item.plotsRequested || item.quantity} plot(s))`;
    } else if (item.type === 'apartment') {
      return `${item.name} - ${item.apartmentType} (${item.bedrooms}BR/${item.bathrooms}BA)`;
    } else {
      return `${item.name} (${item.quantity} kg)`;
    }
  }).join('\n');
  
  const message = encodeURIComponent(`Hi, I'm interested in the following properties:\n\n${cartSummary}\n\nCould you provide more details and availability?`);
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${message}`;
  
  closeDealerModal();
  window.open(whatsappLink, '_blank');
}

function callDealerPhone(phoneNumber) {
  closeDealerModal();
  window.location.href = `tel:${phoneNumber}`;
}

function closeDealerModal() {
  const modal = document.getElementById('dealerContactModal');
  if (modal) {
    modal.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => {
      modal.remove();
      if (!document.querySelector('.modal-backdrop.open')) {
        document.body.style.overflow = '';
      }
    }, 300);
  }
}


function downloadInvoice(orderId) {
  if (!orderId) {
    showNotification('Order ID not available. Please check your email for the invoice.', 'warning');
    return;
  }

  const token = apiService.getToken();
  if (!token) {
    showNotification('Session expired. Please login again.', 'error');
    return;
  }

  // Create a temporary link to download the invoice
  const downloadUrl = `${API_BASE_URL}/payments/invoice/${orderId}`;
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('Authorization', `Bearer ${token}`);
  link.download = `Invoice-${orderId}.html`;
  
  // Add authorization header using fetch
  fetch(downloadUrl, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to download invoice');
    }
    return response.text();
  })
  .then(html => {
    // Create blob from HTML content
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice-${orderId}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('Invoice downloaded successfully!', 'success');
  })
  .catch(error => {
    console.error('Download error:', error);
    showNotification('Failed to download invoice. It has been sent to your email.', 'error');
  });
}

// Initialize - run immediately if DOM is ready, or wait for DOMContentLoaded if not
async function initializeApp() {
  console.log('[DEBUG] App initialization - Starting');
  
  try {
    // Check if payment was successful and clear cart
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const orderId = params.get('orderId');
    const shouldClearCart = params.get('clearCart');

    if (paymentStatus === 'success' && shouldClearCart === 'true') {
      console.log('[SUCCESS] Payment successful, clearing cart');
      clearCart(); // Clear the cart
      
      // Show success message
      showNotification('Payment successful! Your order has been placed.', 'success');
      
      // Optional: Remove the query parameters from URL to clean it up
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // If we have orderId, you could fetch and display order details
      if (orderId) {
        console.log('[DEBUG] Order ID:', orderId);
        // You can add code here to fetch and display order details
      }
    }
    
    updateCartDisplay();
    setupProductFilterBar();
    
    // Load products - try cache first for faster load, then fetch from server
    const cachedProducts = getProductsFromLocalStorage();
    if (cachedProducts && cachedProducts.length > 0) {
      console.log('[DEBUG] Loading', cachedProducts.length, 'cached products on startup');
      allProducts = cachedProducts;
      renderProducts(cachedProducts);
    }
    
    // Always fetch fresh products from server
    await fetchProducts();
    
    // Add checkout button event listener
    const checkoutBtn = document.getElementById('cartCheckout');
    if(checkoutBtn){
      checkoutBtn.addEventListener('click', handleCheckout);
    }

    // Add contact form listener
    const contactForm = document.querySelector('.contact-form');
    if(contactForm){
      contactForm.addEventListener('submit', handleContactForm);
    }

    // Add newsletter form listener
    const newsletterForm = document.querySelector('.newsletter-form');
    if(newsletterForm){
      newsletterForm.addEventListener('submit', handleNewsletterSubscribe);
    }

    // Stop polling when user leaves the page
    window.addEventListener('beforeunload', stopProductPolling);
    
    // Load global products (search suggestions) - WAIT FOR THIS TO COMPLETE
    console.log('[DEBUG] Loading global products for search...');
    await loadGlobalProducts().catch(e => console.warn('[DEBUG] loadGlobalProducts timed out or failed:', e));
    
    // Attach sidebar close handlers after DOM is ready
    document.querySelectorAll('.sidebar-close').forEach(btn => {
      btn.addEventListener('click', event => {
        event.preventDefault();
        const sidebarOverlay = btn.closest('.sidebar-overlay');
        if (sidebarOverlay) {
          toggleSidebar(sidebarOverlay.id, false);
        } else {
          const cartSidebar = btn.closest('.cart-sidebar');
          if (cartSidebar) {
            toggleCartSidebar(false);
          }
        }
      });
    });

    // FETCH PRODUCTS FIRST - WAIT FOR THIS TO COMPLETE
    console.log('[DEBUG] Fetching products...');
    await fetchProducts();
    await openSharedItemFromUrl();
    
    // NOW start polling for updates
    console.log('[DEBUG] Starting product polling');
    startProductPolling();
    
    // FINALLY hide the loader after products are loaded
    console.log('[DEBUG] Products loaded, hiding loader');
    hidePageLoader();
    
  } catch(error) {
    console.error('[DEBUG] Initialization error:', error);
    hidePageLoader(); // Hide loader even on error
  }
}

// Run immediately if DOM is already loaded (scripts at end of HTML), otherwise wait for event
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already loaded, run initialization immediately
  console.log('[DEBUG] DOM already loaded, initializing immediately');
  initializeApp();
}

// Contact form handler
async function handleContactForm(e){
  e.preventDefault();
  
  const form = e.target;
  const inputs = form.querySelectorAll('input, textarea');
  const [nameInput, emailInput, subjectInput, messageInput] = inputs;
  
  const fullName = nameInput.value.trim();
  const email = emailInput.value.trim();
  const subject = subjectInput.value.trim();
  const message = messageInput.value.trim();
  
  if(!fullName || !email || !subject || !message){
    showNotification('Please fill in all fields', 'error');
    return;
  }
  
  const btn = form.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
  btn.disabled = true;
  
  try {
    const response = await apiService.sendContactMessage(fullName, email, subject, message);
    
    if(response.success){
      showNotification(response.message || 'Message sent successfully!', 'success');
      form.reset();
    } else {
      showNotification(response.message || 'Failed to send message', 'error');
    }
  } catch(error){
    console.error('Contact form error:', error);
    showNotification('Error sending message. Please try again.', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function handleNewsletterSubscribe(e) {
  e.preventDefault();

  const form = e.target;
  const emailInput = form.querySelector('input[type="email"]');
  const email = emailInput?.value.trim();

  if (!email) {
    showNotification('Please enter a valid email address', 'error');
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subscribing...';
  btn.disabled = true;

  try {
    const response = await apiService.subscribeNewsletter(email);
    if (response.success) {
      showNotification(response.message || 'Subscribed successfully!', 'success');
      form.reset();
    } else {
      showNotification(response.message || 'Failed to subscribe. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    showNotification('Failed to subscribe. Please try again later.', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

//  PAGE LOADER & COMPLETION SOUND 

let globalAudioContext = null;

function getAudioContext() {
  if (!globalAudioContext) {
    try {
      globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.log('Audio context not available');
      return null;
    }
  }
  return globalAudioContext;
}

// Create audio context for completion sound
function createCompletionSound() {
  try {
    const audioContext = getAudioContext();
    
    if (!audioContext) {
      showSoundIndicator();
      return;
    }
    
    // Resume if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        playSuccessMelody(audioContext);
      }).catch(err => {
        console.log('Audio resume failed:', err);
        showSoundIndicator();
      });
    } else {
      playSuccessMelody(audioContext);
    }
  } catch (error) {
    console.log('Audio context error:', error.message);
    showSoundIndicator();
  }
}

function playSuccessMelody(audioContext) {
  try {
    // Success melody: Do-Mi-Sol-Do chord
    const notes = [
      { freq: 523.25, duration: 0.15 }, // C5
      { freq: 659.25, duration: 0.15 }, // E5
      { freq: 783.99, duration: 0.15 }, // G5
      { freq: 1046.50, duration: 0.35 } // C6
    ];
    
    let time = audioContext.currentTime;
    
    notes.forEach(note => {
      try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.value = note.freq;
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.25, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + note.duration);
        
        osc.start(time);
        osc.stop(time + note.duration);
        
        time += note.duration * 0.9;
      } catch (e) {
        console.log('Note creation error:', e);
      }
    });
    
    console.log(' Completion sound played');
  } catch (error) {
    console.log('Sound playback error:', error.message);
  }
}

// Show visual indicator when sound plays (fallback)
function showSoundIndicator() {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, var(--gold), var(--gold-lt));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(184, 147, 58, 0.4);
    animation: soundPulse 0.6s ease-out;
  `;
  
  indicator.innerHTML = '<i class="fa-solid fa-volume-high" style="color: white; font-size: 20px;"></i>';
  document.body.appendChild(indicator);
  
  setTimeout(() => indicator.remove(), 600);
}

// Show page loader
function showPageLoader() {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.remove('hidden');
  }
}



// Hide page loader with smooth fade and completion sound
function hidePageLoader() {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    console.log('[DEBUG] Hiding page loader');
    loader.classList.add('hidden');
    console.log('[DEBUG] Page loader hidden successfully');

    if (audioInitialized) {
      setTimeout(() => {
        console.log('[DEBUG] Playing completion sound');
        createCompletionSound();
      }, 300);
    } else {
      audioPlayPending = true;
      console.log('[DEBUG] Audio playback deferred until user interaction');
    }
  } else {
    console.warn('[DEBUG] Page loader element not found');
  }
}

// Add animation for sound indicator
const style = document.createElement('style');
style.textContent = `
  @keyframes soundPulse {
    0% {
      transform: scale(0.8);
      opacity: 1;
    }
    100% {
      transform: scale(1.2);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize loader on page load
showPageLoader();

// Enable audio on first user interaction (browser autoplay policy)
let audioInitialized = false;
let audioPlayPending = false;

function initializeAudio() {
  if (audioInitialized) {
    if (audioPlayPending) {
      audioPlayPending = false;
      createCompletionSound();
    }
    return;
  }

  try {
    const audioContext = getAudioContext();
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        audioInitialized = true;
        console.log(' Audio context initialized on user interaction');
        if (audioPlayPending) {
          audioPlayPending = false;
          createCompletionSound();
        }
      }).catch(err => {
        console.log('Audio initialization failed:', err);
      });
    } else {
      audioInitialized = true;
      if (audioPlayPending) {
        audioPlayPending = false;
        createCompletionSound();
      }
    }
  } catch (error) {
    console.log('Audio initialization error:', error);
  }
}

// Listen for first user interaction to enable audio
document.addEventListener('click', initializeAudio, { once: true });
document.addEventListener('touchstart', initializeAudio, { once: true });
document.addEventListener('keydown', initializeAudio, { once: true });

// Test function for sound (can be called from console or button)
window.testCompletionSound = function() {
  console.log(' Testing completion sound...');
  createCompletionSound();
  showNotification('Sound test triggered! Check your speakers.', 'info');
};

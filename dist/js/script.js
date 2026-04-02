/*  PWA SERVICE WORKER & INSTALL PROMPT  */

// Dynamic API Base URL
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:4000/api'
  : `${window.location.protocol}//${window.location.host}/api`;

console.log('[DEBUG] API_BASE_URL:', API_BASE_URL);

// Global settings object - will be populated from API
let appSettings = {
  taxRate: 10,        // Default fallback
  shippingFee: 2500   // Default fallback
};

// Fetch settings from backend API
async function loadAppSettings() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_BASE_URL}/settings`, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        appSettings.taxRate = result.data.taxRate || 10;
        appSettings.shippingFee = result.data.shippingFee || 2500;
        console.log('[OK] Settings loaded:', appSettings);
      }
    } else {
      console.warn('[WARN] Failed to load settings, using defaults');
    }
  } catch (err) {
    console.warn('[WARN] Settings API call failed, using defaults:', err.message);
  }
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
  document.getElementById(id).classList.add('open');
  document.body.style.overflow='hidden';
  if(id==='chartModal'){
    initAnalyticsOnOpen();
  }
}
function closeModal(id){
  document.getElementById(id).classList.remove('open');
  if(!document.querySelector('.modal-backdrop.open') && !document.getElementById('searchOverlay').classList.contains('open'))
    document.body.style.overflow='';
}
document.querySelectorAll('.modal-backdrop').forEach(m=>{
  m.addEventListener('click',e=>{ if(e.target===m) closeModal(m.id); });
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    document.querySelectorAll('.modal-backdrop.open').forEach(m=>closeModal(m.id));
    closeSearch();
  }
});

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
  {name:"Artesian Smoked Catfish",price:"45,000.00 / kg",img:"https://images.unsplash.com/photo-1599056377759-3388006e62e0?auto=format&fit=crop&w=400&q=70",tags:"artesian smoked catfish fish"},
  {name:"Traditional Pure Garri", price:"18,000.00 / kg",img:"https://images.unsplash.com/photo-1590540179852-2110a54f813a?auto=format&fit=crop&w=400&q=70",tags:"traditional pure garri cassava grain"},
  {name:"Whole Exquisite Kola Nuts",price:"32,000.00 / kg",img:"https://images.unsplash.com/photo-1614701838030-f7034d61053f?auto=format&fit=crop&w=400&q=70",tags:"whole exquisite kola nuts cola nut"},
];

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
        name: p.name,
        price: `${(p.pricePerKg * 1000).toLocaleString()}.00 / kg`,
        img: p.image.replace("w=700", "w=400").replace("q=80", "q=70"),
        tags: `${p.name.toLowerCase()} ${p.description.toLowerCase()}`
      }));
    } else {
      console.warn('Failed to load products:', data.message);
    }
  }catch(e){
    console.error('Error loading products:', e.message);
    // Use fallback products if API fails
  }
}

function openSearch(){
  document.getElementById('searchOverlay').classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(()=>document.getElementById('searchInput').focus(),60);
  renderGlobalSearch('');
}
function closeSearch(){
  document.getElementById('searchOverlay').classList.remove('open');
  document.getElementById('searchInput').value='';
  if(!document.querySelector('.modal-backdrop.open')) document.body.style.overflow='';
}
document.getElementById('searchOverlay').addEventListener('click',e=>{
  if(e.target===document.getElementById('searchOverlay')) closeSearch();
});
document.getElementById('searchClose').addEventListener('click',closeSearch);
function renderGlobalSearch(q){
  const res=document.getElementById("searchResults");
  const none=document.getElementById("searchNoResults");
  const term=q.trim().toLowerCase();
  if(!term){res.innerHTML="";none.style.display="none";return;}
  const matched=globalProducts.filter(p=>p.tags.includes(term)||p.name.toLowerCase().includes(term));
  none.style.display=matched.length?"none":"block";
  res.innerHTML=matched.map(p=>`
    <div class="search-result-card" onclick="closeSearch();document.getElementById('products').scrollIntoView({behavior:'smooth'});">
      <img src="${p.img}" alt="${p.name}" loading="lazy">
      <div class="search-result-info"><h4>${p.name}</h4><p>${p.price}</p></div>
    </div>`).join("");
}
document.getElementById('searchInput').addEventListener('input',function(){ renderGlobalSearch(this.value); });

/*  PRODUCT SECTION SEARCH  */

/*  HAMBURGER  */
let mOpen=false;
document.getElementById('menuBtn').addEventListener('click',function(){
  mOpen=!mOpen;
  document.getElementById('mobileMenu').classList.toggle('open',mOpen);
  const s=this.querySelectorAll('span');
  if(mOpen){s[0].style.transform='translateY(6.5px) rotate(45deg)';s[1].style.opacity='0';s[2].style.transform='translateY(-6.5px) rotate(-45deg)';}
  else s.forEach(x=>{x.style.transform='';x.style.opacity='';});
});
function closeMobile(){
  mOpen=false;
  document.getElementById('mobileMenu').classList.remove('open');
  document.getElementById('menuBtn').querySelectorAll('span').forEach(s=>{s.style.transform='';s.style.opacity='';});
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
     <button class="glass-btn-secondary" onclick="closeModal('dashboardModal');logout();" style="width:100%;margin-top:20px;">Logout</button>`;
}

/*  CART ENGINE  */
const GUEST_CART_KEY = 'agrocrown_cart';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('agrocrown_user') || 'null');
  } catch {
    return null;
  }
}

function getCartStorageKeyForUser(user) {
  if (!user?.email) return GUEST_CART_KEY;
  return `agrocrown_cart_${encodeURIComponent(user.email.toLowerCase())}`;
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

function addToCart(product, weight){
  // Use a unique key combining product ID and weight to handle same product with different weights
  const cartItemKey = `${product._id}_${weight}kg`;
  const existing = cart.find(item => {
    const itemKey = `${item._id}_${item.weight}kg`;
    return itemKey === cartItemKey;
  });
  
  if(existing){
    existing.quantity += 1;
  }else{
    cart.push({...product, weight, quantity: 1});
  }
  saveCart();
  showNotification(`${product.name} added to cart!`, 'success');
  openModal('cartModal');
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

function clearCart(){
  cart = [];
  saveCart();
}

function updateCartDisplay(){
  const itemCount = cart.length;
  
  // Separate items by type
  const productItems = cart.filter(item => item.type !== 'land');
  const landItems = cart.filter(item => item.type === 'land');
  
  // Calculate totals
  const totalWeight = productItems.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
  const totalPlots = landItems.reduce((sum, item) => sum + (item.plotsRequested || item.quantity), 0);
  const totalArea = landItems.reduce((sum, item) => sum + (item.areaSqMeters * (item.plotsRequested || item.quantity)), 0);

  const navBadge = document.getElementById('cartNavBadge');
  if(navBadge){
    navBadge.textContent = itemCount;
    navBadge.classList.toggle('show', itemCount > 0);
  }
  const pill = document.getElementById('cartCountPill');
  if(pill) pill.textContent = itemCount;

  const cartBody = document.getElementById('cartBody');
  const empty = document.getElementById('cartEmpty');
  const list = document.getElementById('cartItemsList');
  const footer = document.getElementById('cartFooter');

  if(!cartBody || !empty || !list || !footer) return;

  if(cart.length === 0){
    empty.style.display = 'block';
    list.innerHTML = '';
    footer.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  footer.style.display = 'block';

  list.innerHTML = cart.map((item, index) => {
    // Check if it's a land item or product item
    if (item.type === 'land') {
      return renderCartLandItem(item, index);
    } else {
      return renderCartProductItem(item, index);
    }
  }).join('');

  // Calculate subtotal for both products and land
  const subtotal = cart.reduce((sum, item) => {
    if (item.type === 'land') {
      const unitPrice = item.landPricingType === 'fixed' 
        ? item.pricePerPlot 
        : (item.pricePerSqMeter * item.areaSqMeters);
      return sum + (unitPrice * (item.plotsRequested || item.quantity));
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
  const total = subtotal + shippingCost + tax;
  
  if(subEl) subEl.textContent = `NGN${subtotal.toFixed(2)}`;
  
  // Update weight/land label and value based on cart composition
  if(weightEl) {
    if (landItems.length > 0 && productItems.length > 0) {
      // Mixed cart: show both
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
      shippingRow = `<div style="display: flex; justify-content: space-between;"><span>Shipping:</span> <span>NGN${shippingCost.toFixed(2)}</span></div>`;
    } else {
      shippingRow = `<div style="display: flex; justify-content: space-between; color: rgba(13, 13, 11, 0.5);"><span>Shipping:</span> <span>Not applicable (Land only)</span></div>`;
    }
    
    totalEl.innerHTML = `
      <div style="display: grid; gap: 8px; font-size: 0.9rem; color: rgba(13, 13, 11, 0.7);">
        <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span> <span>NGN${subtotal.toFixed(2)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Tax (10%):</span> <span>NGN${tax.toFixed(2)}</span></div>
        ${shippingRow}
        <div style="border-top: 2px solid var(--gold); padding-top: 8px; display: flex; justify-content: space-between; font-weight: 600; color: var(--ink); font-size: 1rem;">
          <span>Total:</span> <span>NGN${total.toFixed(2)}</span>
        </div>
      </div>
    `;
  }
}

function renderCartProductItem(item, index) {
  const subtotal = item.pricePerKg * item.weight * item.quantity;
  return `
    <div class="cart-item">
      <img src="${item.image || 'https://via.placeholder.com/80?text=Product'}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/80?text=Product'">
      <div class="cart-item-info">
        <div class="ci-name">${item.name}</div>
        <div class="ci-meta">${item.pricePerKg} / kg  ${item.weight}kg</div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updateCartItemQuantity(${index}, ${item.quantity - 1})">-</button>
          <span class="qty-num">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartItemQuantity(${index}, ${item.quantity + 1})">+</button>
        </div>
      </div>
      <div class="ci-right">
        <div class="ci-subtotal">${subtotal.toFixed(2)}</div>
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
        <div class="ci-location"><i class="fa-solid fa-map-pin"></i> ${item.location}</div>
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

/*  PRODUCT FETCHING  */
let lastProductCount = 0;
let productCheckInterval = null;

async function fetchProducts(){
  try{
    console.log('[DEBUG] Fetching products from', `${API_BASE_URL}/products`);
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${API_BASE_URL}/products`, { signal: controller.signal });
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
      allProducts = data.data; // Store all products
      lastProductCount = data.data.length;
      console.log('[DEBUG] Rendering', data.data.length, 'products');
      renderProducts(data.data);
    } else {
      console.error('[DEBUG] Response not successful:', data.message);
      renderStaticProducts();
    }
  }catch(error){
    console.error('[DEBUG] Failed to fetch products:', error);
    console.error('[DEBUG] Falling back to static products');
    // Fallback to static products if backend not running
    renderStaticProducts();
  }
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
      
      if(data.success && data.data.length !== lastProductCount){
        console.log(`Products updated: ${lastProductCount}  ${data.data.length}`);
        allProducts = data.data;
        lastProductCount = data.data.length;
        renderProducts(data.data);
        
        // Show notification (optional)
        showNotification(`${data.data.length} products available!`);
      }
    }catch(error){
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

function showNotification(message){
  const notification = document.createElement('div');
  notification.className = 'product-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #2ecc71;
    color: white;
    padding: 15px 25px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function renderProducts(products){
  const grid = document.getElementById('productGrid');
  const noMsg = document.getElementById('noProductsMsg');
  const countEl = document.getElementById('prodCount');

  if(products.length === 0){
    grid.innerHTML = '<div class="no-products-msg">No products available.</div>';
    return;
  }

  grid.innerHTML = products.map(product => {
    // Check if it's land or regular product
    if (product.type === 'land') {
      return renderLandCard(product, products.length);
    } else {
      return renderProductCard(product, products.length);
    }
  }).join('');

  // Initialize progressive image loading for ultra-high quality effect
  initProgressiveImageLoading();
  updateProductSearch(products.length);
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
  
  return `
    <div class="product-card" data-product-id="${product._id}" data-name="${product.name.toLowerCase()} ${product.description ? product.description.toLowerCase() : ''}" data-price="${price}">
      <img src="${product.image}" alt="${product.name}" loading="lazy">
      <div class="product-card-overlay"></div>
      <div class="product-info">
        <div class="product-num">${category}</div>
        <h3>${product.name}</h3>
        <div class="product-price" id="price-${product._id}">${displayPrice} / ${unit}</div>
        ${certification ? `<div style="font-size: 0.65rem; color: var(--gold-lt); margin-bottom: 4px;">${certification}</div>` : ''}
        <div style="font-size: 0.65rem; color: rgba(255,255,255,0.6); margin-bottom: 8px;">
          Stock: ${quantity} ${unit}${product.minLimit ? ` | Min: ${product.minLimit}` : ''}
        </div>
        <div class="weight-slider-wrap">
          <div class="weight-slider-label">
            <span>Weight (0  100 ${unit})</span>
            <span class="wval" id="wv-${product._id}">10 ${unit}</span>
          </div>
          <input type="range" class="wrange" min="0" max="100" value="10" step="1"
            oninput="updateProductPrice('${product._id}', ${price}, this.value)">
        </div>
        <button class="product-btn" onclick="addToCartFromCard('${product._id}')"><i class="fa-solid fa-basket-shopping"></i> Add to Selection</button>
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
        <div class="land-badge">${land.numberOfPlots || 1} Plot${(land.numberOfPlots || 1) > 1 ? 's' : ''}</div>
      </div>
      
      <div class="land-card-content">
        <h3>${landName}</h3>
        
        <p class="land-location"><i class="fa-solid fa-map-pin"></i> ${landLocation}</p>
        
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
  const unit = card?.querySelector('.weight-slider-label span:first-child')?.textContent?.split('(')[1]?.split(' ')[2] || 'kg';
  
  if (weightDisplay) {
    weightDisplay.textContent = weight + ' ' + unit;
  }
  
  if (priceDisplay) {
    const totalPrice = pricePerKg * parseInt(weight);
    priceDisplay.textContent = `${totalPrice.toFixed(2)} / ${unit}`;
  }
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

function renderStaticProducts(){
  // Fallback static products
  const products = [
    {_id:'1', name:'Artesian Smoked Catfish', description:'fish', pricePerKg:45000, image:'https://images.unsplash.com/photo-1599056377759-3388006e62e0?auto=format&fit=crop&w=700&q=80'},
    {_id:'2', name:'Traditional Pure Garri', description:'cassava grain', pricePerKg:18000, image:'https://images.unsplash.com/photo-1590540179852-2110a54f813a?auto=format&fit=crop&w=700&q=80'},
    {_id:'3', name:'Whole Exquisite Kola Nuts', description:'cola nut', pricePerKg:32000, image:'https://images.unsplash.com/photo-1614701838030-f7034d61053f?auto=format&fit=crop&w=700&q=80'}
  ];
  allProducts = products; // Store products
  renderProducts(products);
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
  openModal('cartModal');
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
      const match = !q || c.dataset.name.includes(q);
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
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
      <span>${message}</span>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-times"></i>
    </button>
  `;

  // Add to page
  document.body.appendChild(notification);
  
  // Trigger animation
  setTimeout(() => notification.classList.add('open'), 10);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if(notification.parentElement) {
      notification.classList.remove('open');
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

/*  AUTHENTICATION  */
async function handleLogin(){
  const email = document.querySelector('#loginPanel input[type="email"]').value;
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
        localStorage.setItem('agrocrown_user', JSON.stringify(response.user));
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
  const firstName = document.querySelector('#registerPanel input[placeholder="First"]').value;
  const lastName = document.querySelector('#registerPanel input[placeholder="Last"]').value;
  const email = document.querySelector('#registerPanel input[type="email"]').value;
  const phone = document.querySelector('#registerPanel input[type="tel"]').value;
  const password = document.querySelector('#registerPanel input[type="password"]').value;
  const accountType = document.querySelector('#registerPanel input[placeholder*="Buyer"]').value;

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
        localStorage.setItem('agrocrown_user', JSON.stringify(response.user));
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
  const user = JSON.parse(localStorage.getItem('agrocrown_user') || 'null');
  const isAuth = apiService.isAuthenticated() && user;
  const label = isAuth ? `Hi, ${user.firstName}` : 'Register / Login';

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
    openModal('dashboardModal');
  } else {
    openModal('authModal');
  }
}

function logout(){
  const user = getCurrentUser();
  if (user) saveCartForUser(user);

  apiService.clearToken();
  localStorage.removeItem('agrocrown_user');
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
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => {
        if (typeof window.PaystackPop !== 'undefined') {
          resolve(window.PaystackPop);
        } else {
          reject(new Error('Paystack script loaded but PaystackPop is missing'));
        }
      });
      existing.addEventListener('error', () => reject(new Error('Failed to load Paystack script')));
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
        reject(new Error('Paystack script loaded but PaystackPop is missing'));
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

  try {
    // Show loading state
    const checkoutBtn = document.getElementById('cartCheckout');
    const originalText = checkoutBtn.innerHTML;
    checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    checkoutBtn.disabled = true;

    console.log('Cart contents:', cart);

    // Initialize payment (this will create the order on successful payment)
    console.log('Sending payment data:', {
      items: cart.map(item => ({
        product: item._id,
        quantity: item.quantity,
        weight: item.weight || undefined,
        pricePerKg: item.pricePerKg || undefined,
        type: item.type // Include type for backend context
      }))
    });

    const paymentResponse = await apiService.initializePayment({
      items: cart.map(item => ({
        product: item._id,
        quantity: item.quantity,
        weight: item.weight || undefined,
        pricePerKg: item.pricePerKg || undefined,
        type: item.type // Include type for backend context
      }))
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
    
    try {
      if (paymentResponse.data.publicKey && typeof PaystackPop !== 'undefined') {
        console.log('PaystackPop available, opening modal...');
        console.log('Amount in Kobo:', paymentResponse.data.amountInKobo, 'Amount in Naira:', paymentResponse.data.amountInNaira);
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
    if(response.success){
      showNotification('Payment successful! Your order has been placed.', 'success');
      clearCart();
      closeModal('cartModal');
      // Redirect to orders page or show success message
    } else {
      showNotification('Payment verification failed. Please contact support.', 'error');
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    showNotification('Payment verification failed. Please contact support.', 'error');
  }
}

// Initialize - run immediately if DOM is ready, or wait for DOMContentLoaded if not
async function initializeApp() {
  console.log('[DEBUG] App initialization - Starting');
  
  try {
    updateCartDisplay();
    
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

    // Stop polling when user leaves the page
    window.addEventListener('beforeunload', stopProductPolling);
    
    // Load global products (search suggestions) in background
    loadGlobalProducts().catch(e => console.warn('[DEBUG] loadGlobalProducts timed out or failed:', e));
    
    // FETCH PRODUCTS FIRST - WAIT FOR THIS TO COMPLETE
    console.log('[DEBUG] Fetching products...');
    await fetchProducts();
    
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
    // Play completion sound
    createCompletionSound();
    
    // Hide loader with animation
    setTimeout(() => {
      loader.classList.add('hidden');
      console.log('[DEBUG] Page loader hidden successfully');
    }, 100);
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

function initializeAudio() {
  if (audioInitialized) return;
  
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        audioInitialized = true;
        console.log(' Audio context initialized on user interaction');
      }).catch(err => console.log('Audio initialization failed:', err));
    } else {
      audioInitialized = true;
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
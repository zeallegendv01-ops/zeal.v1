/* ══════════════════ PRODUCT FETCHING ══════════════════ */
let globalProducts = [
  {name:"Artesian Smoked Catfish",price:"$45.00 / kg",img:"https://images.unsplash.com/photo-1599056377759-3388006e62e0?auto=format&fit=crop&w=400&q=70",tags:"artesian smoked catfish fish"},
  {name:"Traditional Pure Garri", price:"$18.00 / kg",img:"https://images.unsplash.com/photo-1590540179852-2110a54f813a?auto=format&fit=crop&w=400&q=70",tags:"traditional pure garri cassava grain"},
  {name:"Whole Exquisite Kola Nuts",price:"$32.00 / kg",img:"https://images.unsplash.com/photo-1614701838030-f7034d61053f?auto=format&fit=crop&w=400&q=70",tags:"whole exquisite kola nuts cola nut"},
];

async function loadGlobalProducts(){
  try{
    const response = await fetch("http://localhost:4000/api/products");
    const data = await response.json();
    if(data.success){
      globalProducts = data.data.map(p => ({
        name: p.name,
        price: `$${p.pricePerKg.toFixed(2)} / kg`,
        img: p.image.replace("w=700", "w=400").replace("q=80", "q=70"),
        tags: `${p.name.toLowerCase()} ${p.description.toLowerCase()}`
      }));
    }
  }catch(e){}
}

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

async function fetchProducts(){
  try{
    const response = await fetch("http://localhost:4000/api/products");
    const data = await response.json();
    if(data.success){
      renderProducts(data.data);
    }
  }catch(error){
    console.error("Failed to fetch products:", error);
    // Fallback to static products if backend not running
    renderStaticProducts();
  }
}

function renderProducts(products){
  const grid = document.getElementById("productGrid");
  const noMsg = document.getElementById("noProductsMsg");
  const countEl = document.getElementById("prodCount");

  if(products.length === 0){
    grid.innerHTML = "<div class=\"no-products-msg\">No products available.</div>";
    return;
  }

grid.innerHTML = products.map(product => {
    const origin = product.origin || 'Nigeria';
    const category = product.category || 'Other';
    const hasStock = product.quantity && product.quantity > 0;
    const certText = product.certification?.organic ? '✓ Organic' : '';
    
    return `
      <div class="product-card" data-product-id="${product._id}" data-name="${product.name.toLowerCase()} ${product.description.toLowerCase()}" data-price="${product.pricePerKg}" title="${product.description}">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        <div class="product-card-overlay"></div>
        <div class="product-info">
          <div class="product-num">${category}</div>
          <div style="font-size: 0.65rem; color: rgba(255,255,255,0.5); margin-bottom: 4px;">📍 ${origin}</div>
          <h3 title="${product.description}">${product.name}</h3>
          ${product.description ? `<p style="font-size: 0.65rem; color: rgba(255,255,255,0.7); line-height: 1.3; margin-bottom: 6px; max-height: 40px; overflow: hidden;">${product.description}</p>` : ''}
              <span>Weight (0 – 100 kg)</span>
              <span class="wval" id="wv-${product._id}">10 kg</span>
            </div>
            <input type="range" class="wrange" min="0" max="100" value="10" step="1"
              oninput="updateProductPrice('${product._id}', ${product.pricePerKg}, this.value)">
          </div>
          <button class="product-btn" onclick="addToCartFromCard('${product._id}')"><i class="fa-solid fa-basket-shopping"></i> Add to Selection</button>
        </div>
      </div>
    `;
  }).join("");

  // Update search functionality
  updateProductSearch(products.length);
}

function renderStaticProducts(){
  // Fallback static products
  const products = [
    {_id:"1", name:"Artesian Smoked Catfish", description:"fish", pricePerKg:45, image:"https://images.unsplash.com/photo-1599056377759-3388006e62e0?auto=format&fit=crop&w=700&q=80"},
    {_id:"2", name:"Traditional Pure Garri", description:"cassava grain", pricePerKg:18, image:"https://images.unsplash.com/photo-1590540179852-2110a54f813a?auto=format&fit=crop&w=700&q=80"},
    {_id:"3", name:"Whole Exquisite Kola Nuts", description:"cola nut", pricePerKg:32, image:"https://images.unsplash.com/photo-1614701838030-f7034d61053f?auto=format&fit=crop&w=700&q=80"}
  ];
  renderProducts(products);
}

function addToCartFromCard(productId){
  const card = document.querySelector(`[data-name*="${productId}"]`) || document.querySelector(`.product-card:nth-child(${parseInt(productId)})`) || document.querySelector(".product-card");
  if(!card) return;
  const weight = parseInt(card.querySelector(".wrange").value);
  // For static, find product
  const product = {
    _id: productId,
    name: card.querySelector("h3").textContent,
    pricePerKg: parseFloat(card.querySelector(".product-price").textContent.replace("$", "").replace(" / kg", "")),
    image: card.querySelector("img").src
  };
  addToCart(product, weight);
}

function updateProductSearch(total){
  const pcards = document.querySelectorAll("#productGrid .product-card");
  const noMsg = document.getElementById("noProductsMsg");
  const countEl = document.getElementById("prodCount");
  const psClear = document.getElementById("psClear");

  document.getElementById("productSearch").addEventListener("input", function(){
    const q = this.value.trim().toLowerCase();
    psClear.style.display = q ? "block" : "none";
    let vis = 0;
    pcards.forEach(c => {
      const match = !q || c.dataset.name.includes(q);
      c.classList.toggle("hidden", !match);
      if(match) vis++;
    });
    noMsg.style.display = vis ? "none" : "block";
    countEl.textContent = vis + " product" + (vis !== 1 ? "s" : "");
  });

  psClear.addEventListener("click", function(){
    document.getElementById("productSearch").value = "";
    this.style.display = "none";
    pcards.forEach(c => c.classList.remove("hidden"));
    noMsg.style.display = "none";
    countEl.textContent = total + " products";
  });

  countEl.textContent = total + " products";
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  updateCartDisplay();
  loadGlobalProducts();
  fetchProducts();
});
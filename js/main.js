/* ===========================
  CONFIG "PRO" V3.0
=========================== */
const SCRIPT_URL = document.body.dataset.apiUrl;
const PAGE_SIZE = 10;
const BANNER_TEXT = `Livraison gratuite selon la zone — Offre limitée !`;
const LOGO_SUBTEXT = `Nouveautés chaque semaine !`;
const YOUTUBE_EMBED_URL = ""; 

const SHIPPING_THRESHOLD = 100.00;
const LOW_STOCK_THRESHOLD = 5;
const MAX_ITEMS_PER_ORDER = 5; // Limite logistique stricte

/* ===========================
  GLOBAL VARS
=========================== */
let productsOriginal = [];
let productsAll = [];
let currentPage = 1;
let cart = [];
let shippingRules = []; 
let availablePromos = {}; 
let activePromo = null; 
let COMMUNES_DATA = {}; 
let selectedCountry = ""; 
let selectedShippingRate = null; 
let currentToastTimer;
let imageMap = {};

// État pour le Splash Screen Noël
let appState = {
    userClickedEnter: false,
    dataLoaded: false
};

/* ===========================
  UTILITIES
=========================== */
function formatPrice(v){ return Number(v||0).toFixed(2) + ' €'; }
function calcFourTimes(total){ return (total >= 30.00) ? (total/4).toFixed(2) : null; }
function sanitizeInput(str) { if (!str) return ''; return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]); }
function sanitizeForHtmlId(str) { if (!str) return 'id-undefined'; return 'id-' + String(str).replace(/[^a-zA-Z0-9_-]/g, '_'); }
function normalizeData(str) { if (!str) return ""; return String(str).trim().replace(/,/g, '.').toLowerCase(); }

function animateButtonSuccess(btnElement, originalText = "Ajouter") {
    if(!btnElement) return;
    const originalWidth = btnElement.offsetWidth;
    btnElement.style.width = `${originalWidth}px`;
    btnElement.textContent = "Ajouté !";
    btnElement.classList.add('btn-success');
    btnElement.disabled = true;
    setTimeout(() => {
        btnElement.classList.remove('btn-success');
        btnElement.textContent = originalText;
        btnElement.disabled = false;
        btnElement.style.width = '';
    }, 1500);
}

/* ===========================
  LOGIQUE SPLASH SCREEN
=========================== */
function checkSplash() {
    if (appState.userClickedEnter && appState.dataLoaded) {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.visibility = 'hidden';
                splash.style.display = 'none';
            }, 500);
        }
    }
}

/* ===========================
  FONCTIONS UX
=========================== */
function showToast(message) {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  toast.innerHTML = `<span>🛍️</span> ${message}`;
  toast.classList.add('show');
  clearTimeout(currentToastTimer);
  currentToastTimer = setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

function showErrorModal(message) {
  document.getElementById('alert-message').textContent = message;
  const modal = document.getElementById('alert-modal');
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function showConfirm(message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  modal.querySelector('#confirm-message').textContent = message;
  const btnYes = document.getElementById('confirm-yes');
  const btnNo = document.getElementById('confirm-no');
  
  const newBtnYes = btnYes.cloneNode(true);
  btnYes.parentNode.replaceChild(newBtnYes, btnYes);
  const newBtnNo = btnNo.cloneNode(true);
  btnNo.parentNode.replaceChild(newBtnNo, btnNo);

  newBtnYes.onclick = () => { modal.classList.add('hidden'); document.body.classList.remove('modal-open'); onConfirm(); };
  newBtnNo.onclick = () => { modal.classList.add('hidden'); document.body.classList.remove('modal-open'); };
  
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function showTextModal(modalId) { 
    const m = document.getElementById(modalId);
    if(m) { m.classList.remove('hidden'); document.body.classList.add('modal-open'); }
}

function showIframeModal(url, title) {
  const modal = document.getElementById('iframe-modal');
  const titleEl = document.getElementById('iframe-title');
  const iframeEl = document.getElementById('iframe-content');
  
  if(modal && iframeEl) {
      if(titleEl) titleEl.textContent = title || "Information";
      iframeEl.src = url;
      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
  } else {
      console.error("Modale iframe introuvable dans le DOM");
  }
}

/* ===========================
  MODALE APERÇU PRODUIT
=========================== */
function showProductPreviewModal(modelId) {
  const product = productsOriginal.find(p => p.modelBaseId === modelId);
  if (!product) return;

  const modal = document.getElementById('product-preview-modal');
  if(!modal) return;

  const mainImg = document.getElementById('preview-main-image');
  const thumbsCont = document.getElementById('preview-thumbs');

  document.getElementById('preview-title').textContent = product.masterNameBase || 'Produit';
  document.getElementById('preview-description').textContent = product.description || '';

  const catContainer = document.getElementById('preview-category-container');
  catContainer.innerHTML = '';
  if (product._category) {
      const catBadge = document.createElement('span');
      catBadge.className = 'category-link';
      catBadge.textContent = product._category;
      catBadge.onclick = () => {
          modal.classList.add('hidden');
          document.body.classList.remove('modal-open');
          document.getElementById('filter-category').value = product._category;
          applyFiltersAndRender();
          window.scrollTo({top:0, behavior:'smooth'});
      };
      catContainer.appendChild(catBadge);
  }

  const guideBtn = document.getElementById('preview-size-guide');
  if(guideBtn) {
      guideBtn.onclick = (e) => {
          e.preventDefault();
          showIframeModal('https://gdt.kixx.fr', 'Guide des Tailles');
      };
  }

  mainImg.src = product.imageUrls[0];
  thumbsCont.innerHTML = '';
  product.imageUrls.forEach((url, i) => {
      const img = document.createElement('img');
      img.src = url;
      img.className = `preview-thumb ${i===0?'active':''} border border-gray-200 rounded-md cursor-pointer hover:border-orange-400 transition`;
      img.style.width = "60px"; img.style.height = "60px"; img.style.objectFit = "cover";
      
      img.onclick = () => {
          mainImg.src = url;
          Array.from(thumbsCont.children).forEach(c => c.style.borderColor = '#e5e7eb');
          img.style.borderColor = '#FFA133';
      };
      thumbsCont.appendChild(img);
  });

  populatePreviewModalForm(product);
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function populatePreviewModalForm(product) {
    const sizeSelect = document.getElementById('preview-size-select');
    const priceEl = document.getElementById('preview-price');
    const pay4El = document.getElementById('preview-pay4');
    const addBtn = document.getElementById('preview-add-btn');
    const qtyVal = document.getElementById('modal-qty-val'); 

    sizeSelect.innerHTML = '<option value="">-- Choisir --</option>';
    qtyVal.textContent = "1";
    
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn); 

    product.sizes.forEach(s => {
        const stock = Number(s.stock || 0);
        const opt = document.createElement('option');
        opt.value = s.fullId;
        opt.textContent = `${s.size} ${stock<=0 ? '(Épuisé)' : ''}`;
        opt.dataset.price = s.price;
        opt.dataset.stock = stock;
        if(stock<=0) opt.disabled = true;
        sizeSelect.appendChild(opt);
    });

    const updatePrice = () => {
        const opt = sizeSelect.options[sizeSelect.selectedIndex];
        if(opt && opt.value) {
            const p = parseFloat(opt.dataset.price);
            const q = parseInt(qtyVal.textContent);
            const total = p * q;
            priceEl.textContent = formatPrice(total);
            const p4 = calcFourTimes(total);
            pay4El.textContent = p4 ? `4x ${p4} €` : '';
            
            const s = parseInt(opt.dataset.stock);
            newAddBtn.disabled = s <= 0;
            newAddBtn.textContent = s <= 0 ? 'Épuisé' : 'AJOUTER AU PANIER';
        } else {
            priceEl.textContent = '—';
            pay4El.textContent = '';
            newAddBtn.disabled = true;
            newAddBtn.textContent = 'AJOUTER AU PANIER';
        }
    };

    sizeSelect.addEventListener('change', updatePrice);

    document.getElementById('modal-qty-minus').onclick = () => {
        let q = parseInt(qtyVal.textContent);
        if(q > 1) { qtyVal.textContent = q - 1; updatePrice(); }
    };
    document.getElementById('modal-qty-plus').onclick = () => {
        let q = parseInt(qtyVal.textContent);
        const opt = sizeSelect.options[sizeSelect.selectedIndex];
        const max = opt && opt.value ? parseInt(opt.dataset.stock) : 99;
        if(q < max) { qtyVal.textContent = q + 1; updatePrice(); }
    };

    newAddBtn.onclick = () => {
        const opt = sizeSelect.options[sizeSelect.selectedIndex];
        if(!opt || !opt.value) return;
        const qty = parseInt(qtyVal.textContent);
        addToCartLogic(opt.value, product.modelBaseId, parseFloat(opt.dataset.price), qty, opt.text.split(' ')[0], product.masterNameBase, parseInt(opt.dataset.stock), product.imageUrls[0], newAddBtn, true);
    };
}

/* ===========================
  CHARGEMENT & DATA
=========================== */
async function loadProducts(){
  if(!SCRIPT_URL) { showErrorModal('ERREUR CONFIG URL'); return; }
  try {
    const resp = await fetch(`${SCRIPT_URL}?action=getProduits`);
    const data = JSON.parse(await resp.text());
    if(!data.success) throw new Error(data.error);
    
    productsOriginal = data.products || [];
    productsOriginal.forEach(p=>{
        p.imageUrls = (p.imageUrls||[]).length ? p.imageUrls : ['https://placehold.co/400?text=Image'];
        if(p.imageUrl && !p.imageUrls.includes(p.imageUrl)) p.imageUrls.unshift(p.imageUrl);
        p.imageUrl = p.imageUrls[0];
        imageMap[p.modelBaseId] = p.imageUrls;
        p.sizes.forEach(s => s.stock = Number(s.stock||0));
    });

    shippingRules = data.shippingRules || [];
    COMMUNES_DATA = data.communes || {};
    availablePromos = data.promos || {};

    populateFilters();
    applyFiltersAndRender();
    initCountrySelector();
    updateCartDisplays();

    // SIGNAL FIN CHARGEMENT
    appState.dataLoaded = true;
    checkSplash();

  } catch(e) { console.error(e); }
}

function initCountrySelector() {
    const selector = document.getElementById('country-selector');
    if(!selector) return;
    selector.innerHTML = '<option value="">-- Choisir --</option>';
    
    const countries = new Set();
    Object.keys(COMMUNES_DATA).forEach(k => countries.add(k));
    shippingRules.forEach((r, i) => {
        if(i===0) return; 
        const zoneKey = r[0]; 
        if(zoneKey) { const parts = zoneKey.split('_'); if(parts.length > 0) countries.add(parts[0]); }
    });

    Array.from(countries).sort().forEach(c => {
        let label = c;
        if(c === 'GUA' || c === 'Guadeloupe') label = 'Guadeloupe';
        else if(c === 'FRA' || c === 'France') label = 'France Métropolitaine';
        else if(c === 'MTQ' || c === 'Martinique') label = 'Martinique';
        else if(c === 'GUY' || c === 'Guyane') label = 'Guyane';
        else if(c === 'COR' || c === 'Corse') label = 'Corse';
        
        selector.innerHTML += `<option value="${c}">${label}</option>`;
    });

    selector.addEventListener('change', (e) => {
        selectedCountry = e.target.value;
        // On efface la sélection de livraison si on change de pays
        selectedShippingRate = null;
        renderShippingMethods(selectedCountry);
        toggleAddressFields(selectedCountry);
    });
}/* ===========================
  PARTIE 2 : LOGIQUE MÉTIER
=========================== */

function renderShippingMethods(country) {
    const container = document.getElementById('shipping-methods-container');
    container.innerHTML = '';
    selectedShippingRate = null;
    updateCartDisplays(); // Met à jour le total sans livraison pour l'instant

    if (!country) {
        container.innerHTML = '<div class="muted text-sm">Sélectionnez une destination.</div>';
        return;
    }

    // --- NOUVELLE LOGIQUE BOUT DE CHAÎNE ---
    // On vérifie si l'adresse est saisie avant d'afficher les options de livraison
    const form = document.getElementById('quick-form');
    const addressVal = form.adresse.value.trim();
    const zipVal = form.codepostal ? form.codepostal.value.trim() : '';
    const domVal = form['dom-postal'] ? form['dom-postal'].value : '';

    // Si on est sur DOM (GUA/MTQ...) on vérifie le select de commune, sinon on vérifie CP + Adresse
    let hasAddress = false;
    if (COMMUNES_DATA[country === 'Guadeloupe' ? 'GUA' : (country === 'Martinique' ? 'MTQ' : (country === 'Guyane' ? 'GUY' : country))]) {
         if(domVal && addressVal) hasAddress = true;
    } else {
         if(zipVal && addressVal) hasAddress = true;
    }

    if(!hasAddress) {
        container.innerHTML = '<div class="muted text-sm italic text-orange-500">Veuillez saisir votre adresse complète ci-dessous pour voir les tarifs de livraison.</div>';
        return;
    }
    // ---------------------------------------

    const subTotal = getCartSubTotal();
    let searchStr = country;
    if(country === 'GUA') searchStr = 'Guadeloupe';
    if(country === 'FRA') searchStr = 'France';
    if(country === 'MTQ') searchStr = 'Martinique';
    if(country === 'GUY') searchStr = 'Guyane';
    if(country === 'COR') searchStr = 'Corse';

    const relevantRules = shippingRules.filter((row, i) => {
        if(i === 0) return false; 
        const zoneKey = row[0]; 
        const minPrice = parseFloat(row[3]); 
        const maxPrice = parseFloat(row[4]);
        
        if(!zoneKey) return false;

        const matchesCountry = zoneKey.includes(searchStr) || (['Martinique','Guyane'].includes(searchStr) && zoneKey.includes('Antilles'));
        const matchesPrice = subTotal >= minPrice && subTotal <= maxPrice;
        return matchesCountry && matchesPrice;
    });

    if (relevantRules.length === 0) {
        container.innerHTML = '<div class="text-red-500 text-sm">Aucune livraison disponible pour ce montant/zone.</div>';
        return;
    }

    relevantRules.forEach(row => {
        const rateId = row[1];
        const price = parseFloat(row[2]);
        let logoUrl = row[5]; 
        if(logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('assets/')) { logoUrl = 'assets/' + logoUrl; }
        const label = rateId.split('_').slice(1).join(' ') || rateId;

        const div = document.createElement('div');
        div.className = 'border rounded p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition';
        div.onclick = () => selectShippingMethod(rateId, price, label, div);

        let imgHtml = '';
        if(logoUrl) imgHtml = `<img src="${logoUrl}" class="h-8 w-auto object-contain mr-3">`;

        div.innerHTML = `
            <div class="flex items-center">
                <input type="radio" name="shipping_method" class="mr-3">
                ${imgHtml}
                <span class="font-bold text-sm text-gray-700">${label}</span>
            </div>
            <span class="font-bold text-gray-900">${price === 0 ? 'Gratuit' : formatPrice(price)}</span>
        `;
        container.appendChild(div);
    });
}

function getCartSubTotal() {
    let sub = cart.reduce((a,c)=>a + c.price*c.quantity, 0);
    let discount = 0;
    if(activePromo) {
        if(activePromo.value < 1) discount = sub * activePromo.value;
        else discount = activePromo.value;
    }
    let total = sub - discount;
    return total < 0 ? 0 : total;
}

function selectShippingMethod(id, cost, name, element) {
    const container = document.getElementById('shipping-methods-container');
    container.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
    container.querySelectorAll('div').forEach(d => d.classList.remove('border-orange-500', 'bg-orange-50'));
    const radio = element.querySelector('input');
    radio.checked = true;
    element.classList.add('border-orange-500', 'bg-orange-50');
    selectedShippingRate = { id: id, cost: cost, name: name };
    updateCartDisplays();
}

function toggleAddressFields(country) {
    const domContainer = document.getElementById('dom-postal-container');
    const cityContainer = document.getElementById('city-container');
    const domSelect = document.getElementById('dom-postal');

    let code = country;
    if(country === 'Guadeloupe') code = 'GUA';
    if(country === 'Martinique') code = 'MTQ';
    if(country === 'Guyane') code = 'GUY';
    if(country === 'France') code = 'FRA';

    if (COMMUNES_DATA[code]) {
        domContainer.classList.remove('hidden');
        cityContainer.classList.add('hidden');
        domSelect.innerHTML = '<option value="">-- Choisir Commune --</option>';
        COMMUNES_DATA[code].sort((a,b) => a.ville.localeCompare(b.ville)).forEach(c => {
            domSelect.innerHTML += `<option value="${c.cp} ${c.ville}">${c.cp} - ${c.ville}</option>`;
        });
    } else {
        domContainer.classList.add('hidden');
        cityContainer.classList.remove('hidden');
    }
}

/* ===========================
  FILTRES & RENDU
=========================== */
function populateFilters(){
    const sizes = new Set();
    const cats = new Set();
    productsOriginal.forEach(p => {
        (p.sizes||[]).forEach(s => { if(s.size) sizes.add(normalizeData(s.size)); });
        if(p._category) cats.add(String(p._category).trim());
    });
    const sortedSizes = Array.from(sizes).sort((a,b) => {
        const na = parseFloat(a.replace(',','.'));
        const nb = parseFloat(b.replace(',','.'));
        return (isNaN(na) || isNaN(nb)) ? a.localeCompare(b) : na - nb;
    });
    const selSize = document.getElementById('filter-size');
    const selCat = document.getElementById('filter-category');
    const mobSize = document.getElementById('filter-size-mobile');
    const mobCat = document.getElementById('filter-category-mobile');

    if(selSize) selSize.innerHTML = '<option value="">Toutes tailles</option>';
    if(selCat) selCat.innerHTML = '<option value="">Toutes catégories</option>';
    if(mobSize) mobSize.innerHTML = '';
    if(mobCat) mobCat.innerHTML = '';

    sortedSizes.forEach(s => {
        if(selSize) selSize.innerHTML += `<option value="${escapeHtml(s)}">${escapeHtml(s.toUpperCase())}</option>`;
        if(mobSize) mobSize.innerHTML += `<button class="filter-btn" data-type="size" data-val="${escapeHtml(s)}">${escapeHtml(s.toUpperCase())}</button>`;
    });

    Array.from(cats).sort().forEach(c => {
        if(selCat) selCat.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
        if(mobCat) mobCat.innerHTML += `<button class="filter-btn" data-type="category" data-val="${escapeHtml(c)}">${escapeHtml(c)}</button>`;
    });

    document.querySelectorAll('.filter-btn').forEach(b => {
        b.onclick = (e) => {
            const type = e.target.dataset.type;
            const val = e.target.dataset.val;
            document.getElementById(`filter-${type}`).value = val;
            document.querySelectorAll(`.filter-btn[data-type="${type}"]`).forEach(x => x.classList.remove('active'));
            e.target.classList.add('active');
            applyFiltersAndRender();
            document.getElementById('filter-overlay').classList.remove('open');
        };
    });
}

function applyFiltersAndRender() {
    const sVal = document.getElementById('filter-size').value;
    const cVal = document.getElementById('filter-category').value;
    const qVal = document.getElementById('search').value.trim().toLowerCase();

    productsAll = productsOriginal.filter(p => {
        const matchCat = !cVal || (p._category && String(p._category).trim() === cVal);
        const matchSize = !sVal || (p.sizes||[]).some(s => normalizeData(s.size) === sVal);
        const matchQuery = !qVal || (p.masterNameBase||'').toLowerCase().includes(qVal);
        return matchCat && matchSize && matchQuery;
    });
    renderPage(1);
    renderPagination();
}

function renderPage(page) {
    currentPage = page;
    const start = (page-1)*PAGE_SIZE;
    const items = productsAll.slice(start, start+PAGE_SIZE);
    const cont = document.getElementById('catalogue');
    cont.innerHTML = '';

    if(!items.length) { cont.innerHTML = '<div class="col-span-full text-center muted py-10">Aucun produit ne correspond.</div>'; return; }

    items.forEach(prod => {
        const safeId = sanitizeForHtmlId(prod.modelBaseId);
        const basePrice = (prod.sizes[0]||{}).price || 0;
        const pay4 = calcFourTimes(basePrice);
        
        let chipsHtml = '<div class="size-chips-container">';
        prod.sizes.forEach(s => {
            const stock = Number(s.stock);
            const dis = stock <= 0 ? 'disabled' : '';
            chipsHtml += `<div class="size-chip ${dis}" 
                            data-id="${s.fullId}" data-price="${s.price}" data-stock="${stock}"
                            onclick="window.selectGridChip(this, '${safeId}')">${s.size}</div>`;
        });
        chipsHtml += '</div>';

        const card = document.createElement('article');
        card.className = 'product-card';
        // Ajout du lien Guide des Tailles à côté de la catégorie
        card.innerHTML = `
            <div class="img-frame" onclick="showProductPreviewModal('${prod.modelBaseId}')">
                ${(prod.sizes.reduce((a,b)=>a+b.stock,0) < LOW_STOCK_THRESHOLD) ? '<div class="product-badge">Stock Limité</div>' : ''}
                <img src="${prod.imageUrls[0]}" class="product-image" alt="${escapeHtml(prod.masterNameBase)}">
            </div>
            <div class="product-meta">
                <div>
                    <div class="product-title">${escapeHtml(prod.masterNameBase)}</div>
                    <div class="category-row">
                         ${prod._category ? `<span class="category-link" onclick="window.filterByCategory('${escapeHtml(prod._category)}')">${escapeHtml(prod._category)}</span>` : '<span></span>'}
                         <span class="grid-size-guide-link" onclick="showIframeModal('https://gdt.kixx.fr', 'Guide des Tailles'); event.stopPropagation();">Guide des tailles</span>
                    </div>
                    <div class="product-desc">${escapeHtml(prod.description)}</div>
                </div>
                ${chipsHtml}
                <div class="action-row">
                    <div class="price-block">
                        <div class="price" id="price_${safeId}">${formatPrice(basePrice)}</div>
                        <div class="pay4-badge" id="p4_${safeId}">${pay4 ? '4x '+pay4+'€' : ''}</div>
                    </div>
                    <div class="controls-block">
                        <div class="qty-tactile" id="qty_box_${safeId}" style="opacity: 0.5; pointer-events: none;">
                            <button class="qty-btn-round" onclick="window.updateGridQty('${safeId}', -1)">－</button>
                            <span class="qty-val" id="qty_val_${safeId}">1</span>
                            <button class="qty-btn-round" onclick="window.updateGridQty('${safeId}', 1)">＋</button>
                        </div>
                        <button class="add-btn" id="btn_${safeId}" disabled onclick="window.addGridToCart('${safeId}', '${prod.modelBaseId}', this)">
                            Taille ?
                        </button>
                    </div>
                </div>
            </div>
        `;
        cont.appendChild(card);
    });
}

window.filterByCategory = function(cat) {
    document.getElementById('filter-category').value = cat;
    document.querySelectorAll('.filter-btn[data-type="category"]').forEach(b => b.classList.remove('active'));
    const mobBtn = document.querySelector(`.filter-btn[data-val="${cat}"]`);
    if(mobBtn) mobBtn.classList.add('active');
    applyFiltersAndRender();
    window.scrollTo({top:0, behavior:'smooth'});
};

window.selectGridChip = function(chip, safeId) {
    if(chip.classList.contains('disabled')) return;
    chip.parentNode.querySelectorAll('.size-chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');

    const price = parseFloat(chip.dataset.price);
    const stock = parseInt(chip.dataset.stock);
    const fullId = chip.dataset.id;
    const qty = parseInt(document.getElementById(`qty_val_${safeId}`).innerText);

    document.getElementById(`price_${safeId}`).textContent = formatPrice(price * qty);
    const p4 = calcFourTimes(price * qty);
    document.getElementById(`p4_${safeId}`).textContent = p4 ? `4x ${p4} €` : '';

    const btn = document.getElementById(`btn_${safeId}`);
    const qtyBox = document.getElementById(`qty_box_${safeId}`);
    
    qtyBox.style.opacity = "1"; qtyBox.style.pointerEvents = "auto";
    btn.disabled = false;
    btn.textContent = "AJOUTER";
    
    btn.dataset.selId = fullId;
    btn.dataset.selPrice = price;
    btn.dataset.selStock = stock;
    btn.dataset.selSize = chip.innerText;
};

window.updateGridQty = function(safeId, delta) {
    const valSpan = document.getElementById(`qty_val_${safeId}`);
    let current = parseInt(valSpan.innerText);
    const btn = document.getElementById(`btn_${safeId}`);
    const stock = parseInt(btn.dataset.selStock || 99);
    
    let newVal = current + delta;
    if(newVal < 1) newVal = 1;
    if(newVal > stock) newVal = stock;
    valSpan.innerText = newVal;

    if(btn.dataset.selPrice) {
        const price = parseFloat(btn.dataset.selPrice);
        document.getElementById(`price_${safeId}`).textContent = formatPrice(price * newVal);
        const p4 = calcFourTimes(price * newVal);
        document.getElementById(`p4_${safeId}`).textContent = p4 ? `4x ${p4} €` : '';
    }
};

window.addGridToCart = function(safeId, modelBaseId, btn) {
    const id = btn.dataset.selId;
    const price = parseFloat(btn.dataset.selPrice);
    const stock = parseInt(btn.dataset.selStock);
    const size = btn.dataset.selSize;
    const qty = parseInt(document.getElementById(`qty_val_${safeId}`).innerText);
    const prod = productsAll.find(p => p.modelBaseId === modelBaseId);
    addToCartLogic(id, modelBaseId, price, qty, size, prod.masterNameBase, stock, prod.imageUrls[0], btn, false);
};

function renderPagination(){ 
    const totalPages = Math.max(1, Math.ceil(productsAll.length / PAGE_SIZE));
    const pag = document.getElementById('pagination');
    pag.innerHTML = '';
    if(totalPages<=1) return;
    for(let i=1; i<=totalPages; i++){
        const b = document.createElement('button');
        b.textContent = i;
        if(i===currentPage) b.classList.add('active');
        b.onclick = () => { renderPage(i); renderPagination(); window.scrollTo({top:0, behavior:'smooth'}); };
        pag.appendChild(b);
    }
}

/* ===========================
  PANIER & PROMO
=========================== */
function addToCartLogic(id, modelBaseId, price, qty, sizeLabel, title, stock, imgUrl, btnElement, closeModal) {
    const existing = cart.find(c => c.id === id);
    const currentQty = existing ? existing.quantity : 0;
    const totalItemsInCart = cart.reduce((acc, item) => acc + item.quantity, 0);

    // SÉCURITÉ 1: Stock
    if (currentQty + qty > stock) { 
        showErrorModal(`Stock insuffisant. Max dispo: ${stock}`); 
        return; 
    }

    // SÉCURITÉ 2: Limite 5 articles
    if (totalItemsInCart + qty > MAX_ITEMS_PER_ORDER) {
        showErrorModal("Pour des raisons logistiques, la commande est limitée à 5 articles.");
        return;
    }

    if (existing) { existing.quantity += qty; }
    else { cart.push({ id, modelBaseId, price, quantity: qty, sizeLabel, title, stock, imageUrl: imgUrl }); }

    animateButtonSuccess(btnElement);
    updateCartDisplays(true);
    
    if(closeModal) { setTimeout(() => {
        document.getElementById('product-preview-modal').classList.add('hidden');
        document.body.classList.remove('modal-open');
    }, 500); }
}

function updateCartDisplays(openCart=false){
    const count = cart.reduce((a,c)=>a+c.quantity,0);
    document.getElementById('cart-count').textContent = count;
    document.getElementById('cart-count-header').textContent = count;
    
    const cont = document.getElementById('cart-items');
    cont.innerHTML = '';
    let sub = 0;

    if(!cart.length) {
        cont.innerHTML = '<div class="muted text-center py-8">Votre panier est vide</div>';
    } else {
        cart.forEach(item => {
            sub += item.price * item.quantity;
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <img src="${item.imageUrl}">
                <div class="cart-item-info">
                    <div class="cart-item-title">${escapeHtml(item.title)}</div>
                    <div class="cart-item-meta">Taille: ${item.sizeLabel}</div>
                    <div class="flex justify-between items-center mt-2">
                        <div class="qty-tactile" style="height: 30px;">
                            <button class="qty-btn-round" onclick="changeCartQty('${item.id}', -1)">－</button>
                            <span class="qty-val" style="font-size: 0.8rem;">${item.quantity}</span>
                            <button class="qty-btn-round" onclick="changeCartQty('${item.id}', 1)">＋</button>
                        </div>
                        <div class="font-bold">${(item.price * item.quantity).toFixed(2)}€</div>
                    </div>
                </div>
                <button class="text-red-500 text-xl px-2" onclick="removeFromCart('${item.id}')">&times;</button>
            `;
            cont.appendChild(div);
        });
    }

    let discount = 0;
    if(activePromo) {
        if(activePromo.value < 1) discount = sub * activePromo.value;
        else discount = activePromo.value;
        document.getElementById('cart-discount-row').classList.remove('hidden');
        document.getElementById('cart-discount-amount').textContent = `-${formatPrice(discount)}`;
    } else {
        document.getElementById('cart-discount-row').classList.add('hidden');
    }

    let total = sub - discount;
    if(total < 0) total = 0;

    document.getElementById('cart-subtotal').textContent = formatPrice(sub);
    
    let shippingCost = 0;
    const shipEl = document.getElementById('cart-shipping');
    
    if (selectedShippingRate) {
        shippingCost = selectedShippingRate.cost;
        if (total >= SHIPPING_THRESHOLD) {
             shippingCost = 0;
             shipEl.textContent = "Offert";
        } else {
             shipEl.textContent = formatPrice(shippingCost);
        }
    } else {
        // Si pas de tarif sélectionné (ou adresse pas encore remplie), on affiche --
        shipEl.textContent = "--";
    }
    
    total += shippingCost;

    const p4 = calcFourTimes(total);
    const p4Display = document.getElementById('cart-four-times-display');
    if(p4Display) {
        if(total >= 30) { p4Display.textContent = `Ou payez en 4x ${p4} €`; p4Display.classList.remove('hidden'); }
        else { p4Display.classList.add('hidden'); }
    }
    
    document.getElementById('cart-total').textContent = formatPrice(total);
    
    const bar = document.getElementById('cart-shipping-incentive-bar');
    if(bar) {
        const subForFree = sub - discount;
        if(subForFree >= SHIPPING_THRESHOLD) {
            bar.innerHTML = "Livraison <strong>GRATUITE</strong> !";
            bar.classList.add('is-free');
            bar.style.display = 'block';
        } else if (subForFree > 0) {
            bar.innerHTML = `Plus que <strong>${formatPrice(SHIPPING_THRESHOLD - subForFree)}</strong> pour la livraison gratuite`;
            bar.classList.remove('is-free');
            bar.style.display = 'block';
        } else {
            bar.style.display = 'none';
        }
    }

    if(openCart) document.getElementById('cart-overlay').classList.add('open');
}

window.changeCartQty = function(id, delta) {
    const item = cart.find(c => c.id === id);
    if(!item) return;
    const newVal = item.quantity + delta;
    
    const totalItems = cart.reduce((acc, i) => acc + i.quantity, 0) - item.quantity + newVal;

    if(newVal <= 0) { removeFromCart(id); return; }
    if(newVal > item.stock) { showErrorModal("Stock max atteint"); return; }
    if(totalItems > MAX_ITEMS_PER_ORDER) { showErrorModal("Limite de 5 articles atteinte."); return; }

    item.quantity = newVal;
    updateCartDisplays();
};

window.removeFromCart = function(id) {
    const idx = cart.findIndex(c => c.id === id);
    if(idx > -1) cart.splice(idx, 1);
    updateCartDisplays();
};

/* ===========================
  INIT & LISTENERS
=========================== */
window.addEventListener('load', async () => {
    window.addEventListener('request-site-load', () => { appState.userClickedEnter = true; checkSplash(); });

    document.getElementById('banner-text').textContent = BANNER_TEXT;
    document.getElementById('logo-subtext').textContent = LOGO_SUBTEXT;
    if(document.getElementById('logo-subtext-mobile')) document.getElementById('logo-subtext-mobile').textContent = LOGO_SUBTEXT;

    if(YOUTUBE_EMBED_URL) {
        document.getElementById('youtube-iframe').src = YOUTUBE_EMBED_URL;
        document.getElementById('youtube-embed-container').classList.remove('hidden');
    }

    document.body.addEventListener('click', (e) => {
        if(e.target.classList.contains('modal-close-btn') || e.target.classList.contains('modal-backdrop') || e.target.classList.contains('product-preview-close')) {
            const backdrop = e.target.closest('.modal-backdrop');
            if(backdrop) {
                backdrop.classList.add('hidden');
                document.body.classList.remove('modal-open');
            }
        }
        const targetBtn = e.target.closest('[data-modal-target]');
        if(targetBtn) {
            e.preventDefault();
            showTextModal(targetBtn.dataset.modalTarget);
        }
        const iframeBtn = e.target.closest('[data-modal-iframe]');
        if(iframeBtn) {
            e.preventDefault();
            showIframeModal(iframeBtn.dataset.modalIframe, iframeBtn.dataset.modalTitle);
        }
    });

    document.getElementById('btn-apply-promo').onclick = () => {
        const code = document.getElementById('promo-code-input').value.trim().toUpperCase();
        if(availablePromos[code]) {
            activePromo = { code: code, value: availablePromos[code] };
            showToast(`Code ${code} appliqué !`);
            updateCartDisplays();
        } else {
            showErrorModal("Code promo invalide ou expiré");
        }
    };

    document.getElementById('cart-float-btn').onclick = () => updateCartDisplays(true);
    document.getElementById('close-cart').onclick = () => document.getElementById('cart-overlay').classList.remove('open');

    // CORRECTION : VIDER PANIER TOTALEMENT
    document.getElementById('btn-clear-cart').onclick = () => showConfirm("Vider le panier ?", () => { 
        cart = []; 
        selectedShippingRate = null; // Reset livraison
        updateCartDisplays(); 
        showToast("Panier vidé");
    });

    document.getElementById('toggle-iban-button').onclick = (e) => { e.preventDefault(); document.getElementById('virement-info').classList.toggle('hidden'); };
    
    // AJOUT LISTENER ADRESSE : Pour déclencher l'affichage des frais de port en temps réel
    const form = document.getElementById('quick-form');
    const addressInputs = [form.adresse, form.codepostal, form['dom-postal']];
    addressInputs.forEach(input => {
        if(input) {
            input.addEventListener('input', () => {
                if(selectedCountry) renderShippingMethods(selectedCountry);
            });
        }
    });

    window.validateAndSubmit = async function(method, btn) {
        if(!cart.length) return showErrorModal('Panier vide');
        const form = document.getElementById('quick-form');
        if(!form.checkValidity()) { showErrorModal('Champs manquants'); return; }
        if(!selectedShippingRate) { showErrorModal('Veuillez choisir un mode de livraison.'); return; }

        let fullAddress = "";
        let code = selectedCountry;
        if(selectedCountry === 'Guadeloupe') code = 'GUA';
        else if(selectedCountry === 'France') code = 'FRA';
        else if(selectedCountry === 'Martinique') code = 'MTQ';
        else if(selectedCountry === 'Guyane') code = 'GUY';

        if (COMMUNES_DATA[code]) {
            const dom = document.getElementById('dom-postal').value;
            if(!dom) { showErrorModal('Veuillez choisir votre commune.'); return; }
            fullAddress = `${form.adresse.value} ${dom}`;
        } else {
            const cp = form.codepostal.value;
            const city = form.commune.value;
            if(!cp || !city) { showErrorModal('Code postal et ville requis.'); return; }
            fullAddress = `${form.adresse.value} ${cp} ${city} ${selectedCountry}`;
        }

        btn.disabled = true; btn.textContent = "Envoi...";
        
        const payload = {
            action: 'createOrder',
            methodePaiement: method,
            prenom: form.prenom.value,
            nom: form.nom.value,
            email: form.email.value,
            telephone: form.telephone.value,
            adresse: fullAddress,
            modeLivraison: selectedShippingRate.id,
            communeCP: fullAddress,
            productsJson: JSON.stringify(cart.map(c => ({id: c.id, quantity: c.quantity}))),
            totalFinal: 0, 
            recaptchaResponse: (typeof grecaptcha !== 'undefined' && grecaptcha.getResponse ? grecaptcha.getResponse() : 'token')
        };

        try {
            const res = await fetch(SCRIPT_URL, { method:'POST', body: JSON.stringify(payload) });
            const d = await res.json();
            if(d.success) {
                document.getElementById('popup-prenom').textContent = payload.prenom;
                document.getElementById('popup').classList.remove('hidden');
                cart = []; updateCartDisplays(); form.reset();
                setTimeout(() => window.location.reload(), 5000);
            } else {
                showErrorModal("Erreur: " + d.error);
                btn.disabled = false; btn.textContent = "Réessayer";
            }
        } catch(e) {
            showErrorModal("Erreur réseau.");
            btn.disabled = false;
        }
    };

    document.getElementById('btn-submit-sumup').onclick = function() { validateAndSubmit('sumup', this); };
    document.getElementById('btn-submit-virement').onclick = function() { validateAndSubmit('virement', this); };
    document.getElementById('newsletter-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-newsletter');
        btn.textContent = "...";
        const nom = document.getElementById('newsletter-nom').value;
        const prenom = document.getElementById('newsletter-prenom').value;
        const email = document.getElementById('newsletter-email').value;
        
        try {
            const payload = { action: 'addNewsletter', email: email, prenom: prenom, nom: nom };
            await fetch(SCRIPT_URL, { method:'POST', body: JSON.stringify(payload) });
            btn.textContent = "Inscrit !"; 
            btn.classList.add('btn-success');
            e.target.reset();
        } catch(err) { console.error(err); btn.textContent = "Erreur"; }
    });

    ['search', 'filter-size', 'filter-category'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', applyFiltersAndRender);
    });

    await loadProducts();
});
// ════════════════════════════════════════════
//  app.js — Frontend FitFemme connecté à l'API backend
// ════════════════════════════════════════════
const API = '/api';

let products = [];
let cart = JSON.parse(sessionStorage.getItem('ff_cart') || '[]');
let wishlist = new Set(JSON.parse(localStorage.getItem('ff_wish') || '[]'));
let isAdmin = false;
let filter = 'all';
let shown = 8;
let sTaps = 0, sTimer = null;

function saveCart(){ sessionStorage.setItem('ff_cart', JSON.stringify(cart)); }

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  let data = {};
  try { data = await res.json(); } catch(e) {}
  return { ok: res.ok, status: res.status, data };
}

async function loadProducts(){
  const { ok, data } = await api('/products');
  if (ok) {
    products = data.products;
    renderProducts();
  } else {
    toast('Impossible de charger les produits');
  }
}

function renderProducts(){
  const grid = document.getElementById('prodsGrid');
  const fil = filter==='all' ? products
    : filter==='soldes' ? products.filter(p=>p.badge==='sale')
    : products.filter(p=>p.cat===filter);
  const list = fil.slice(0,shown);

  if(!list.length){
    grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:48px 16px;color:var(--grey)"><div style="font-size:42px;margin-bottom:10px">😔</div><p style="font-size:14px">Aucun produit dans cette catégorie.</p></div>`;
    document.getElementById('loadWrap').style.display='none';
    return;
  }

  grid.innerHTML=list.map(p=>{
    const disc=p.oldPrice?Math.round((1-p.price/p.oldPrice)*100):null;
    const bHtml=p.badge?`<div class="prod-badge badge-${p.badge}">${p.badge==='new'?'Nouveau':p.badge==='sale'?'Solde':'Tendance'}</div>`:'';
    const isW=wishlist.has(p.id);
    return `<div class="prod-card" data-id="${p.id}">
      <div class="prod-img-wrap">
        ${p.img?`<img class="prod-img" src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`:``}
        <div class="prod-ph" style="${p.img?'display:none':'display:flex'}">${p.emoji||'👗'}</div>
        ${bHtml}
        <div class="prod-acts">
          <button class="btn-cart-m" onclick="addToCart(${p.id})">+ Panier</button>
          <button class="btn-wish-m ${isW?'on':''}" onclick="toggleWish(event,${p.id})">${isW?'♥':'♡'}</button>
        </div>
      </div>
      <div class="prod-cat">${p.cat}</div>
      <div class="prod-name">${p.name}</div>
      <div class="prod-prow">
        ${p.oldPrice?`<span class="prod-old">${p.oldPrice.toFixed(2)} €</span>`:''}
        <span class="prod-price ${p.oldPrice?'sp':''}">${p.price.toFixed(2)} €</span>
        ${disc?`<span class="prod-disc">-${disc}%</span>`:''}
      </div>
      <div class="prod-stars">${'★'.repeat(Math.floor(p.rating))}${'☆'.repeat(5-Math.floor(p.rating))} <span style="color:var(--grey);font-size:9px">${p.rating}</span></div>
    </div>`;
  }).join('');

  document.getElementById('loadWrap').style.display=fil.length>shown?'block':'none';
}

document.querySelectorAll('.fbtn').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.fbtn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    filter=b.dataset.filter; shown=8; renderProducts();
  });
});
document.getElementById('loadMoreBtn').addEventListener('click',()=>{shown+=8;renderProducts();});
function filterByCategory(cat){
  filter=cat; shown=8;
  document.querySelectorAll('.fbtn').forEach(b=>b.classList.toggle('active',b.dataset.filter===cat));
  renderProducts();
  setTimeout(()=>document.getElementById('products').scrollIntoView({behavior:'smooth'}),80);
}
function filterCat(cat){ filterByCategory(cat); }

function addToCart(id){
  const p=products.find(x=>x.id===id); if(!p)return;
  const ex=cart.find(x=>x.id===id);
  if(ex) ex.qty++; else cart.push({id:p.id,name:p.name,price:p.price,img:p.img,emoji:p.emoji,cat:p.cat,qty:1});
  saveCart(); updateCart(); toast(`${p.name} ajouté ✓`); openCart();
}
function changeQty(id,d){
  const it=cart.find(x=>x.id===id); if(!it)return;
  it.qty+=d;
  if(it.qty<=0) cart=cart.filter(x=>x.id!==id);
  saveCart(); updateCart();
}
function updateCart(){
  const cnt=cart.reduce((s,i)=>s+i.qty,0);
  document.getElementById('cartBadge').textContent=cnt;
  document.getElementById('bnavBadge').textContent=cnt;
  const tot=cart.reduce((s,i)=>s+i.price*i.qty,0);
  document.getElementById('cartTotVal').textContent=tot.toFixed(2)+' €';
  const body=document.getElementById('cartBody');
  if(!cart.length){
    body.innerHTML=`<div class="cart-empty"><div class="eico">🛒</div><p>Votre panier est vide</p></div>`;
    return;
  }
  body.innerHTML=cart.map(it=>`
    <div class="c-item">
      <div class="c-item-img">
        ${it.img?`<img src="${it.img}" alt="${it.name}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`:''}
        <span style="${it.img?'display:none':'display:flex'};width:100%;height:100%;align-items:center;justify-content:center;font-size:26px">${it.emoji||'👗'}</span>
      </div>
      <div class="c-info">
        <div class="c-name">${it.name}</div>
        <div class="c-var">Taille M · ${it.cat}</div>
        <div class="c-bot">
          <div class="qty-row">
            <button class="qbtn" onclick="changeQty(${it.id},-1)">−</button>
            <span class="qval">${it.qty}</span>
            <button class="qbtn" onclick="changeQty(${it.id},+1)">+</button>
          </div>
          <span class="c-price">${(it.price*it.qty).toFixed(2)} €</span>
        </div>
      </div>
    </div>`).join('');
}
function openCart(){ document.getElementById('cartDrawer').classList.add('open'); document.getElementById('cartOv').classList.add('open'); }
function closeCart(){ document.getElementById('cartDrawer').classList.remove('open'); document.getElementById('cartOv').classList.remove('open'); }
document.getElementById('cartNavBtn').addEventListener('click',openCart);
document.getElementById('cartBnav').addEventListener('click',openCart);
document.getElementById('cartX').addEventListener('click',closeCart);
document.getElementById('cartOv').addEventListener('click',closeCart);

function openCheckout(){
  if(!cart.length){ toast('Votre panier est vide !'); return; }
  closeCart();
  renderCheckoutForm();
  document.getElementById('checkoutView').classList.add('open');
}
function closeCheckout(){ document.getElementById('checkoutView').classList.remove('open'); }

function renderCheckoutForm(){
  const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const body = document.getElementById('checkoutBody');
  body.innerHTML = `
    <div class="checkout-summary">
      ${cart.map(it=>`
        <div class="cs-item">
          <span class="cs-item-name">${it.name}</span>
          <span class="cs-item-qty">x${it.qty}</span>
          <span class="cs-item-price">${(it.price*it.qty).toFixed(2)} €</span>
        </div>`).join('')}
      <div class="cs-total">
        <span class="cs-total-lbl">Total</span>
        <span class="cs-total-val">${total.toFixed(2)} €</span>
      </div>
    </div>

    <div class="checkout-section">
      <div class="checkout-section-title">👤 Vos informations</div>
      <div class="checkout-fg">
        <input type="text" class="finp" id="co-name" placeholder="Nom complet *" autocomplete="name">
      </div>
      <div class="checkout-row2">
        <div class="checkout-fg">
          <input type="email" class="finp" id="co-email" placeholder="E-mail *" autocomplete="email" inputmode="email">
        </div>
        <div class="checkout-fg">
          <input type="tel" class="finp" id="co-phone" placeholder="Téléphone" autocomplete="tel" inputmode="tel">
        </div>
      </div>
    </div>

    <div class="checkout-section">
      <div class="checkout-section-title">📍 Adresse de livraison</div>
      <div class="checkout-fg">
        <input type="text" class="finp" id="co-address" placeholder="Adresse *" autocomplete="street-address">
      </div>
      <div class="checkout-row3">
        <div class="checkout-fg">
          <input type="text" class="finp" id="co-city" placeholder="Ville *" autocomplete="address-level2">
        </div>
        <div class="checkout-fg">
          <input type="text" class="finp" id="co-zip" placeholder="Code postal *" autocomplete="postal-code" inputmode="numeric">
        </div>
        <div class="checkout-fg">
          <input type="text" class="finp" id="co-country" placeholder="Pays" value="France" autocomplete="country-name">
        </div>
      </div>
    </div>

    <button class="btn-place-order" id="placeOrderBtn" onclick="submitOrder()">🔒 Confirmer ma commande — ${total.toFixed(2)} €</button>
    <div class="checkout-secure">🔒 Vos données sont protégées</div>
  `;
}

async function submitOrder(){
  const name = document.getElementById('co-name').value.trim();
  const email = document.getElementById('co-email').value.trim();
  const phone = document.getElementById('co-phone').value.trim();
  const address = document.getElementById('co-address').value.trim();
  const city = document.getElementById('co-city').value.trim();
  const zip = document.getElementById('co-zip').value.trim();
  const country = document.getElementById('co-country').value.trim() || 'France';

  if(!name || !email || !address || !city || !zip){
    toast('Merci de remplir tous les champs obligatoires (*)');
    return;
  }
  if(!email.includes('@')){
    toast('Adresse e-mail invalide');
    return;
  }

  const btn = document.getElementById('placeOrderBtn');
  btn.disabled = true;
  btn.textContent = 'Traitement en cours…';

  const { ok, data } = await api('/orders', {
    method: 'POST',
    body: JSON.stringify({
      customer: { name, email, phone, address, city, zip, country },
      items: cart.map(it => ({ id: it.id, qty: it.qty }))
    })
  });

  if(ok){
    showOrderSuccess(data.orderNumber, data.total);
    cart = [];
    saveCart();
    updateCart();
  } else {
    toast('Erreur lors de la commande, réessayez');
    btn.disabled = false;
    btn.textContent = '🔒 Confirmer ma commande';
  }
}

function showOrderSuccess(orderNumber, total){
  const body = document.getElementById('checkoutBody');
  body.innerHTML = `
    <div class="order-success">
      <div class="big">🎉</div>
      <h2>Commande confirmée !</h2>
      <p>Merci pour votre confiance.</p>
      <div class="order-num">${orderNumber}</div>
      <p>Total : <strong style="color:var(--pink)">${total.toFixed(2)} €</strong></p>
      <p style="margin-top:20px;font-size:13px">Un e-mail de confirmation a été envoyé.<br>Livraison estimée : 7 à 15 jours ouvrés.</p>
      <button class="btn-primary" style="margin-top:28px" onclick="closeCheckout()">Retour à la boutique</button>
    </div>
  `;
}

function toggleWish(e,id){
  e.stopPropagation();
  const p=products.find(x=>x.id===id);
  if(wishlist.has(id)){wishlist.delete(id);toast('Retiré des favoris');}
  else{wishlist.add(id);toast(`${p.name} ♥`);}
  localStorage.setItem('ff_wish',JSON.stringify([...wishlist]));
  renderProducts();
}
document.getElementById('wishBnav').addEventListener('click',()=>{
  if(!wishlist.size){toast('Aucun favori pour l\'instant ♡');return;}
  document.getElementById('products').scrollIntoView({behavior:'smooth'});
  toast(`${wishlist.size} favori${wishlist.size>1?'s':''} ♥`);
});

document.getElementById('burgerBtn').addEventListener('click',()=>document.getElementById('mobMenu').classList.add('open'));
document.getElementById('mobX').addEventListener('click',closeMob);
document.getElementById('mobOv').addEventListener('click',close

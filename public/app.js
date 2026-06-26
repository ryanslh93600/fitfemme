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
function openLogin(){
  document.getElementById('loginInp').value='';
  document.getElementById('loginErr').style.display='none';
  document.getElementById('loginAttempts').style.display='none';
  document.getElementById('btnLogin').disabled=false;
  document.getElementById('loginOv').classList.add('open');
  setTimeout(()=>document.getElementById('loginInp').focus(),350);
}
function closeLogin(){ document.getElementById('loginOv').classList.remove('open'); }

async function checkLogin(){
  const pwd=document.getElementById('loginInp').value;
  const btn = document.getElementById('btnLogin');
  btn.disabled = true;

  const { ok, status, data } = await api('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password: pwd })
  });

  if(ok){
    isAdmin = true;
    closeLogin();
    openAdmin();
  } else if(status === 429){
    document.getElementById('loginErr').style.display='block';
    document.getElementById('loginErr').textContent=`🔒 Trop d'essais — bloqué ${data.remainingMinutes} min`;
  } else {
    document.getElementById('loginInp').value='';
    document.getElementById('loginErr').style.display='block';
    const rem = data.remainingAttempts ?? 0;
    document.getElementById('loginErr').textContent=`❌ Mot de passe incorrect (${rem} essai${rem>1?'s':''} restant${rem>1?'s':''})`;
    if(rem > 0){
      const att=document.getElementById('loginAttempts');
      att.style.display='block';
      att.textContent=`Tentative ${5-rem}/5`;
    }
    btn.disabled=false;
    document.getElementById('loginInp').focus();
  }
  btn.disabled=false;
}

async function checkAdminStatus(){
  const { ok, data } = await api('/admin/check');
  isAdmin = ok && data.isAdmin;
  return isAdmin;
}

async function openAdmin(){
  const ok = await checkAdminStatus();
  if(!ok){ openLogin(); return; }
  document.getElementById('adminPanel').classList.add('open');
  await renderAdminList();
}
function closeAdmin(){ document.getElementById('adminPanel').classList.remove('open'); }
async function logout(){
  await api('/admin/logout', { method: 'POST' });
  isAdmin=false; closeAdmin(); toast('Déconnecté ✓');
}
document.getElementById('adminX').addEventListener('click',closeAdmin);

document.querySelectorAll('.atab').forEach(tab=>{
  tab.addEventListener('click',async ()=>{
    document.querySelectorAll('.atab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.atc').forEach(c=>c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-'+tab.dataset.tab).classList.add('active');
    if(tab.dataset.tab==='list') await renderAdminList();
    if(tab.dataset.tab==='orders') await renderOrdersList();
  });
});

function previewImg(){
  const url=document.getElementById('f-img').value.trim();
  const w=document.getElementById('imgPrev');
  if(!url){w.innerHTML='<span>Aperçu de l\'image ici</span>';return;}
  w.innerHTML=`<img src="${url}" onerror="this.parentElement.innerHTML='<span>❌ Image non accessible</span>'" style="max-height:80px;max-width:100%;object-fit:contain">`;
}

async function saveProduct(){
  const name=document.getElementById('f-name').value.trim();
  const cat=document.getElementById('f-cat').value;
  const priceS=document.getElementById('f-price').value;
  const oldS=document.getElementById('f-oldprice').value;
  const badge=document.getElementById('f-badge').value;
  const img=document.getElementById('f-img').value.trim();
  const link=document.getElementById('f-link').value.trim();
  const emoji=document.getElementById('f-emoji').value.trim()||'👗';
  const rating=parseFloat(document.getElementById('f-rating').value)||4.5;
  const editId=document.getElementById('editId').value;

  if(!name||!cat||!priceS||!link){toast('Remplis les champs obligatoires (*)');return;}
  const price=parseFloat(priceS);
  if(isNaN(price)||price<=0){toast('Prix invalide');return;}

  const payload = { name, cat, price, oldPrice: oldS?parseFloat(oldS):null, badge: badge||null, img, link, emoji, rating };

  let result;
  if(editId){
    result = await api(`/admin/products/${editId}`, { method:'PUT', body: JSON.stringify(payload) });
  } else {
    result = await api('/admin/products', { method:'POST', body: JSON.stringify(payload) });
  }

  if(result.ok){
    toast(editId ? 'Produit mis à jour ✓' : 'Produit ajouté ✓');
    await loadProducts();
    resetForm();
    document.querySelectorAll('.atab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.atc').forEach(c=>c.classList.remove('active'));
    document.querySelector('[data-tab="list"]').classList.add('active');
    document.getElementById('tab-list').classList.add('active');
    await renderAdminList();
  } else {
    toast('Erreur lors de l\'enregistrement');
  }
}

function resetForm(){
  ['f-name','f-cat','f-price','f-oldprice','f-badge','f-img','f-link'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('f-emoji').value='👗';
  document.getElementById('f-rating').value='4.5';
  document.getElementById('editId').value='';
  document.getElementById('saveBtn').textContent='✓ Enregistrer';
  document.getElementById('imgPrev').innerHTML='<span>Aperçu de l\'image ici</span>';
}

function editProduct(id){
  const p=products.find(x=>x.id===id); if(!p)return;
  document.querySelectorAll('.atab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.atc').forEach(c=>c.classList.remove('active'));
  document.querySelector('[data-tab="add"]').classList.add('active');
  document.getElementById('tab-add').classList.add('active');
  document.getElementById('f-name').value=p.name;
  document.getElementById('f-cat').value=p.cat;
  document.getElementById('f-price').value=p.price;
  document.getElementById('f-oldprice').value=p.oldPrice||'';
  document.getElementById('f-badge').value=p.badge||'';
  document.getElementById('f-img').value=p.img||'';
  document.getElementById('f-link').value=p.link||'';
  document.getElementById('f-emoji').value=p.emoji||'👗';
  document.getElementById('f-rating').value=p.rating||4.5;
  document.getElementById('editId').value=p.id;
  document.getElementById('saveBtn').textContent='✓ Mettre à jour';
  previewImg();
  document.getElementById('adminPanel').scrollTop=0;
}

async function deleteProduct(id){
  if(!confirm('Supprimer ce produit ?'))return;
  const { ok } = await api(`/admin/products/${id}`, { method: 'DELETE' });
  if(ok){
    await loadProducts();
    await renderAdminList();
    toast('Produit supprimé');
  } else {
    toast('Erreur lors de la suppression');
  }
}

async function renderAdminList(){
  const { ok, data } = await api('/admin/products');
  if(!ok){ toast('Erreur de chargement'); return; }
  const allProducts = data.products;
  document.getElementById('prodCount').textContent = allProducts.length;
  const list=document.getElementById('apList');
  if(!allProducts.length){
    list.innerHTML=`<div class="ap-empty">Aucun produit — ajoutez-en via l'onglet "Ajouter" !</div>`;
    return;
  }
  list.innerHTML=allProducts.map(p=>`
    <div class="ap-item">
      <div class="ap-img">
        ${p.img?`<img src="${p.img}" alt="${p.name}" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`:''}
        <span style="${p.img?'display:none':'display:flex'};width:100%;height:100%;align-items:center;justify-content:center">${p.emoji||'👗'}</span>
      </div>
      <div class="ap-info">
        <div class="ap-name">${p.name}</div>
        <div class="ap-meta">${p.cat}${p.badge?' · '+p.badge:''}${p.link?' · 🔗':''}</div>
      </div>
      <div class="ap-price">${p.price.toFixed(2)}€</div>
      <div class="ap-btns">
        <button class="btn-edit" onclick="editProduct(${p.id})" title="Modifier">✏️</button>
        <button class="btn-del" onclick="deleteProduct(${p.id})" title="Supprimer">🗑️</button>
      </div>
    </div>`).join('');
}

const STATUS_LABELS = {
  pending: '⏳ En attente paiement',
  paid: '💰 Payée — à commander',
  sourcing: '🛒 En cours de sourcing',
  shipped: '📦 Expédiée',
  delivered: '✅ Livrée',
  cancelled: '❌ Annulée'
};

async function renderOrdersList(){
  const { ok, data } = await api('/admin/orders');
  if(!ok){ toast('Erreur de chargement des commandes'); return; }
  const orders = data.orders;
  document.getElementById('orderCount').textContent = orders.length;

  const pendingCount = orders.filter(o => ['pending','paid','sourcing'].includes(o.status)).length;
  const totalAmount = orders.reduce((s,o) => s + o.total_amount, 0);
  document.getElementById('statPending').textContent = pendingCount;
  document.getElementById('statTotal').textContent = totalAmount.toFixed(0)+'€';

  const list = document.getElementById('ordersList');
  if(!orders.length){
    list.innerHTML = `<div class="ap-empty">Aucune commande pour l'instant.</div>`;
    return;
  }

  list.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-card-hd">
        <div>
          <div class="order-num-tag">${o.order_number}</div>
          <div class="order-date">${new Date(o.created_at).toLocaleString('fr-FR')}</div>
        </div>
        <select class="order-status-sel" onchange="updateOrderStatus(${o.id}, this.value)">
          ${Object.entries(STATUS_LABELS).map(([val,lbl])=>`<option value="${val}" ${o.status===val?'selected':''}>${lbl}</option>`).join('')}
        </select>
      </div>
      <div class="order-customer">
        <strong>${o.customer_name}</strong> · ${o.customer_email}${o.customer_phone?' · '+o.customer_phone:''}<br>
        ${o.address_line}, ${o.address_zip} ${o.address_city}, ${o.address_country}
        <span class="payment-pill ${o.stripe_payment_status==='paid'?'pp-paid':'pp-unpaid'}" style="margin-left:6px">${o.stripe_payment_status==='paid'?'Payé':'Non payé'}</span>
      </div>
      <div class="order-items-list">
        ${o.items.map(it => `
          <div class="order-item-row">
            <input type="checkbox" class="oi-sourced-check" ${it.sourced?'checked':''} onchange="toggleItemSourced(${it.id})" title="Marquer comme commandé sur Aliexpress/Temu">
            <span class="oi-name">${it.product_name} x${it.quantity}</span>
            ${it.source_link?`<a href="${it.source_link}" target="_blank" rel="noopener">🔗 Source</a>`:''}
          </div>`).join('')}
      </div>
      <div class="order-total-row">
        <span>Total commande</span>
        <span>${o.total_amount.toFixed(2)} €</span>
      </div>
    </div>
  `).join('');
}

async function updateOrderStatus(orderId, status){
  const { ok } = await api(`/admin/orders/${orderId}/status`, { method:'PUT', body: JSON.stringify({ status }) });
  if(ok){ toast('Statut mis à jour ✓'); }
  else { toast('Erreur de mise à jour'); }
}

async function toggleItemSourced(itemId){
  const { ok } = await api(`/admin/order-items/${itemId}/sourced`, { method:'PUT' });
  if(!ok) toast('Erreur');
}

async function changePwd(){
  const p1=document.getElementById('newPwd1').value;
  const p2=document.getElementById('newPwd2').value;
  if(!p1){toast('Entrez un mot de passe');return;}
  if(p1.length<6){toast('Minimum 6 caractères');return;}
  if(p1!==p2){toast('Les mots de passe ne correspondent pas');return;}

  const { ok } = await api('/admin/change-password', { method:'POST', body: JSON.stringify({ newPassword: p1 }) });
  if(ok){
    document.getElementById('newPwd1').value='';
    document.getElementById('newPwd2').value='';
    toast('Mot de passe mis à jour ✓');
  } else {
    toast('Erreur lors du changement');
  }
}

function clearAll(){
  toast('Pour supprimer tous les produits, fais-le un par un depuis l\'onglet Produits (sécurité)');
}

function subscribeNl(){
  const v=document.getElementById('nlEmail').value;
  if(!v.includes('@')){toast('E-mail invalide');return;}
  toast('Inscription confirmée 🎉');
  document.getElementById('nlEmail').value='';
}

let tTimer;
function toast(msg){
  clearTimeout(tTimer);
  document.getElementById('toastMsg').textContent=msg;
  document.getElementById('toast').classList.add('show');
  tTimer=setTimeout(()=>document.getElementById('toast').classList.remove('show'),3000);
}

updateCart();
loadProducts();
checkAdminStatus();

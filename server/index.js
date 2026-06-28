// ════════════════════════════════════════════
//  index.js — Serveur HTTP principal (Node.js pur, sans dépendances)
//  Boutique FitFemme : API produits, commandes, admin
//  Version corrigée : Content-Type strict + no-cache sur les fichiers statiques
// ════════════════════════════════════════════
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { db } = require('./db');
const { readBody, sendJSON, parseCookies, setCookie, clearCookie } = require('./utils');
const auth = require('./auth');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

function requireAdmin(req) {
  const cookies = parseCookies(req);
  const token = cookies.ff_admin_token;
  return auth.isValidSession(token);
}

function generateOrderNumber() {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `FF-${ymd}-${rand}`;
}

function rowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    cat: row.category,
    price: row.price,
    oldPrice: row.old_price,
    badge: row.badge,
    img: row.image_url,
    link: row.source_link,
    emoji: row.emoji,
    rating: row.rating,
    active: !!row.active
  };
}

function handleGetProducts(req, res) {
  const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC').all();
  sendJSON(res, 200, { products: rows.map(rowToProduct) });
}

async function handleAdminLogin(req, res) {
  const ip = getClientIp(req);
  const allowed = auth.checkLoginAllowed(ip);
  if (!allowed.allowed) {
    return sendJSON(res, 429, { error: 'locked', remainingMinutes: allowed.remainingMinutes });
  }
  const body = await readBody(req);
  const { password } = body;
  if (!password) return sendJSON(res, 400, { error: 'missing_password' });

  if (auth.verifyPassword(password)) {
    auth.recordSuccessfulLogin(ip);
    const token = auth.createSession();
    setCookie(res, 'ff_admin_token', token, { maxAge: 60 * 60 * 24 * 7, sameSite: 'Lax' });
    return sendJSON(res, 200, { success: true });
  } else {
    const entry = auth.recordFailedAttempt(ip);
    const remaining = Math.max(0, 5 - entry.count);
    return sendJSON(res, 401, { error: 'invalid_password', remainingAttempts: remaining });
  }
}

function handleAdminLogout(req, res) {
  const cookies = parseCookies(req);
  if (cookies.ff_admin_token) auth.destroySession(cookies.ff_admin_token);
  clearCookie(res, 'ff_admin_token');
  sendJSON(res, 200, { success: true });
}

function handleAdminCheck(req, res) {
  sendJSON(res, 200, { isAdmin: requireAdmin(req) });
}

async function handleChangePassword(req, res) {
  if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'unauthorized' });
  const body = await readBody(req);
  const { newPassword } = body;
  if (!newPassword || newPassword.length < 6) {
    return sendJSON(res, 400, { error: 'password_too_short' });
  }
  auth.changePassword(newPassword);
  sendJSON(res, 200, { success: true });
}

function handleAdminGetProducts(req, res) {
  if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'unauthorized' });
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  sendJSON(res, 200, { products: rows.map(rowToProduct) });
}

async function handleCreateProduct(req, res) {
  if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'unauthorized' });
  const b = await readBody(req);
  if (!b.name || !b.cat || !b.price || !b.link) {
    return sendJSON(res, 400, { error: 'missing_fields' });
  }
  const stmt = db.prepare(`
    INSERT INTO products (name, category, price, old_price, badge, image_url, source_link, emoji, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    b.name, b.cat, parseFloat(b.price), b.oldPrice ? parseFloat(b.oldPrice) : null,
    b.badge || null, b.img || '', b.link, b.emoji || '👗', b.rating ? parseFloat(b.rating) : 4.5
  );
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  sendJSON(res, 201, { product: rowToProduct(row) });
}

async function handleUpdateProduct(req, res, id) {
  if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'unauthorized' });
  const b = await readBody(req);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return sendJSON(res, 404, { error: 'not_found' });

  db.prepare(`
    UPDATE products SET name=?, category=?, price=?, old_price=?, badge=?, image_url=?, source_link=?, emoji=?, rating=?, active=?
    WHERE id=?
  `).run(
    b.name ?? existing.name,
    b.cat ?? existing.category,
    b.price !== undefined ? parseFloat(b.price) : existing.price,
    b.oldPrice !== undefined ? (b.oldPrice ? parseFloat(b.oldPrice) : null) : existing.old_price,
    b.badge !== undefined ? b.badge : existing.badge,
    b.img !== undefined ? b.img : existing.image_url,
    b.link ?? existing.source_link,
    b.emoji ?? existing.emoji,
    b.rating !== undefined ? parseFloat(b.rating) : existing.rating,
    b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
    id
  );
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  sendJSON(res, 200, { product: rowToProduct(row) });
}

function handleDeleteProduct(req, res, id) {
  if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'unauthorized' });
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  sendJSON(res, 200, { success: true });
}

async function handleCreateOrder(req, res) {
  const b = await readBody(req);
  const { customer, items } = b;

  if (!customer || !customer.name || !customer.email || !customer.address || !customer.city || !customer.zip) {
    return sendJSON(res, 400, { error: 'missing_customer_fields' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return sendJSON(res, 400, { error: 'empty_cart' });
  }

  let total = 0;
  const validatedItems = [];
  for (const it of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(it.id);
    if (!product) continue;
    const qty = Math.max(1, parseInt(it.qty) || 1);
    total += product.price * qty;
    validatedItems.push({ product, qty });
  }
  if (validatedItems.length === 0) return sendJSON(res, 400, { error: 'no_valid_items' });

  const orderNumber = generateOrderNumber();
  const insertOrder = db.prepare(`
    INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, address_line, address_city, address_zip, address_country, total_amount, status, stripe_payment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid')
  `);
  const result = insertOrder.run(
    orderNumber, customer.name, customer.email, customer.phone || null,
    customer.address, customer.city, customer.zip, customer.country || 'France', total
  );
  const orderId = result.lastInsertRowid;

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, product_image, source_link, unit_price, quantity)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const { product, qty } of validatedItems) {
    insertItem.run(orderId, product.id, product.name, product.image_url, product.source_link, product.price, qty);
  }

  sendJSON(res, 201, {
    success: true,
    orderNumber,
    orderId,
    total: Math.round(total * 100) / 100,
    message: 'Commande créée — paiement Stripe à connecter prochainement'
  });
}

function handleAdminGetOrders(req, res) {
  if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'unauthorized' });
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const fullOrders = orders.map(o => ({
    ...o,
    items: items.all(o.id)
  }));
  sendJSON(res, 200, { orders: fullOrders });
}

async function handleUpdateOrderStatus(req, res, id) {
  if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'unauthorized' });
  const b = await readBody(req);
  const validStatuses = ['pending', 'paid', 'sourcing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(b.status)) return sendJSON(res, 400, { error: 'invalid_status' });
  db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(b.status, id);
  sendJSON(res, 200, { success: true });
}

async function handleToggleItemSourced(req, res, itemId) {
  if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'unauthorized' });
  const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId);
  if (!item) return sendJSON(res, 404, { error: 'not_found' });
  db.prepare('UPDATE order_items SET sourced = ? WHERE id = ?').run(item.sourced ? 0 : 1, itemId);
  sendJSON(res, 200, { success: true });
}

function serveStatic(req, res, urlPath) {
  let cleanPath = urlPath.split('?')[0].split('#')[0];
  let filePath = cleanPath === '/' ? '/index.html' : cleanPath;
  const resolvedPath = path.join(PUBLIC_DIR, filePath);

  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      return fs.readFile(indexPath, (err2, indexData) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Not found');
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store'
        });
        res.end(indexData);
      });
    }

    fs.readFile(resolvedPath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Internal server error');
      }
      const ext = path.extname(resolvedPath).toLowerCase();
      const contentType = MIME[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(data);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  const method = req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    if (p === '/api/products' && method === 'GET') return handleGetProducts(req, res);
    if (p === '/api/orders' && method === 'POST') return await handleCreateOrder(req, res);
    if (p === '/api/admin/login' && method === 'POST') return await handleAdminLogin(req, res);
    if (p === '/api/admin/logout' && method === 'POST') return handleAdminLogout(req, res);
    if (p === '/api/admin/check' && method === 'GET') return handleAdminCheck(req, res);
    if (p === '/api/admin/change-password' && method === 'POST') return await handleChangePassword(req, res);
    if (p === '/api/admin/products' && method === 'GET') return handleAdminGetProducts(req, res);
    if (p === '/api/admin/products' && method === 'POST') return await handleCreateProduct(req, res);
    const prodMatch = p.match(/^\/api\/admin\/products\/(\d+)$/);
    if (prodMatch && method === 'PUT') return await handleUpdateProduct(req, res, prodMatch[1]);
    if (prodMatch && method === 'DELETE') return handleDeleteProduct(req, res, prodMatch[1]);
    if (p === '/api/admin/orders' && method === 'GET') return handleAdminGetOrders(req, res);
    const orderMatch = p.match(/^\/api\/admin\/orders\/(\d+)\/status$/);
    if (orderMatch && method === 'PUT') return await handleUpdateOrderStatus(req, res, orderMatch[1]);
    const itemMatch = p.match(/^\/api\/admin\/order-items\/(\d+)\/sourced$/);
    if (itemMatch && method === 'PUT') return await handleToggleItemSourced(req, res, itemMatch[1]);

    if (p.startsWith('/api/')) return sendJSON(res, 404, { error: 'route_not_found' });

    return serveStatic(req, res, p);

  } catch (err) {
    console.error('Erreur serveur:', err);
    return sendJSON(res, 500, { error: 'internal_error' });
  }
});

server.listen(PORT, () => {
  console.log(`\n🏃‍♀️ FitFemme server running → http://localhost:${PORT}\n`);
});



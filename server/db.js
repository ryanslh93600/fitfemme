// ════════════════════════════════════════════
//  db.js — Base de données SQLite (module natif Node.js)
// ════════════════════════════════════════════
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'fitfemme.db');

const fs = require('node:fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    old_price REAL,
    badge TEXT,
    image_url TEXT,
    source_link TEXT NOT NULL,
    emoji TEXT DEFAULT '👗',
    rating REAL DEFAULT 4.5,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    address_line TEXT NOT NULL,
    address_city TEXT NOT NULL,
    address_zip TEXT NOT NULL,
    address_country TEXT DEFAULT 'France',
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    stripe_session_id TEXT,
    stripe_payment_status TEXT DEFAULT 'unpaid',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    product_image TEXT,
    source_link TEXT,
    unit_price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    sourced INTEGER DEFAULT 0,
    FOREIGN KEY(order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS admin_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
`);

function hashPwd(pwd, salt) {
  return crypto.pbkdf2Sync(pwd, salt, 100000, 64, 'sha512').toString('hex');
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO admin_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

if (!getSetting('admin_pwd_hash')) {
  const defaultPwd = process.env.ADMIN_DEFAULT_PWD || 'FitFemme2026!';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPwd(defaultPwd, salt);
  setSetting('admin_pwd_salt', salt);
  setSetting('admin_pwd_hash', hash);
  console.log('🔑 Mot de passe admin initialisé (changeable depuis l\'admin > Réglages)');
}

const countRow = db.prepare('SELECT COUNT(*) as c FROM products').get();
if (countRow.c === 0) {
  const demoProducts = [
    ['Legging Push-Up Taille Haute', 'leggings', 15.99, 32, 'sale', '', 'https://fr.aliexpress.com', '🩱', 4.8],
    ['Brassière Sport Maintien Fort', 'hauts', 9.99, null, 'new', '', 'https://fr.aliexpress.com', '👙', 4.7],
    ['Legging Seamless Nude', 'leggings', 18.99, null, 'hot', '', 'https://www.temu.com', '🩱', 4.9],
    ['Crop Top Running Respirant', 'hauts', 8.50, 17, 'sale', '', 'https://fr.aliexpress.com', '👕', 4.6],
    ['Veste Coupe-Vent Légère', 'vestes', 22.99, null, 'new', '', 'https://fr.aliexpress.com', '🧥', 4.5],
    ['Set Sport 2 Pièces Tie-Dye', 'hauts', 19.99, 40, 'sale', '', 'https://www.temu.com', '🎽', 4.8],
    ['Legging 7/8 Anti-Cellulite', 'leggings', 14.99, null, null, '', 'https://fr.aliexpress.com', '🩱', 4.7],
    ['Sac de Sport Pliable', 'accessoires', 7.99, 15, 'sale', '', 'https://www.temu.com', '👜', 4.4],
  ];
  const insert = db.prepare(`
    INSERT INTO products (name, category, price, old_price, badge, image_url, source_link, emoji, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of demoProducts) insert.run(...p);
  console.log('📦 Produits de démonstration insérés');
}

module.exports = { db, hashPwd, getSetting, setSetting };

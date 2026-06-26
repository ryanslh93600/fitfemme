// ════════════════════════════════════════════
//  auth.js — Authentification admin (session token + anti-bruteforce)
// ════════════════════════════════════════════
const crypto = require('node:crypto');
const { db, hashPwd, getSetting, setSetting } = require('./db');

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 jours
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 1000 * 60 * 5; // 5 minutes

const loginAttempts = new Map();

function checkLoginAllowed(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return { allowed: true };
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
    const remainingMs = entry.lockedUntil - Date.now();
    return { allowed: false, remainingMinutes: Math.ceil(remainingMs / 60000) };
  }
  return { allowed: true };
}

function recordFailedAttempt(ip) {
  const entry = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_DURATION_MS;
    entry.count = 0;
  }
  loginAttempts.set(ip, entry);
  return entry;
}

function recordSuccessfulLogin(ip) {
  loginAttempts.delete(ip);
}

function verifyPassword(password) {
  const salt = getSetting('admin_pwd_salt');
  const hash = getSetting('admin_pwd_hash');
  if (!salt || !hash) return false;
  const candidateHash = hashPwd(password, salt);
  return crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(hash));
}

function changePassword(newPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPwd(newPassword, salt);
  setSetting('admin_pwd_salt', salt);
  setSetting('admin_pwd_hash', hash);
}

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  db.prepare('INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)').run(token, expiresAt);
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const row = db.prepare('SELECT * FROM admin_sessions WHERE token = ?').get(token);
  if (!row) return false;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
    return false;
  }
  return true;
}

function destroySession(token) {
  db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
}

setInterval(() => {
  db.prepare('DELETE FROM admin_sessions WHERE expires_at < datetime("now")').run();
}, 1000 * 60 * 30);

module.exports = {
  checkLoginAllowed,
  recordFailedAttempt,
  recordSuccessfulLogin,
  verifyPassword,
  changePassword,
  createSession,
  isValidSession,
  destroySession
};

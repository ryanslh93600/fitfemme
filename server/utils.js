// ════════════════════════════════════════════
//  utils.js — Helpers HTTP (body parsing, réponses JSON, cookies)
// ════════════════════════════════════════════

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
  if (opts.secure) parts.push('Secure');
  const existing = res.getHeader('Set-Cookie');
  const cookieStr = parts.join('; ');
  if (existing) {
    res.setHeader('Set-Cookie', Array.isArray(existing) ? [...existing, cookieStr] : [existing, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', cookieStr);
  }
}

function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}

module.exports = { readBody, sendJSON, parseCookies, setCookie, clearCookie };

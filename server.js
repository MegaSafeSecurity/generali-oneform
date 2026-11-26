'use strict';
/**
 * Generali OneForm: UI + API (no web framework). `npm start`.
 * Storage: Supabase when SUPABASE_* are set (production); in-memory otherwise (local dev only).
 * Secrets stay in this process; the browser only ever holds httpOnly cookies / a one-time customer link token.
 */
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');

try { // minimal .env loader; real environment variables always win
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch { /* no .env */ }

const PROD = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || (PROD ? '0.0.0.0' : '127.0.0.1');
const BASE = (process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECURE = BASE.startsWith('https://');
const ROOT = path.join(__dirname, 'public');
const store = require('./src/store')(process.env);
const TEMPLATES = { PI: 'templates/PI-Security-Guards-02-2025.pdf', PL: 'templates/Public-Liability-02-2025.pdf', GPA: 'templates/Biz-PA-Proposal-12-2025.pdf' };
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8' };
const buckets = new Map(), loginBuckets = new Map();

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (SECURE) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
}
function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  if (res.cookies) headers['Set-Cookie'] = res.cookies;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body), ...headers });
  res.end(body);
}
const readBody = (req, max = 8 * 1024 * 1024) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', (c) => { size += c.length; if (size > max) { reject(Object.assign(new Error('Request too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); } });
  req.on('error', reject);
});
const limited = (map, ip, max, windowMs) => { const now = Date.now(), a = (map.get(ip) || []).filter((t) => now - t < windowMs); a.push(now); map.set(ip, a); return a.length > max; };
// Behind a proxy, take the Nth address from the RIGHT (N = TRUST_PROXY hops): the left side is attacker-controlled.
const clientIp = (req) => { const n = Number(process.env.TRUST_PROXY) || 0, xs = String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean); return (n && xs.length >= n ? xs[xs.length - n] : '') || req.socket.remoteAddress || 'unknown'; };
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
const cookie = (n, v, maxAge, p = '/') => `${n}=${encodeURIComponent(v)}; HttpOnly; SameSite=Strict; Path=${p}; Max-Age=${maxAge}${SECURE ? '; Secure' : ''}`;
const setSession = (res, s) => { res.cookies = [cookie('oneform_at', s.accessToken, s.expiresIn || 3600), cookie('oneform_rt', s.refreshToken, 7 * 86400, '/api/v1/auth')]; };
const clearSession = (res) => { res.cookies = [cookie('oneform_at', '', 0), cookie('oneform_rt', '', 0, '/api/v1/auth')]; };
async function agent(req) { const t = cookies(req).oneform_at; const user = t && (await store.userFromToken(t)); return user ? { user, token: t } : null; }
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

function serveFile(req, res, filename, download = false) {
  const full = path.resolve(ROOT, filename);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return send(res, 400, { error: 'Invalid path' });
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, { error: 'Not found' });
    const ext = path.extname(full).toLowerCase();
    const cache = ext === '.pdf' ? 'private, no-store' : ['.html', '.js', '.css', '.webmanifest'].includes(ext) ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache, 'Content-Length': data.length, ...(download ? { 'Content-Disposition': `attachment; filename="${path.basename(full)}"` } : {}) });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}

async function handleApi(req, res, u) {
  const p = u.pathname, m = req.method;
  if (m === 'GET' && p === '/api/health') {  // ?deep=1 also touches the database (use for uptime pings; keeps a Supabase free project active)
    if (u.searchParams.get('deep') === '1') await store.ping();
    return send(res, 200, { ok: true, mode: store.mode });
  }
  if (m === 'GET' && p.startsWith('/api/template/')) { const f = TEMPLATES[p.split('/').pop()]; return f ? serveFile(req, res, f, true) : send(res, 404, { error: 'Template not found' }); }
  const isGuest = p.startsWith('/api/v1/guest/');
  // CSRF: cookie-authenticated writes must carry a custom header (cross-site forms/fetches cannot set it without CORS, which we never grant).
  if (m !== 'GET' && !isGuest && req.headers['x-requested-with'] !== 'oneform') return send(res, 403, { error: 'Forbidden' });

  if (m === 'POST' && p === '/api/v1/auth/login') {
    if (limited(loginBuckets, clientIp(req), 8, 15 * 60e3)) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
    const b = await readBody(req, 5000);
    if (limited(loginBuckets, 'acct:' + String(b.email || '').toLowerCase().slice(0, 200), 8, 15 * 60e3)) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
    const s = await store.login(String(b.email || '').slice(0, 200), String(b.password || '').slice(0, 200));
    if (!s) return send(res, 401, { error: 'Emel atau kata laluan salah.' });
    setSession(res, s); return send(res, 200, { user: s.user });
  }
  if (m === 'POST' && p === '/api/v1/auth/refresh') {
    const s = cookies(req).oneform_rt && (await store.refresh(cookies(req).oneform_rt));
    if (!s) { clearSession(res); return send(res, 401, { error: 'Session expired.' }); }
    setSession(res, s); return send(res, 200, { user: s.user });
  }
  if (m === 'POST' && p === '/api/v1/auth/logout') { clearSession(res); return send(res, 200, { ok: true }); }
  if (m === 'GET' && p === '/api/v1/auth/me') { const a = await agent(req); return a ? send(res, 200, { user: a.user }) : send(res, 401, { error: 'Not signed in.' }); }

  if (p === '/api/v1/applications') {
    const a = await agent(req); if (!a) return send(res, 401, { error: 'Not signed in.' });
    if (m === 'GET') return send(res, 200, { applications: await store.listApplications(a.user, a.token) });
    if (m === 'POST') {
      const b = await readBody(req, 5000), email = b.customerEmail ? String(b.customerEmail).slice(0, 200) : '';
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'Invalid customer email.' });
      const r = await store.createApplication(a.user, { type: b.formType, customerEmail: email });
      return send(res, 200, { reference: r.application.reference_no, url: `${BASE}/#t=${r.token}`, expiresInDays: 7 });
    }
  }
  if (m === 'GET' && p === '/api/v1/guest/session') { const g = await store.getGuest(bearer(req)); return g ? send(res, 200, { formType: g.insurance_type, reference: g.reference_no }) : send(res, 401, { error: 'Pautan tidak sah, telah digunakan atau tamat tempoh.' }); }
  if (m === 'POST' && p === '/api/v1/guest/submit') {
    if (limited(buckets, 'submit:' + clientIp(req), 10, 60e3)) return send(res, 429, { error: 'Too many requests.' });
    const r = await store.submitGuest(bearer(req), await readBody(req)); return send(res, 200, { ok: true, reference: r.reference, notice: 'Permohonan anda telah diterima oleh ejen. Simpan nombor rujukan ini.' });
  }
  return send(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  try {
    const u = new URL(req.url, BASE);
    if (u.pathname.startsWith('/api/')) {
      if (limited(buckets, clientIp(req), 120, 60e3)) return send(res, 429, { error: 'Too many requests. Try again later.' });
      return await handleApi(req, res, u);
    }
    if (req.method === 'GET' || req.method === 'HEAD') { let p = decodeURIComponent(u.pathname); if (p === '/') p = '/index.html'; return serveFile(req, res, p.replace(/^\/+/, '')); }
    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    const status = e.status || (/^Invalid|too large/i.test(e.message) ? 400 : 500);
    if (status === 500) console.error('[error]', e.message);       // never echo internals to the client
    return send(res, status, { error: status === 500 ? 'Server error.' : e.message });
  }
});

setInterval(() => { const now = Date.now(); for (const map of [buckets, loginBuckets]) for (const [k, a] of map) if (!a.some((t) => now - t < 15 * 60e3)) map.delete(k); }, 10 * 60e3).unref();

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Generali OneForm running at ${BASE}  (bound to ${HOST}:${PORT})  store=${store.mode}`);
    if (store.mode === 'memory') {
      console.log('\n  LOCAL DEV MODE: data is kept in memory and lost on restart. Do not use for real customers.');
      console.log(`  Agent login:  ${store.demoCredentials.email}  /  ${store.demoCredentials.password}\n`);
    }
  });
}
module.exports = server; module.exports.store = store;

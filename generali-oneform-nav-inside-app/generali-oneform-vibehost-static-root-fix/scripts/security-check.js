// Verifies "secrets live on the server, never in the browser" - static scan + live HTTP probes.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
process.env.PORT = '0';
const server = require('../server.js');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const SECRET_PATTERNS = {
  'Supabase secret key': /sb_secret_[A-Za-z0-9_-]{8,}/, 'service_role': /service_role/i, 'secret env name': /SUPABASE_SECRET|GOOGLE_CLIENT_SECRET|GOOGLE_REFRESH_TOKEN|OAUTH_STATE_SECRET/,
  'Google client secret': /GOCSPX-[A-Za-z0-9_-]{10,}/, 'Google refresh token': /\b1\/\/[0-9A-Za-z_-]{40,}/, 'Google API key': /AIza[0-9A-Za-z_-]{35}/,
  'private key block': /-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'JWT': /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/, 'server env access': /process\.env/
};
// 1. Nothing shipped to the browser contains a secret or server-side config access.
const files = walk(PUB).filter((f) => /\.(html|js|css|json|webmanifest|svg|txt|map)$/.test(f));
for (const [name, re] of Object.entries(SECRET_PATTERNS)) {
  const hit = files.filter((f) => re.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
  ok(!hit.length, `public/ has no ${name}${hit.length ? ' -> ' + hit.join(', ') : ''}`);
}
ok(!fs.existsSync(path.join(PUB, '.env')) && !fs.existsSync(path.join(PUB, 'src')), 'no .env or src/ inside public/');
// 2. Secret hygiene in the repo.
ok(!fs.existsSync(path.join(ROOT, '.env')), 'no real .env shipped in the project');
const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
ok(/^\.env$/m.test(gi) && /^\.env\.\*$/m.test(gi) && /^!\.env\.example$/m.test(gi), '.gitignore blocks .env and .env.* (keeps .env.example)');
const leaks = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8').split(/\r?\n/).filter((l) => /^(\w*(SECRET|TOKEN|KEY)\w*)=(.+)$/.test(l) && !l.startsWith('#'));
ok(!leaks.length, '.env.example has empty values for every SECRET/TOKEN/KEY' + (leaks.length ? ' -> ' + leaks.join('; ') : ''));
// 3. Secrets are only referenced from server code (src/, server.js), never from public/ or scripts that ship to browsers.
const srvUse = walk(ROOT).filter((f) => !/node_modules|\/docs\/|\.env\.example|render\.yaml|scripts\/|\.md$|\.sql/.test(f) && /SUPABASE_SECRET_KEY/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
ok(srvUse.every((f) => f.startsWith('src/')), 'SUPABASE_SECRET_KEY is referenced only in src/ (' + srvUse.join(', ') + ')');
// 4. Live probes: server-side files and config must not be reachable over HTTP.
const get = (port, p) => new Promise((res) => http.get({ port, path: p }, (r) => { r.resume(); res({ status: r.statusCode, headers: r.headers }); }));
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
  const blocked = ['/.env', '/.env.example', '/src/server.js', '/server.js', '/package.json', '/.git/config', '/%2e%2e/.env', '/..%2f.env', '/..%2fsrc%2fserver.js', '/supabase/migrations/002_agent_portal_google_email.sql', '/scripts/security-check.js', '/docs/SECURITY-MODEL.md', '/node_modules/', '/api/config', '/api/env'];
  for (const p of blocked) { const r = await get(port, p); ok(r.status >= 400 && r.status < 500, `HTTP ${p} -> ${r.status} (not served)`); }
  const r = await get(port, '/');
  ok(!r.headers['x-powered-by'], 'no X-Powered-By banner'); ok(/script-src 'self'/.test(r.headers['content-security-policy'] || ''), 'CSP restricts scripts to same origin (no inline/third-party injection)');
  server.close(); console.log(fail ? `\n${fail} FAILED` : '\nall security checks passed'); process.exit(fail ? 1 : 0);
})();

// Zero-dependency end-to-end API test against the real server.js (memory store).
const http = require('node:http'), assert = require('node:assert/strict'), { spawnSync } = require('node:child_process'), path = require('node:path');
Object.assign(process.env, { PORT: '0', DEMO_AGENT_EMAIL: 'agent@test.local', DEMO_AGENT_PASSWORD: 'correct-horse', NODE_ENV: 'test' });
const server = require('../server.js');
const call = (port, method, p, { body, headers = {} } = {}) => new Promise((resolve, reject) => {
  const r = http.request({ port, method, path: p, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers } }, (res) => {
    const c = []; res.on('data', (x) => c.push(x)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(c) }));
  }); r.on('error', reject); if (body) r.write(JSON.stringify(body)); r.end();
});
const J = (r) => JSON.parse(r.body.toString()); const X = { 'X-Requested-With': 'oneform' };
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); const port = server.address().port; let n = 0;
  const ok = (name, fn) => fn().then(() => { n++; console.log('PASS  ' + name); }).catch((e) => { console.error('FAIL  ' + name + ' - ' + e.message); process.exitCode = 1; });
  let cookie = '', link = '', token = '';
  await ok('portal + CSP + health', async () => { const r = await call(port, 'GET', '/'); assert.equal(r.status, 200); assert.match(r.headers['content-security-policy'], /script-src 'self'/); assert.equal(J(await call(port, 'GET', '/api/health')).mode, 'memory'); });
  for (const f of ['/app.js', '/liquid-nav.js', '/styles.css', '/sw.js', '/manifest.webmanifest', '/assets/generali-logo.png', '/assets/generali-mark.png', '/assets/icon-192.png']) await ok('static ' + f, async () => assert.equal((await call(port, 'GET', f)).status, 200));
  for (const t of ['PI', 'PL', 'GPA']) await ok('template ' + t, async () => { const r = await call(port, 'GET', '/api/template/' + t); assert.equal(r.status, 200); assert.equal(r.body.slice(0, 4).toString(), '%PDF'); });
  await ok('path traversal blocked', async () => assert.ok([400, 404].includes((await call(port, 'GET', '/..%2fserver.js')).status)));
  await ok('write without CSRF header -> 403', async () => assert.equal((await call(port, 'POST', '/api/v1/auth/login', { body: { email: 'a', password: 'b' } })).status, 403));
  await ok('unauthenticated agent endpoints -> 401', async () => { assert.equal((await call(port, 'GET', '/api/v1/applications')).status, 401); assert.equal((await call(port, 'POST', '/api/v1/applications', { headers: X, body: { formType: 'PL' } })).status, 401); assert.equal((await call(port, 'GET', '/api/v1/auth/me')).status, 401); });
  await ok('login ok: HttpOnly + SameSite=Strict cookies, token never in body', async () => {
    const r = await call(port, 'POST', '/api/v1/auth/login', { headers: X, body: { email: 'agent@test.local', password: 'correct-horse' } }); assert.equal(r.status, 200);
    const sc = r.headers['set-cookie']; assert.ok(sc.length === 2 && sc.every((c) => /HttpOnly/.test(c) && /SameSite=Strict/.test(c))); assert.ok(!/accessToken|oneform_at/.test(r.body.toString()));
    cookie = sc.map((c) => c.split(';')[0]).join('; ');
  });
  await ok('/me with cookie', async () => assert.equal(J(await call(port, 'GET', '/api/v1/auth/me', { headers: { Cookie: cookie } })).user.role, 'agent'));
  await ok('invalid form type / bad email rejected', async () => { const h = { ...X, Cookie: cookie }; assert.equal((await call(port, 'POST', '/api/v1/applications', { headers: h, body: { formType: 'XX' } })).status, 400); assert.equal((await call(port, 'POST', '/api/v1/applications', { headers: h, body: { formType: 'PL', customerEmail: 'nope' } })).status, 400); });
  await ok('agent creates application + one-time link (#t= fragment)', async () => {
    const r = await call(port, 'POST', '/api/v1/applications', { headers: { ...X, Cookie: cookie }, body: { formType: 'PL', customerEmail: 'c@example.com' } }); assert.equal(r.status, 200);
    link = J(r).url; token = link.split('#t=')[1]; assert.ok(token.length > 30); assert.match(J(r).reference, /^GEN-\d{8}-[0-9A-F]{6}$/);
  });
  const G = () => ({ Authorization: 'Bearer ' + token });
  await ok('guest session returns form type; bad token 401', async () => { assert.equal(J(await call(port, 'GET', '/api/v1/guest/session', { headers: G() })).formType, 'PL'); assert.equal((await call(port, 'GET', '/api/v1/guest/session', { headers: { Authorization: 'Bearer nope' } })).status, 401); });
  await ok('submit validation: no signature / bad key / bad image / oversize field', async () => {
    const s = (b) => call(port, 'POST', '/api/v1/guest/submit', { headers: G(), body: b });
    assert.equal((await s({ answers: { a: 'x' } })).status, 400); assert.equal((await s({ answers: { 'bad key!': 'x' }, signatureData: PNG })).status, 400);
    assert.equal((await s({ answers: { a: 'x' }, signatureData: 'data:text/html;base64,AAAA' })).status, 400); assert.equal((await s({ answers: { a: 'x'.repeat(5001) }, signatureData: PNG })).status, 400);
  });
  await ok('submit succeeds once; link is then dead (401)', async () => {
    const r = await call(port, 'POST', '/api/v1/guest/submit', { headers: G(), body: { answers: { proposer: 'Test' }, members: [{ name: 'A' }], signatureData: PNG } }); assert.equal(r.status, 200);
    assert.equal((await call(port, 'POST', '/api/v1/guest/submit', { headers: G(), body: { answers: { proposer: 'Again' }, signatureData: PNG } })).status, 401);
    assert.equal((await call(port, 'GET', '/api/v1/guest/session', { headers: G() })).status, 401);
  });
  await ok('agent list shows the submitted application (no form_data leaked in list)', async () => { const l = J(await call(port, 'GET', '/api/v1/applications', { headers: { Cookie: cookie } })).applications; assert.equal(l.length, 1); assert.equal(l[0].status, 'submitted'); assert.ok(!('form_data' in l[0])); });
  await ok('refresh issues new session; logout clears cookies', async () => {
    const rt = cookie.split('; ').find((c) => c.startsWith('oneform_rt')); const r = await call(port, 'POST', '/api/v1/auth/refresh', { headers: { ...X, Cookie: rt } }); assert.equal(r.status, 200);
    const o = await call(port, 'POST', '/api/v1/auth/logout', { headers: X }); assert.ok(o.headers['set-cookie'].every((c) => /Max-Age=0/.test(c)));
  });
  await ok('production refuses to start in demo mode', async () => { const r = spawnSync(process.execPath, ['-e', "require('./server.js')"], { cwd: path.join(__dirname, '..'), env: { PATH: process.env.PATH, NODE_ENV: 'production' }, encoding: 'utf8' }); assert.notEqual(r.status, 0); assert.match(r.stderr, /Refusing to start in demo/); });
  await ok('login brute force throttled (429)', async () => { let last; for (let i = 0; i < 10; i++) last = await call(port, 'POST', '/api/v1/auth/login', { headers: X, body: { email: 'agent@test.local', password: 'wrong' + i } }); assert.equal(last.status, 429); });
  console.log(`\n${n} checks passed`); server.close(); process.exit(process.exitCode || 0);
})();

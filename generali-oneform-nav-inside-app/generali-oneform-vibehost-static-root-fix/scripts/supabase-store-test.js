// Runs the real src/store/supabase.js against a recording stub of @supabase/supabase-js.
// Proves key usage and logic (RLS client for reads, hashed tokens, optimistic claim, private bucket).
// It cannot prove Postgres RLS itself: run supabase/tests/rls_staging_test.sql on staging.
const Module = require('node:module'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const env = { SUPABASE_URL: 'https://x.supabase.test', SUPABASE_PUBLISHABLE_KEY: 'PUB', SUPABASE_SECRET_KEY: 'SEC' };
const clients = [], script = {}; // script['table.op'] = result | fn
const builder = (c, table) => { const b = { c, table, ops: [], filters: [], payload: null };
  for (const op of ['select', 'order', 'limit']) b[op] = (...a) => { b.ops.push([op, a]); return b; };
  for (const op of ['insert', 'update']) b[op] = (p) => { b.op = op; b.payload = p; return b; };
  b.eq = (k, v) => { b.filters.push([k, v]); return b; };
  const res = () => { const k = `${table}.${b.op || 'select'}`, s = script[k]; return typeof s === 'function' ? s(b) : (s ?? { data: null, error: null }); };
  b.single = b.maybeSingle = () => Promise.resolve(res()); b.then = (f, r) => Promise.resolve(res()).then(f, r); c.log.push(b); return b; };
const stub = { createClient: (url, key, opts) => { const c = { url, key, opts, log: [], uploads: [],
  auth: { signInWithPassword: async () => script.signIn, refreshSession: async () => script.refresh, getUser: async (t) => (t === 'goodjwt' ? { data: { user: { id: 'u1', email: 'a@x.my' } }, error: null } : { data: null, error: { message: 'bad' } }) },
  from: (t) => builder(c, t), storage: { from: (bucket) => ({ upload: async (p, buf, o) => { c.uploads.push({ bucket, p, o }); return { error: null }; } }) } }; clients.push(c); return c; } };
const load = Module._load; Module._load = (r, ...a) => (r === '@supabase/supabase-js' ? stub : load(r, ...a));
const store = require('../src/store/supabase.js')(env); Module._load = load;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex'), admin = clients[0], PNG = 'data:image/png;base64,iVBORw0KGgo=';
script['profiles.select'] = { data: { id: 'u1', full_name: 'Ali', role: 'agent', is_active: true }, error: null };
let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('PASS  ' + name); } catch (e) { console.error('FAIL  ' + name + ' - ' + e.message); process.exitCode = 1; } };
(async () => {
  await t('admin client uses SECRET key; login/refresh use PUBLISHABLE key', async () => {
    assert.equal(admin.key, 'SEC'); script.signIn = { data: { session: { user: { id: 'u1', email: 'a@x.my' }, access_token: 'A', refresh_token: 'R', expires_in: 3600 } }, error: null };
    const s = await store.login('a@x.my', 'pw'); assert.equal(s.user.role, 'agent'); assert.equal(clients.at(-1).key, 'PUB');
  });
  await t('bad password -> null; inactive profile -> null', async () => {
    script.signIn = { data: {}, error: { message: 'x' } }; assert.equal(await store.login('a', 'b'), null);
    script['profiles.select'] = { data: { id: 'u1', full_name: 'A', role: 'agent', is_active: false }, error: null }; assert.equal(await store.userFromToken('goodjwt'), null);
    script['profiles.select'] = { data: { id: 'u1', full_name: 'Ali', role: 'agent', is_active: true }, error: null };
  });
  await t('listApplications reads via PUBLISHABLE key + caller JWT (RLS), never the secret client', async () => {
    script['applications.select'] = { data: [{ id: 'a1' }], error: null }; const before = clients.length;
    await store.listApplications({ id: 'u1', role: 'agent' }, 'goodjwt'); const uc = clients.at(-1);
    assert.ok(clients.length > before); assert.equal(uc.key, 'PUB'); assert.equal(uc.opts.global.headers.Authorization, 'Bearer goodjwt');
    assert.deepEqual(uc.log[0].filters, [['agent_id', 'u1']]); assert.ok(!admin.log.some((b) => b.table === 'applications' && b.op !== 'insert' && b.op !== 'update'));
    await store.listApplications({ id: 'adm', role: 'admin' }, 'goodjwt'); assert.deepEqual(clients.at(-1).log[0].filters, []);
  });
  let token;
  await t('createApplication: draft status, agent owner, only the token HASH is stored', async () => {
    script['applications.insert'] = { data: { id: 'app1', reference_no: 'GEN-1', insurance_type: 'PL' }, error: null }; script['guest_links.insert'] = { data: null, error: null };
    const r = await store.createApplication({ id: 'u1', role: 'agent' }, { type: 'PL' }); token = r.token;
    const app = admin.log.find((b) => b.table === 'applications' && b.op === 'insert').payload, gl = admin.log.find((b) => b.table === 'guest_links' && b.op === 'insert').payload;
    assert.equal(app.status, 'draft'); assert.equal(app.agent_id, 'u1'); assert.equal(gl.token_hash, sha(token)); assert.ok(!JSON.stringify(gl).includes(token)); assert.equal(gl.max_uses, 1);
    await assert.rejects(store.createApplication({ id: 'u1', role: 'agent' }, { type: 'ZZ' }), /Invalid form type/);
  });
  const link = () => ({ id: 'l1', application_id: 'app1', expires_at: new Date(Date.now() + 1e6).toISOString(), max_uses: 1, use_count: 0, revoked_at: null, applications: { id: 'app1', reference_no: 'GEN-1', insurance_type: 'PL', status: 'draft' } });
  await t('guest link lookup is by hash; expired/revoked/used/non-draft links are rejected', async () => {
    script['guest_links.select'] = (b) => { assert.deepEqual(b.filters, [['token_hash', sha('tok')]]); return { data: link(), error: null }; }; assert.equal((await store.getGuest('tok')).insurance_type, 'PL');
    for (const mut of [(l) => (l.expires_at = new Date(Date.now() - 1).toISOString()), (l) => (l.revoked_at = 'x'), (l) => (l.use_count = 1), (l) => (l.applications.status = 'submitted')]) { script['guest_links.select'] = () => { const l = link(); mut(l); return { data: l, error: null }; }; assert.equal(await store.getGuest('tok'), null); }
  });
  await t('submit: optimistic claim, private bucket upload, status -> submitted; lost race -> 409', async () => {
    script['guest_links.select'] = { data: link(), error: null }; script['guest_links.update'] = { data: [{ id: 'l1' }], error: null }; script['applications.update'] = { data: null, error: null };
    const r = await store.submitGuest('tok', { answers: { a: 'b' }, members: [], signatureData: PNG }); assert.equal(r.reference, 'GEN-1');
    const claim = admin.log.filter((b) => b.table === 'guest_links' && b.op === 'update').at(-1); assert.deepEqual(claim.filters, [['id', 'l1'], ['use_count', 0]]);
    assert.ok(admin.uploads.every((u) => u.bucket === 'private-application-files' && u.p.startsWith('app1/'))); assert.equal(admin.log.filter((b) => b.table === 'applications' && b.op === 'update').at(-1).payload.status, 'submitted');
    script['guest_links.update'] = { data: [], error: null }; await assert.rejects(store.submitGuest('tok', { answers: {}, signatureData: PNG }), (e) => e.status === 409);
    await assert.rejects(store.submitGuest('tok', { answers: {} }), (e) => e.status === 400 || e.status === 409);
  });
  console.log(`\n${n} supabase-store checks passed`); process.exit(process.exitCode || 0);
})();

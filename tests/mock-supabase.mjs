// Pelayan Supabase tiruan (HANYA untuk ujian tempatan). Meniru peraturan schema.sql: token SHA-256, RLS Ejen/HQ, kelulusan, PKCE Google.
import http from 'node:http'; import crypto from 'node:crypto';
const PORT = Number(process.env.PORT || 54321);
const users = new Map(), profiles = new Map(), apps = [], codes = new Map();
const HQ_ALLOW = new Set(['hq@test.dev', 'hq-google@gmail.com']);
const b64u = (b) => Buffer.from(b).toString('base64url'), sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const jwt = (sub) => `${b64u('{"alg":"HS256"}')}.${b64u(JSON.stringify({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }))}.sig`;
const session = (u) => ({ access_token: jwt(u.id), refresh_token: 'r-' + u.id, expires_in: 3600, token_type: 'bearer', user: { id: u.id, email: u.email } });
function addUser(email, password, name, confirmed = true, status) {
  const id = crypto.randomUUID(), u = { id, email, password, name, confirmed }; users.set(email, u);
  const hq = confirmed && HQ_ALLOW.has(email);
  profiles.set(id, { id, email, full_name: name || email.split('@')[0], role: hq ? 'hq' : 'agent', status: hq ? 'active' : (status || 'pending'), created_at: new Date().toISOString() }); return u;
}
addUser('hq@test.dev', 'Passw0rd!', 'HQ Boss'); addUser('agent@test.dev', 'Passw0rd!', 'Ejen Ali', true, 'active'); addUser('agent2@test.dev', 'Passw0rd!', 'Ejen Siti', true, 'active');
const send = (res, code, data, extra = {}) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', ...extra }); res.end(data === undefined ? '' : JSON.stringify(data)); };
const fail = (res, msg, code = 400) => send(res, code, { code: 'P0001', message: msg });
const me = (req) => { const t = (req.headers.authorization || '').slice(7); try { return profiles.get(JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).sub) || null; } catch { return null; } };
const find = (tok) => { if (!/^[0-9a-f]{48}$/.test(tok || '')) throw new Error('bad'); const a = apps.find((x) => x.token_hash === sha(tok)); if (!a) throw new Error('bad'); if (a.status === 'revoked') throw new Error('revoked'); if (a.status === 'draft' && new Date(a.expires_at) < new Date()) throw new Error('expired'); return a; };
const active = (p) => p && p.status === 'active';
const visible = (p) => (!active(p) ? [] : p.role === 'hq' ? apps : apps.filter((a) => a.agent_id === p.id));
const png = (s) => typeof s === 'string' && s.startsWith('data:image/png;base64,') && s.length <= 800000;
const RPC = {
  create_application(a, p) { if (!active(p)) throw new Error('forbidden'); if (!['PI', 'PL', 'GPA'].includes(a.p_form)) throw new Error('bad_form'); const token = crypto.randomBytes(24).toString('hex'); const row = { id: crypto.randomUUID(), reference_no: `GEN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`, token_hash: sha(token), form_type: a.p_form, agent_id: p.id, customer_email: a.p_customer_email || null, status: 'draft', answers: {}, members: [], draft_step: 0, signature: null, stamp: null, expires_at: new Date(Date.now() + 7 * 864e5).toISOString(), created_at: new Date().toISOString(), submitted_at: null }; apps.push(row); return { id: row.id, token, reference_no: row.reference_no, expires_at: row.expires_at }; },
  revoke_application(a, p) { if (!active(p)) throw new Error('forbidden'); const r = apps.find((x) => x.id === a.p_id && x.status === 'draft' && (x.agent_id === p.id || p.role === 'hq')); if (r) r.status = 'revoked'; return !!r; },
  hq_set_agent_status(a, p) { if (!(active(p) && p.role === 'hq')) throw new Error('forbidden'); if (!['active', 'suspended'].includes(a.p_status) || a.p_user === p.id) throw new Error('bad'); const t = profiles.get(a.p_user); if (t && t.role === 'agent') { t.status = a.p_status; return true; } return false; },
  customer_get(a) { const r = find(a.p_token); return { form_type: r.form_type, reference_no: r.reference_no, status: r.status, expires_at: r.expires_at, answers: r.answers, members: r.members, step: r.draft_step }; },
  customer_save_draft(a) { const r = find(a.p_token); if (r.status !== 'draft') throw new Error('locked'); if (typeof a.p_answers !== 'object' || !Array.isArray(a.p_members)) throw new Error('bad'); Object.assign(r, { answers: a.p_answers, members: a.p_members, draft_step: Math.max(0, Math.min(a.p_step | 0, 20)) }); return true; },
  customer_submit(a) { const r = find(a.p_token); if (r.status !== 'draft') throw new Error('locked'); if (!a.p_answers || !Object.keys(a.p_answers).length) throw new Error('bad'); if (!png(a.p_signature) || (a.p_stamp && !png(a.p_stamp))) throw new Error('bad_image'); Object.assign(r, { answers: a.p_answers, members: a.p_members, signature: a.p_signature, stamp: a.p_stamp || null, status: 'submitted', submitted_at: new Date().toISOString() }); return { reference_no: r.reference_no }; },
};
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); if (req.method === 'OPTIONS') return send(res, 204);
  let body = ''; for await (const c of req) body += c; const j = body ? JSON.parse(body) : {};
  if (!req.headers.apikey && u.pathname !== '/auth/v1/authorize') return fail(res, 'No API key', 401);
  const p = u.pathname;
  if (p === '/__confirm') { const x = users.get(u.searchParams.get('email')); x.confirmed = true; if (HQ_ALLOW.has(x.email)) Object.assign(profiles.get(x.id), { role: 'hq', status: 'active' }); return send(res, 200, { ok: true }); }
  if (p === '/__expire') { apps.find((a) => a.id === u.searchParams.get('id')).expires_at = new Date(Date.now() - 1000).toISOString(); return send(res, 200, { ok: true }); }
  if (p === '/__state') return send(res, 200, { apps: apps.map((a) => ({ ...a, signature: a.signature && 'png', stamp: a.stamp && 'png' })), profiles: [...profiles.values()] });
  if (p === '/auth/v1/signup') { if (users.has(j.email)) return send(res, 200, { id: 'x', email: j.email }); if ((j.password || '').length < 8) return fail(res, 'Password should be at least 8 characters', 422); addUser(j.email, j.password, j.data?.full_name, false); return send(res, 200, { id: 'new', email: j.email }); }
  if (p === '/auth/v1/token') {
    const g = u.searchParams.get('grant_type');
    if (g === 'password') { const x = users.get(j.email); if (!x || x.password !== j.password) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }); if (!x.confirmed) return send(res, 400, { error: 'invalid_grant', error_description: 'Email not confirmed' }); return send(res, 200, session(x)); }
    if (g === 'refresh_token') { const x = [...users.values()].find((q) => 'r-' + q.id === j.refresh_token); return x ? send(res, 200, session(x)) : send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' }); }
    if (g === 'pkce') { const c = codes.get(j.auth_code); codes.delete(j.auth_code); if (!c || b64u(crypto.createHash('sha256').update(j.code_verifier || '').digest()) !== c.challenge) return send(res, 400, { error: 'invalid_grant', error_description: 'PKCE failed' }); let x = users.get(c.email) || addUser(c.email, null, 'Google User', true); return send(res, 200, session(x)); }
  }
  if (p === '/auth/v1/authorize') { const code = 'c' + crypto.randomBytes(6).toString('hex'); codes.set(code, { challenge: u.searchParams.get('code_challenge'), email: process.env.GOOGLE_EMAIL || 'hq-google@gmail.com' }); res.writeHead(302, { location: u.searchParams.get('redirect_to') + '?code=' + code }); return res.end(); }
  if (p === '/auth/v1/logout' || p === '/auth/v1/recover') return send(res, 204);
  const who = me(req);
  if (p.startsWith('/rest/v1/rpc/')) { try { const r = RPC[p.slice(13)]; if (!r) return fail(res, 'no fn', 404); return send(res, 200, r(j, who)); } catch (e) { return fail(res, e.message); } }
  if (p === '/rest/v1/profiles') { if (!who) return send(res, 200, []); const id = (u.searchParams.get('id') || '').replace('eq.', ''), role = (u.searchParams.get('role') || '').replace('eq.', ''); let rows = [...profiles.values()]; rows = who.role === 'hq' && active(who) ? rows : rows.filter((x) => x.id === who.id); if (id) rows = rows.filter((x) => x.id === id); if (role) rows = rows.filter((x) => x.role === role); return send(res, 200, rows); }
  if (p === '/rest/v1/applications') { let rows = visible(who); const id = (u.searchParams.get('id') || '').replace('eq.', ''); if (id) rows = rows.filter((x) => x.id === id); rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((a) => { const o = { ...a }; if (u.searchParams.get('select')?.includes('profiles(')) { delete o.signature; delete o.stamp; const pr = profiles.get(a.agent_id); o.profiles = { full_name: pr.full_name, email: pr.email }; } return o; }); return send(res, 200, rows); }
  send(res, 404, { message: 'not found' });
}).listen(PORT, () => console.log('mock supabase on', PORT));

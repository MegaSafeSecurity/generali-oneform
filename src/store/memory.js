'use strict';
// DEV/TEST store. Data lives in process memory and is lost on restart. Never used when Supabase is configured.
const crypto = require('node:crypto');
const { sha256, newToken, newReference, TYPES, cleanSubmission } = require('./common.js');
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

module.exports = function memoryStore(env = process.env) {
  const agentEmail = (env.DEMO_AGENT_EMAIL || 'agent@demo.test').toLowerCase();
  const agentPassword = env.DEMO_AGENT_PASSWORD || crypto.randomBytes(6).toString('hex');
  const users = new Map([[agentEmail, { id: 'demo-agent', email: agentEmail, name: 'Demo Agent', role: 'agent' }]]);
  const access = new Map(), refresh = new Map(), apps = new Map(), links = new Map();
  const issue = (user) => {
    const a = newToken(), r = newToken();
    access.set(a, { user, exp: Date.now() + 3600e3 }); refresh.set(r, { user, exp: Date.now() + 7 * 86400e3 });
    return { user, accessToken: a, refreshToken: r, expiresIn: 3600 };
  };
  const valid = (token) => { const l = links.get(sha256(token || '')); return l && !l.revoked && l.expires > Date.now() && l.uses < l.max ? l : null; };
  return {
    mode: 'memory', async ping() { return true; }, demoCredentials: { email: agentEmail, password: agentPassword },
    async login(email, password) { const u = users.get(String(email || '').toLowerCase()); return u && eq(password || '', agentPassword) ? issue(u) : null; },
    async refresh(rt) { const s = refresh.get(rt); if (!s || s.exp < Date.now()) return null; refresh.delete(rt); return issue(s.user); },
    async userFromToken(t) { const s = access.get(t); return s && s.exp > Date.now() ? s.user : null; },
    async listApplications(user) { return [...apps.values()].filter((a) => user.role === 'admin' || a.agent_id === user.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(({ form_data, ...r }) => r); },
    async createApplication(user, { type, customerEmail }) {
      if (!TYPES.includes(type)) throw Object.assign(new Error('Invalid form type.'), { status: 400 });
      const app = { id: crypto.randomUUID(), reference_no: newReference(), agent_id: user.id, insurance_type: type, status: 'draft', customer_email: customerEmail || null, created_at: new Date().toISOString(), submitted_at: null, form_data: {} };
      const token = newToken(); apps.set(app.id, app);
      links.set(sha256(token), { appId: app.id, expires: Date.now() + 7 * 86400e3, max: 1, uses: 0, revoked: false });
      return { application: { id: app.id, reference_no: app.reference_no, insurance_type: type }, token };
    },
    async getGuest(token) { const l = valid(token); if (!l) return null; const a = apps.get(l.appId); return { reference_no: a.reference_no, insurance_type: a.insurance_type, status: a.status }; },
    async submitGuest(token, body) {
      const l = valid(token); if (!l) throw Object.assign(new Error('Pautan tidak sah, telah digunakan atau tamat tempoh.'), { status: 401 });
      const s = cleanSubmission(body), a = apps.get(l.appId);
      l.uses++; a.form_data = { answers: s.answers, members: s.members, hasSignature: true, hasStamp: !!s.stamp }; a.status = 'submitted'; a.submitted_at = new Date().toISOString();
      return { reference: a.reference_no };
    }
  };
};

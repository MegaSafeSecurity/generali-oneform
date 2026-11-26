'use strict';
// PRODUCTION store. Two identities on purpose:
//   admin  = SECRET key (bypasses RLS): server-only writes, JWT verification, guest links, private storage.
//   userDb = PUBLISHABLE key + the agent's own JWT: every read on behalf of a user, so Postgres RLS is enforced.
const { sha256, newToken, newReference, TYPES, cleanSubmission } = require('./common.js');
const BUCKET = 'private-application-files';
const fail = (message, status) => Object.assign(new Error(message), { status });

module.exports = function supabaseStore(env = process.env) {
  const { createClient } = require('@supabase/supabase-js');
  const opt = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, opt);
  const anon = () => createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, opt);
  const userDb = (jwt) => createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { ...opt, global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const toUser = async (authUser) => {
    const { data: p } = await admin.from('profiles').select('id,full_name,role,is_active').eq('id', authUser.id).single();
    return p && p.is_active ? { id: p.id, email: authUser.email, name: p.full_name, role: p.role } : null;
  };
  const session = async (s) => { const user = s?.user && (await toUser(s.user)); return user ? { user, accessToken: s.access_token, refreshToken: s.refresh_token, expiresIn: s.expires_in || 3600 } : null; };
  const findLink = async (token) => {
    const { data: l } = await admin.from('guest_links').select('id,application_id,expires_at,max_uses,use_count,revoked_at,applications(id,reference_no,insurance_type,status)').eq('token_hash', sha256(token || '')).maybeSingle();
    return l && !l.revoked_at && new Date(l.expires_at) > new Date() && l.use_count < l.max_uses && l.applications?.status === 'draft' ? l : null;
  };
  const event = (application_id, actor_id, actor_type, event_type, metadata = {}) => admin.from('application_events').insert({ application_id, actor_id, actor_type, event_type, metadata });
  return {
    mode: 'supabase',
    async ping() { const { error } = await admin.from('profiles').select('id').limit(1); if (error) throw error; return true; },
    async login(email, password) { const { data, error } = await anon().auth.signInWithPassword({ email, password }); return error ? null : session(data.session); },
    async refresh(refresh_token) { const { data, error } = await anon().auth.refreshSession({ refresh_token }); return error ? null : session(data.session); },
    async userFromToken(jwt) { const { data, error } = await admin.auth.getUser(jwt); return error || !data?.user ? null : toUser(data.user); },
    async listApplications(user, jwt) {
      let q = userDb(jwt).from('applications').select('id,reference_no,insurance_type,status,created_at,submitted_at,agent_id').order('created_at', { ascending: false }).limit(100);
      if (user.role !== 'admin') q = q.eq('agent_id', user.id);   // redundant with RLS on purpose (defence in depth)
      const { data, error } = await q; if (error) throw error; return data || [];
    },
    async createApplication(user, { type, customerEmail }) {
      if (!TYPES.includes(type)) throw fail('Invalid form type.', 400);
      const { data: app, error } = await admin.from('applications').insert({ reference_no: newReference(), agent_id: user.id, insurance_type: type, form_version: 'pdf-2025', status: 'draft', customer_email: customerEmail || null }).select('id,reference_no,insurance_type').single();
      if (error) throw error;
      const token = newToken();
      const { error: e2 } = await admin.from('guest_links').insert({ application_id: app.id, token_hash: sha256(token), expires_at: new Date(Date.now() + 7 * 86400e3).toISOString(), max_uses: 1 });
      if (e2) throw e2;
      await event(app.id, user.id, user.role === 'admin' ? 'admin' : 'agent', 'application_created', { type });
      return { application: app, token };
    },
    async getGuest(token) { const l = await findLink(token); return l && { reference_no: l.applications.reference_no, insurance_type: l.applications.insurance_type, status: l.applications.status }; },
    async submitGuest(token, body) {
      const l = await findLink(token); if (!l) throw fail('Pautan tidak sah, telah digunakan atau tamat tempoh.', 401);
      const s = cleanSubmission(body), id = l.application_id;
      // Claim the link first (optimistic lock): only one concurrent submit can win.
      const { data: claimed } = await admin.from('guest_links').update({ use_count: l.use_count + 1 }).eq('id', l.id).eq('use_count', l.use_count).select('id');
      if (!claimed?.length) throw fail('Permohonan ini sedang/telah dihantar.', 409);
      const put = (name, f) => admin.storage.from(BUCKET).upload(`${id}/${name}`, f.buffer, { contentType: f.mime, upsert: true });
      const up = await Promise.all([put('signature.png', s.signature), s.stamp ? put('stamp', s.stamp) : null]);
      if (up.some((r) => r?.error)) { await admin.from('guest_links').update({ use_count: l.use_count }).eq('id', l.id); throw fail('Could not store files.', 500); }
      const { error } = await admin.from('applications').update({ form_data: { answers: s.answers, members: s.members, hasSignature: true, hasStamp: !!s.stamp }, status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      await event(id, null, 'customer', 'customer_submitted', {});
      return { reference: l.applications.reference_no };
    }
  };
};

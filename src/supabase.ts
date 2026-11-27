/** Klien Supabase nipis (fetch): Auth (kata laluan, Google PKCE), PostgREST dan RPC. Hanya kunci anon/public digunakan. */
import type { FormType } from './forms-data';
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;
const BASE = __SUPABASE_URL__, ANON = __SUPABASE_ANON_KEY__;
const SKEY = 'oneform.session', VKEY = 'oneform.pkce';

export class ApiError extends Error { constructor(public readonly code: string, public readonly status: number) { super(code); } }
interface Session { access_token: string; refresh_token: string; expires_at: number }
interface TokenResp { access_token: string; refresh_token: string; expires_in?: number }

const store = {
  get(): Session | null { try { return JSON.parse(localStorage.getItem(SKEY) ?? 'null') as Session | null; } catch { return null; } },
  set(s: Session | null): void { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); },
};
const toSession = (d: TokenResp): Session => ({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in ?? 3600) * 1000 });
const redirect = (): string => location.origin + location.pathname;
const b64u = (b: Uint8Array): string => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function http<T>(path: string, method: 'GET' | 'POST', body?: unknown, token?: string | null): Promise<T> {
  let res: Response;
  try {
    const headers: Record<string, string> = { apikey: ANON, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (!ANON.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${ANON}`;
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new ApiError('network', 0); }
  const text = await res.text();
  let data: unknown = null; try { data = text ? JSON.parse(text) : null; } catch { /* bukan JSON */ }
  if (!res.ok) {
    const o = (data ?? {}) as Record<string, unknown>;
    throw new ApiError(String(o.message ?? o.msg ?? o.error_description ?? o.error ?? res.status), res.status);
  }
  return data as T;
}

/* ---------------- sesi ---------------- */
export async function accessToken(): Promise<string | null> {
  const s = store.get(); if (!s) return null;
  if (s.expires_at - Date.now() > 60_000) return s.access_token;
  try { const n = toSession(await http<TokenResp>('/auth/v1/token?grant_type=refresh_token', 'POST', { refresh_token: s.refresh_token })); store.set(n); return n.access_token; }
  catch (e) { if (e instanceof ApiError && e.status === 0) return s.access_token; store.set(null); return null; }
}
const clean = (): void => history.replaceState(null, '', location.pathname);

export async function signIn(email: string, password: string): Promise<void> {
  store.set(toSession(await http<TokenResp>('/auth/v1/token?grant_type=password', 'POST', { email, password })));
}
/** 'session' = terus masuk; 'confirm' = perlu sahkan emel. */
export async function signUp(email: string, password: string, fullName: string): Promise<'session' | 'confirm'> {
  const d = await http<Partial<TokenResp>>(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirect())}`, 'POST', { email, password, data: { full_name: fullName } });
  if (d.access_token && d.refresh_token) { store.set(toSession(d as TokenResp)); return 'session'; }
  return 'confirm';
}
export async function signOut(): Promise<void> {
  const t = store.get()?.access_token; store.set(null);
  if (t) { try { await http('/auth/v1/logout', 'POST', undefined, t); } catch { /* sesi tempatan sudah dipadam */ } }
}
export const recover = (email: string): Promise<unknown> => http(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect())}`, 'POST', { email });

/** Google OAuth dengan PKCE: pelayar dialihkan ke Supabase -> Google -> kembali dengan ?code=. */
export async function googleSignIn(): Promise<void> {
  const verifier = b64u(crypto.getRandomValues(new Uint8Array(48)));
  sessionStorage.setItem(VKEY, verifier);
  const challenge = b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  location.assign(`${BASE}/auth/v1/authorize?${new URLSearchParams({ provider: 'google', redirect_to: redirect(), code_challenge: challenge, code_challenge_method: 's256' })}`);
}
/** Dipanggil sekali semasa muat: urus kembali daripada Google / pautan pengesahan emel / set semula kata laluan. */
export async function handleAuthRedirect(): Promise<'none' | 'ok' | 'error'> {
  const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1));
  try {
    const code = q.get('code');
    if (code) {
      const v = sessionStorage.getItem(VKEY); sessionStorage.removeItem(VKEY);
      if (!v) throw new Error('pkce');
      store.set(toSession(await http<TokenResp>('/auth/v1/token?grant_type=pkce', 'POST', { auth_code: code, code_verifier: v })));
      clean(); return 'ok';
    }
    const at = h.get('access_token'), rt = h.get('refresh_token');
    if (at && rt) { store.set({ access_token: at, refresh_token: rt, expires_at: Date.now() + Number(h.get('expires_in') || 3600) * 1000 }); clean(); return 'ok'; }
    if (h.get('error') || q.get('error')) { clean(); return 'error'; }
  } catch { clean(); return 'error'; }
  return 'none';
}

/* ---------------- data ---------------- */
export interface Profile { id: string; email: string; full_name: string; role: 'agent' | 'hq'; status: 'pending' | 'active' | 'suspended'; created_at: string }
export type AppStatus = 'draft' | 'submitted' | 'revoked';
export interface AppRow { id: string; reference_no: string; form_type: FormType; status: AppStatus; customer_email: string | null; created_at: string; submitted_at: string | null; expires_at: string; agent_id: string; hq_email_status?: 'pending' | 'sending' | 'sent' | 'failed'; profiles?: { full_name: string; email: string } | null }
export interface AppFull extends AppRow { answers: Record<string, unknown>; members: Record<string, string>[]; signature: string | null; stamp: string | null }
export interface CustomerLink { form_type: FormType; reference_no: string; status: AppStatus; expires_at: string; answers: Record<string, unknown>; members: Record<string, string>[]; step: number }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const rest = async <T>(path: string): Promise<T> => http<T>('/rest/v1/' + path, 'GET', undefined, await accessToken());
const rpcUser = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => http<T>('/rest/v1/rpc/' + fn, 'POST', args, await accessToken());
const rpcAnon = <T>(fn: string, args: Record<string, unknown>): Promise<T> => http<T>('/rest/v1/rpc/' + fn, 'POST', args, null);

export async function getProfile(): Promise<Profile | null> {
  const t = await accessToken(); if (!t) return null;
  let sub = ''; try { sub = (JSON.parse(atob((t.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: string }).sub ?? ''; } catch { return null; }
  if (!UUID.test(sub)) return null;
  return (await rest<Profile[]>(`profiles?id=eq.${sub}&select=*`))[0] ?? null;
}
const LIST = 'applications?select=id,reference_no,form_type,status,customer_email,created_at,submitted_at,expires_at,agent_id,hq_email_status,profiles(full_name,email)&order=created_at.desc&limit=300';
export const listApplications = (): Promise<AppRow[]> => rest<AppRow[]>(LIST);
export async function getApplication(id: string): Promise<AppFull | null> { if (!UUID.test(id)) return null; return (await rest<AppFull[]>(`applications?id=eq.${id}&select=*`))[0] ?? null; }
export const listAgents = (): Promise<Profile[]> => rest<Profile[]>('profiles?role=eq.agent&select=*&order=created_at.desc');
export const createApplication = (form: FormType, email: string): Promise<{ id: string; token: string; reference_no: string; expires_at: string }> => rpcUser('create_application', { p_form: form, p_customer_email: email || null });
export const revokeApplication = (id: string): Promise<boolean> => rpcUser('revoke_application', { p_id: id });
export const setAgentStatus = (id: string, status: 'active' | 'suspended'): Promise<boolean> => rpcUser('hq_set_agent_status', { p_user: id, p_status: status });

/* pelanggan (tanpa akaun): dilindungi token pautan */
export const customerGet = (token: string): Promise<CustomerLink> => rpcAnon('customer_get', { p_token: token });
export const customerSaveDraft = (token: string, answers: unknown, members: unknown, step: number): Promise<boolean> => rpcAnon('customer_save_draft', { p_token: token, p_answers: answers, p_members: members, p_step: step });
export const customerSubmit = (token: string, answers: unknown, members: unknown, signature: string, stamp: string | null): Promise<{ reference_no: string }> => rpcAnon('customer_submit', { p_token: token, p_answers: answers, p_members: members, p_signature: signature, p_stamp: stamp });


/* Hantar PDF + dokumen sokongan melalui Edge Function. Kunci Gmail kekal di server. */
export interface HqAttachment { name: string; type: string; data: string }
export async function sendHqEmail(token: string, referenceNo: string, pdf: string, attachments: HqAttachment[]): Promise<void> {
  let res: Response;
  try {
    res = await fetch(BASE + '/functions/v1/send-hq-email', {
      method: 'POST',
      headers: { apikey: ANON, ...(ANON.startsWith('sb_publishable_') ? {} : { Authorization: `Bearer ${ANON}` }), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, reference_no: referenceNo, pdf, attachments }),
    });
  } catch { throw new ApiError('network', 0); }
  const data = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new ApiError(data.error || `email_${res.status}`, res.status);
}

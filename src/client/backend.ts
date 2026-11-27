import { AGENTS, LINK_DAYS, LINK_SECRET, MAX_IMAGE_BYTES, SESSION_HOURS } from './config';

export type FormType = 'PI' | 'PL' | 'GPA';
export interface LinkInfo { id: string; type: FormType; exp: number; ref: string }
export interface RecordRow { id: string; ref: string; type: FormType; status: 'draft' | 'submitted'; created: string; exp: number; submitted?: string; customerEmail?: string }
export interface Submission { answers: Record<string, unknown>; members: Record<string, string>[]; signatureData: string; stampData: string | null }
interface Draft { answers: Record<string, unknown>; members: Record<string, string>[]; step: number }

const enc = new TextEncoder();
const FORMS: readonly string[] = ['PI', 'PL', 'GPA'];
const ID_RE = /^[a-f0-9]{16}$/;
const K = { rec: 'oneform.records', sub: 'oneform.sub.', draft: 'oneform.draft.', ses: 'oneform.session', fail: 'oneform.fail' };

const hex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const rand = (n: number): string => hex(crypto.getRandomValues(new Uint8Array(n)));
const b64u = (s: string): string => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string): string => atob(s.replace(/-/g, '+').replace(/_/g, '/'));
const safeEq = (a: string, b: string): boolean => { let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; };

function read<T>(key: string, fallback: T, store: Storage = localStorage): T {
  try { const v = store.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown, store: Storage = localStorage): void {
  try { store.setItem(key, JSON.stringify(value)); } catch { throw new Error('storage'); }
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(LINK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}
async function pbkdf2(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256)));
}

/* ---------- agent session (sessionStorage; password never stored) ---------- */
export interface User { email: string; name: string }
export async function login(email: string, password: string): Promise<User> {
  const f = read<{ n: number; until: number }>(K.fail, { n: 0, until: 0 });
  if (f.until > Date.now()) throw new Error('locked');
  const acc = AGENTS.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  const ok = acc ? safeEq(await pbkdf2(password, acc.salt), acc.hash) : (await pbkdf2(password, 'x'), false);
  if (!acc || !ok) { const n = f.n + 1; write(K.fail, { n: n >= 5 ? 0 : n, until: n >= 5 ? Date.now() + 5 * 60e3 : 0 }); throw new Error('bad'); }
  localStorage.removeItem(K.fail);
  const user: User = { email: acc.email, name: acc.name };
  write(K.ses, { user, exp: Date.now() + SESSION_HOURS * 3600e3 }, sessionStorage);
  return user;
}
export function me(): User | null {
  const s = read<{ user: User; exp: number } | null>(K.ses, null, sessionStorage);
  if (!s || s.exp < Date.now()) { sessionStorage.removeItem(K.ses); return null; }
  return s.user;
}
export function logout(): void { sessionStorage.removeItem(K.ses); }

/* ---------- records ---------- */
export const listRecords = (): RecordRow[] => read<RecordRow[]>(K.rec, []).sort((a, b) => b.created.localeCompare(a.created));
function upsert(row: RecordRow): void { const all = read<RecordRow[]>(K.rec, []).filter((r) => r.id !== row.id); all.push(row); write(K.rec, all.slice(-500)); }
const newRef = (): string => `GEN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${rand(3).toUpperCase()}`;

/* ---------- stateless customer link: payload.signature, HMAC-SHA256, 7 days ---------- */
export async function createLink(type: string, customerEmail: string): Promise<{ url: string; row: RecordRow }> {
  if (!me()) throw new Error('auth');
  if (!FORMS.includes(type)) throw new Error('bad');
  const info: LinkInfo = { id: rand(8), type: type as FormType, exp: Date.now() + LINK_DAYS * 86400e3, ref: newRef() };
  const payload = b64u(JSON.stringify(info));
  const base = new URL('.', location.href);
  base.search = new URLSearchParams({ token: `${payload}.${await hmac(payload)}`, type, exp: String(info.exp) }).toString();
  const row: RecordRow = { id: info.id, ref: info.ref, type: info.type, status: 'draft', created: new Date().toISOString(), exp: info.exp };
  if (/^[^\s@]{1,64}@[^\s@]{1,190}$/.test(customerEmail)) row.customerEmail = customerEmail;
  upsert(row);
  return { url: base.toString(), row };
}
export async function readToken(token: string, typeParam?: string | null, expParam?: string | null): Promise<LinkInfo> {
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined || !safeEq(await hmac(payload), sig)) throw new Error('bad');
  let info: LinkInfo;
  try { info = JSON.parse(unb64u(payload)) as LinkInfo; } catch { throw new Error('bad'); }
  if (!FORMS.includes(info.type) || !ID_RE.test(info.id) || typeof info.exp !== 'number' || typeof info.ref !== 'string') throw new Error('bad');
  if ((typeParam && typeParam !== info.type) || (expParam && Number(expParam) !== info.exp)) throw new Error('bad');
  if (info.exp < Date.now()) throw new Error('expired');
  return info;
}

/* ---------- drafts + submissions (browser storage only) ---------- */
export const saveDraft = (id: string, d: Draft): void => { try { write(K.draft + id, d); } catch { /* quota: draft skipped */ } };
export function loadDraft(id: string): Draft | null {
  const d = read<Draft | null>(K.draft + id, null);
  return d && typeof d.step === 'number' && Array.isArray(d.members) && d.answers && typeof d.answers === 'object' ? d : null;
}

/** Verifies PNG/JPEG magic bytes + size, then re-encodes to a small PNG that pdf-lib can embed. */
export async function normalizeImage(dataUrl: string): Promise<string> {
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m || !m[2]) throw new Error('image');
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (bytes.length > MAX_IMAGE_BYTES || (m[1] === 'png' ? !png : !jpg)) throw new Error('image');
  const img = new Image();
  await new Promise<void>((ok, no) => { img.onload = () => ok(); img.onerror = () => no(new Error('image')); img.src = dataUrl; });
  const k = Math.min(1, 900 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

export async function submit(link: LinkInfo, s: Submission): Promise<{ reference: string }> {
  const sub: Submission = { answers: s.answers, members: s.members, signatureData: await normalizeImage(s.signatureData), stampData: s.stampData ? await normalizeImage(s.stampData) : null };
  try { write(K.sub + link.id, sub); } catch { throw new Error('storage'); }
  localStorage.removeItem(K.draft + link.id);
  const prev = read<RecordRow[]>(K.rec, []).find((r) => r.id === link.id);
  upsert({ ...(prev ?? { id: link.id, ref: link.ref, type: link.type, created: new Date().toISOString(), exp: link.exp }), status: 'submitted', submitted: new Date().toISOString() });
  return { reference: link.ref };
}
export const getSubmission = (id: string): Submission | null => (ID_RE.test(id) ? read<Submission | null>(K.sub + id, null) : null);

/* ---------- export / import (agent receives the customer's JSON file) ---------- */
export function exportAll(): string {
  const records = listRecords();
  const submissions: Record<string, Submission> = {};
  for (const r of records) { const s = getSubmission(r.id); if (s) submissions[r.id] = s; }
  return JSON.stringify({ app: 'generali-oneform', version: 1, records, submissions });
}
export function importAll(text: string): number {
  if (text.length > 25 * 1024 * 1024) throw new Error('bad');
  let data: { app?: string; records?: unknown; submissions?: unknown };
  try { data = JSON.parse(text) as typeof data; } catch { throw new Error('bad'); }
  if (data.app !== 'generali-oneform' || !Array.isArray(data.records)) throw new Error('bad');
  const subs = (data.submissions && typeof data.submissions === 'object' ? data.submissions : {}) as Record<string, Submission>;
  let n = 0;
  for (const r of data.records as RecordRow[]) {
    if (!r || !ID_RE.test(r.id) || !FORMS.includes(r.type) || typeof r.ref !== 'string' || !/^GEN-\d{8}-[A-F0-9]{6}$/.test(r.ref)) continue;
    const row: RecordRow = { id: r.id, ref: r.ref, type: r.type, status: r.status === 'submitted' ? 'submitted' : 'draft', created: String(r.created).slice(0, 30), exp: Number(r.exp) || 0 };
    const s = subs[r.id];
    if (s && s.answers && typeof s.signatureData === 'string' && /^data:image\/png;base64,/.test(s.signatureData)) { write(K.sub + r.id, { answers: s.answers, members: Array.isArray(s.members) ? s.members : [], signatureData: s.signatureData, stampData: typeof s.stampData === 'string' && s.stampData.startsWith('data:image/png;base64,') ? s.stampData : null }); row.status = 'submitted'; }
    upsert(row); n++;
  }
  return n;
}

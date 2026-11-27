import { $, $$, esc } from './dom';
import { lang, setLang, t, tk, type Key } from './i18n';
import * as api from './supabase';
import { FORM_NAMES, FORM_NAV, MEMBER_KEYS, NAV_FORMS, STEPS, TEMPLATES, type FormType } from './forms-data';
import { collect, dateError, displayValue, firstMissing, newFormState, normalizeImage, renderStep, reviewHtml, setupSignature } from './form-engine';
import { buildPdf, downloadBytes } from './pdf';

interface NavApi { setActive(i: number): void; setLabels(l: string[]): void }
interface LiquidNavGlobal { mount(el: HTMLElement, o: unknown): NavApi; ICONS: Record<string, string> }
const LN = (window as unknown as { LiquidNav?: LiquidNavGlobal }).LiquidNav;

const VIEWS = ['#authView', '#pendingView', '#dashView', '#custHomeView', '#formView', '#reviewView', '#doneView'] as const;
type View = (typeof VIEWS)[number];
const F = newFormState();                       // satu objek borang (diubah di tempat)
const S = {
  profile: null as api.Profile | null, token: null as string | null, link: null as api.CustomerLink | null,
  view: '#authView' as View, authMode: 'login' as 'login' | 'signup', tab: 'apps' as 'apps' | 'agents',
  filter: null as FormType | null, busy: false, apps: [] as api.AppRow[], agents: [] as api.Profile[],
};
let nav: NavApi | null = null, clearSig: () => void = () => undefined, saveTimer = 0;
const isForm = (v: string): v is FormType => v === 'PI' || v === 'PL' || v === 'GPA';

/* ---------------- umum ---------------- */
function toast(msg: string): void { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout((toast as unknown as { h?: number }).h); (toast as unknown as { h?: number }).h = window.setTimeout(() => el.classList.remove('show'), 3600); }
function errText(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  const map: Record<string, Key> = { bad: 'errBad', expired: 'errExpired', revoked: 'errRevoked', locked: 'errLocked', forbidden: 'errForbidden', bad_image: 'errImage', image: 'errImage', network: 'errNetwork' };
  const k = map[m]; if (k) return t(k);
  return /invalid login|credentials|not confirmed/i.test(m) ? t('errCreds') : t('errGeneric');
}
/** Nav (Utama / Biz PA / Public Liability / PI Security Guards) hanya wujud DI DALAM: selepas log masuk Ejen/HQ, atau pada pautan pelanggan. */
function syncMode(): void { document.body.dataset.mode = S.profile?.status === 'active' || S.token ? 'app' : 'auth'; }
function show(v: View): void {
  S.view = v; VIEWS.forEach((x) => $(x).classList.add('hidden')); $(v).classList.remove('hidden');
  syncMode(); window.scrollTo({ top: 0 }); syncNav();
}
function syncNav(): void {
  if (!nav) return;
  const inForm = F.form && (S.view === '#formView' || S.view === '#reviewView');
  nav.setActive(inForm && F.form ? FORM_NAV[F.form] : S.token ? 0 : S.filter ? FORM_NAV[S.filter] : 0);
}
const navLabels = (): string[] => [t('navHome'), 'Biz PA', 'Public Liability', 'PI Security Guards'];
function applyLang(): void {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach((el) => { el.innerHTML = tk(el.dataset.i18n ?? ''); });
  $('#langBtn').textContent = lang === 'ms' ? 'EN' : 'BM';
  nav?.setLabels(navLabels());
  if (S.view === '#dashView') renderDash();
  if (F.form && S.view === '#formView') renderStep(F);
  if (S.view === '#custHomeView') fillCustHome();
}

/* ---------------- log masuk / daftar / Google ---------------- */
function authMsg(text: string, ok = false): void { const m = $('#authMsg'); m.hidden = !text; m.textContent = text; m.classList.toggle('ok', ok); }
function setAuthMode(m: 'login' | 'signup'): void {
  S.authMode = m; const login = m === 'login';
  $('#tabLogin').setAttribute('aria-selected', String(login)); $('#tabSignup').setAttribute('aria-selected', String(!login));
  $('#nameField').classList.toggle('hidden', login); $('#forgotBtn').classList.toggle('hidden', !login);
  $('#authTitle').dataset.i18n = login ? 'loginTitle' : 'signupTitle'; $('#authSubmit').dataset.i18n = login ? 'loginBtn' : 'signupBtn';
  $('#authNoteText').dataset.i18n = login ? 'custNote' : 'signupNote';
  $<HTMLInputElement>('#authPass').autocomplete = login ? 'current-password' : 'new-password';
  authMsg(''); applyLang();
}
async function submitAuth(e: Event): Promise<void> {
  e.preventDefault(); if (S.busy) return;
  const email = $<HTMLInputElement>('#authEmail').value.trim(), pw = $<HTMLInputElement>('#authPass').value, name = $<HTMLInputElement>('#authName').value.trim();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}$/.test(email)) return authMsg(t('errEmail'));
  if (S.authMode === 'signup' && !name) return authMsg(t('errName'));
  if (S.authMode === 'signup' ? pw.length < 8 : pw.length < 1) return authMsg(t('errPw'));
  S.busy = true; $<HTMLButtonElement>('#authSubmit').disabled = true;
  try {
    if (S.authMode === 'login') await api.signIn(email, pw);
    else if ((await api.signUp(email, pw, name)) === 'confirm') { setAuthMode('login'); authMsg(t('signupConfirm'), true); return; }
    $<HTMLInputElement>('#authPass').value = ''; await enterApp();
  } catch (err) { authMsg(errText(err)); } finally { S.busy = false; $<HTMLButtonElement>('#authSubmit').disabled = false; }
}

async function enterApp(): Promise<void> {
  if (!(await api.accessToken())) { S.profile = null; show('#authView'); return; }
  try { S.profile = await api.getProfile(); } catch { S.profile = null; }
  const p = S.profile;
  if (p?.status === 'active') { show('#dashView'); await loadDash(); return; }
  $('#pendingEyebrow').textContent = p ? tk('s_' + p.status).toUpperCase() : '';
  $('#pendingText').textContent = p?.status === 'suspended' ? t('suspendedText') : t('pendingText');
  show('#pendingView');
}
async function logout(): Promise<void> {
  await api.signOut(); S.profile = null; S.apps = []; S.agents = []; S.filter = null; S.tab = 'apps';
  $('#linkResult').classList.add('hidden'); show('#authView'); setAuthMode('login');
}

/* ---------------- dashboard Ejen / HQ ---------------- */
async function loadDash(): Promise<void> {
  const p = S.profile; if (!p) return;
  $('#dashName').textContent = `${p.full_name || p.email} · ${tk('role_' + p.role)}`;
  $('#hqTabs').classList.toggle('hidden', p.role !== 'hq');
  await refreshLists();
}
async function refreshLists(): Promise<void> {
  try {
    S.apps = await api.listApplications();
    S.agents = S.profile?.role === 'hq' ? await api.listAgents() : [];
  } catch (e) { toast(errText(e)); }
  renderDash();
}
function renderDash(): void {
  const hq = S.profile?.role === 'hq', list = $('#appList');
  $('#tabApps').setAttribute('aria-selected', String(S.tab === 'apps')); $('#tabAgents').setAttribute('aria-selected', String(S.tab === 'agents'));
  $('#listTitle').classList.toggle('hidden', hq === true);
  if (hq && S.tab === 'agents') {
    list.innerHTML = S.agents.length ? S.agents.map((a) => `<div class="agent-row"><b>${esc(a.full_name || '-')}</b><small>${esc(a.email)}</small><span class="pill st-${esc(a.status)}">${esc(tk('s_' + a.status))}</span><span class="row-actions">${a.status !== 'active' ? `<button class="row-btn" data-act="active" data-id="${esc(a.id)}">${a.status === 'suspended' ? t('reactivate') : t('approve')}</button>` : ''}${a.status === 'active' ? `<button class="row-btn neutral" data-act="suspended" data-id="${esc(a.id)}">${t('suspend')}</button>` : ''}</span></div>`).join('') : `<p class="hint">${t('agentsEmpty')}</p>`;
    return;
  }
  const rows = S.apps.filter((a) => !S.filter || a.form_type === S.filter);
  list.innerHTML = rows.length ? rows.map((a) => `<div class="app-row"><b>${esc(a.reference_no)}</b><span>${esc(a.form_type)}</span><span class="pill st-${esc(a.status)}">${esc(tk('st_' + a.status))}</span>${a.status === 'submitted' ? `<small class="mail-state mail-${esc(a.hq_email_status || 'pending')}">E-mel HQ: ${esc(a.hq_email_status || 'pending')}</small>` : ''}<small>${esc(a.created_at.slice(0, 10))}${hq && a.profiles ? ' · ' + esc(a.profiles.full_name || a.profiles.email) : ''}</small><span class="row-actions">${a.status === 'submitted' ? `<button class="row-btn" data-act="pdf" data-id="${esc(a.id)}">PDF</button>` : ''}${a.status === 'draft' ? `<button class="row-btn neutral" data-act="revoke" data-id="${esc(a.id)}">${t('revoke')}</button>` : ''}</span></div>`).join('') : `<p class="hint">${t('noApps')}</p>`;
}
async function listAction(e: Event): Promise<void> {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]'); const id = b?.dataset.id, act = b?.dataset.act; if (!b || !id || S.busy) return;
  S.busy = true;
  try {
    if (act === 'pdf') { const a = await api.getApplication(id); if (a?.signature) await makePdf(a.form_type, a.reference_no, a.answers, a.members, a.signature, a.stamp); }
    else if (act === 'revoke') { await api.revokeApplication(id); await refreshLists(); }
    else if (act === 'active' || act === 'suspended') { await api.setAgentStatus(id, act); await refreshLists(); }
  } catch (err) { toast(errText(err)); } finally { S.busy = false; }
}
async function createLink(): Promise<void> {
  if (S.busy) return; const form = $<HTMLSelectElement>('#linkForm').value; if (!isForm(form)) return;
  S.busy = true; $<HTMLButtonElement>('#createLink').disabled = true;
  try {
    const r = await api.createApplication(form, $<HTMLInputElement>('#customerEmail').value.trim());
    const url = new URL(location.origin + location.pathname); url.searchParams.set('token', r.token);
    $<HTMLInputElement>('#guestUrl').value = url.toString(); $('#linkResult').classList.remove('hidden');
    await refreshLists();
  } catch (e) { toast(errText(e)); } finally { S.busy = false; $<HTMLButtonElement>('#createLink').disabled = false; }
}
async function copyLink(): Promise<void> { const el = $<HTMLInputElement>('#guestUrl'); try { await navigator.clipboard.writeText(el.value); } catch { el.select(); document.execCommand('copy'); } toast(t('copied')); }

/* ---------------- pelanggan (pautan) + borang ---------------- */
async function enterCustomer(token: string): Promise<void> {
  try {
    const l = await api.customerGet(token); S.token = token; S.link = l; syncMode();
    if (l.status === 'submitted') { $('#referenceNo').textContent = l.reference_no; $('#downloadPdfDone').classList.add('hidden'); show('#doneView'); }
    else startForm(l.form_type, l);
  } catch (e) { S.token = null; S.link = null; syncMode(); history.replaceState(null, '', location.pathname); show('#authView'); toast(errText(e)); }
}
function fillCustHome(): void {
  const l = S.link; if (!l) return;
  $('#custTitle').textContent = FORM_NAMES[l.form_type].join(' · '); $('#custRef').textContent = l.reference_no;
  $('#custValidDate').textContent = new Date(l.expires_at).toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-GB');
  $('#custContinue').classList.toggle('hidden', l.status !== 'draft');
}
function startForm(type: FormType, l: api.CustomerLink | null): void {
  if (F.form !== type || l) {
    Object.assign(F, newFormState(), { form: type }); clearSig(); $('#stampPreview').innerHTML = '';
    if (l) { F.answers = { ...l.answers }; F.members = l.members.length ? l.members.map((m) => ({ ...m })) : [{}]; F.step = Math.max(0, Math.min(l.step, STEPS[type].length - 1)); }
  }
  const [name, sub] = FORM_NAMES[type]; $('#formTitle').textContent = name; $('#formSubtitle').textContent = sub;
  $('#downloadTemplate').onclick = () => { window.open('./templates/' + TEMPLATES[type], '_blank', 'noopener'); };
  renderStep(F); show('#formView');
}
function scheduleSave(now = false): void {
  clearTimeout(saveTimer); if (!S.token || S.link?.status !== 'draft') return;
  const run = (): void => { collect(F); if (S.token) void api.customerSaveDraft(S.token, F.answers, F.members, F.step).catch(() => undefined); };
  if (now) run(); else saveTimer = window.setTimeout(run, 1200);
}
function next(): void {
  collect(F); if (!F.form) return;
  if (!$<HTMLFormElement>('#dynamicForm').reportValidity()) return;
  if (F.step < STEPS[F.form].length - 1) { F.step++; renderStep(F); scheduleSave(true); window.scrollTo({ top: 0 }); } else review();
}
function review(): void {
  collect(F); scheduleSave(true);
  const d = dateError(F); if (d) return toast(d);
  const miss = firstMissing(F);
  if (miss) { F.step = miss.step; renderStep(F); toast(`${t('errMissing')} ${miss.label}`); requestAnimationFrame(() => $<HTMLFormElement>('#dynamicForm').reportValidity()); return; }
  $('#reviewSummary').innerHTML = reviewHtml(F); show('#reviewView');
}
async function makePdfBytes(form: FormType, ref: string, answers: Record<string, unknown>, members: Record<string, string>[], sig: string | null, stamp: string | null): Promise<Uint8Array> {
  const sections = STEPS[form].map((s) => ({ title: s.title, rows: s.fields.map((f): [string, string] => [f[1], displayValue(answers[f[0]])]) }));
  const rows = form === 'GPA' ? members.filter((m) => Object.values(m).some(Boolean)).map((m) => MEMBER_KEYS.map((k) => m[k] || '-').join(' | ')) : [];
  return buildPdf({ title: FORM_NAMES[form].join(' - '), reference: ref, sections, members: rows, signature: sig, stamp });
}
async function makePdf(form: FormType, ref: string, answers: Record<string, unknown>, members: Record<string, string>[], sig: string | null, stamp: string | null): Promise<void> {
  try { downloadBytes(await makePdfBytes(form, ref, answers, members, sig, stamp), `${ref}-${form}.pdf`); } catch { toast(t('pdfFail')); }
}
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}
const allowedSupportTypes = new Set(['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
function updateSupportList(): void {
  const files = Array.from($<HTMLInputElement>('#supportFiles').files ?? []);
  $('#supportFileList').textContent = files.length ? files.map((f) => `${f.name} (${(f.size / 1048576).toFixed(2)} MB)`).join(' · ') : 'Tiada fail dipilih.';
}
async function submitApplication(): Promise<void> {
  if (S.busy || !S.token) return;
  if (!F.signature) return toast(t('errSig'));
  if (!$<HTMLInputElement>('#confirmAccuracy').checked) return toast(t('errConfirm'));
  S.busy = true; $<HTMLButtonElement>('#submitApplication').disabled = true;
  try {
    collect(F); F.signature = await normalizeImage(F.signature); if (F.stamp) F.stamp = await normalizeImage(F.stamp);
    const supportFiles = Array.from($<HTMLInputElement>('#supportFiles').files ?? []);
    if (supportFiles.length > 8 || supportFiles.some((f) => f.size > 8 * 1024 * 1024 || !allowedSupportTypes.has(f.type)) || supportFiles.reduce((n, f) => n + f.size, 0) > 18 * 1024 * 1024) {
      toast('Dokumen sokongan tidak sah: maksimum 8 fail, 8MB setiap fail dan 18MB jumlah. Gunakan PDF, JPG, PNG, DOC, DOCX, XLS atau XLSX.');
      return;
    }
    const r = await api.customerSubmit(S.token, F.answers, F.members, F.signature, F.stamp);
    if (S.link) S.link.status = 'submitted';
    $('#referenceNo').textContent = r.reference_no; $('#downloadPdfDone').classList.remove('hidden');
    try {
      const pdf = await makePdfBytes(F.form!, r.reference_no, F.answers, F.members, F.signature, F.stamp);
      const attachments = await Promise.all(supportFiles.map(async (file) => ({ name: file.name, type: file.type, data: bytesToBase64(new Uint8Array(await file.arrayBuffer())) })));
      await api.sendHqEmail(S.token, r.reference_no, bytesToBase64(pdf), attachments);
      toast('Permohonan dan e-mel kepada HQ berjaya dihantar.');
    } catch {
      toast('Permohonan telah diterima, tetapi e-mel HQ belum berjaya dihantar. Sila maklumkan kepada ejen/HQ.');
    }
    show('#doneView');
  } catch (e) { toast(errText(e)); } finally { S.busy = false; $<HTMLButtonElement>('#submitApplication').disabled = false; }
}
const downloadPdf = (): void => { collect(F); if (F.form && S.link) void makePdf(F.form, S.link.reference_no, F.answers, F.members, F.signature, F.stamp); };

/* ---------------- nav (hanya dalam app) ---------------- */
function onNav(i: number): void {
  const ft = NAV_FORMS[i] ?? null;
  if (S.token && S.link) {                                   // halaman pelanggan
    if (i === 0) { collect(F); fillCustHome(); show('#custHomeView'); return; }
    if (S.link.status !== 'draft') { toast(t('errLocked')); syncNav(); return; }
    if (ft === S.link.form_type) { startForm(ft, null); return; }
    toast(`${t('wrongForm')} ${S.link.form_type}`); syncNav(); return;
  }
  if (S.profile?.status === 'active') {                      // dashboard Ejen / HQ
    S.filter = ft; S.tab = 'apps'; if (ft) $<HTMLSelectElement>('#linkForm').value = ft;
    if (S.view !== '#dashView') show('#dashView'); else syncNav();
    renderDash();
  }
}

/* ---------------- mula ---------------- */
function wire(): void {
  $('#langBtn').onclick = () => { collect(F); setLang(lang === 'ms' ? 'en' : 'ms'); applyLang(); };
  $('#tabLogin').onclick = () => setAuthMode('login'); $('#tabSignup').onclick = () => setAuthMode('signup');
  $('#authForm').onsubmit = (e) => void submitAuth(e);
  $('#googleBtn').onclick = () => { api.googleSignIn().catch(() => authMsg(t('googleErr'))); };
  $('#forgotBtn').onclick = () => { const em = $<HTMLInputElement>('#authEmail').value.trim(); if (!/^[^\s@]{1,64}@[^\s@]{1,190}$/.test(em)) return authMsg(t('errEmail')); api.recover(em).catch(() => undefined).finally(() => authMsg(t('forgotSent'), true)); };
  $('#logoutBtn').onclick = () => void logout(); $('#pendingLogout').onclick = () => void logout(); $('#pendingRefresh').onclick = () => void enterApp();
  $('#createLink').onclick = () => void createLink(); $('#copyLink').onclick = () => void copyLink();
  $('#appList').onclick = (e) => void listAction(e);
  $('#tabApps').onclick = () => { S.tab = 'apps'; renderDash(); }; $('#tabAgents').onclick = () => { S.tab = 'agents'; renderDash(); };
  $('#custContinue').onclick = () => { if (S.link) startForm(S.link.form_type, null); };
  $('#doneHome').onclick = () => { fillCustHome(); show('#custHomeView'); };
  $('#backHome').onclick = () => { collect(F); scheduleSave(true); if (S.token) { fillCustHome(); show('#custHomeView'); } };
  $('#prevStep').onclick = () => { collect(F); if (F.step > 0) { F.step--; renderStep(F); scheduleSave(true); } };
  $('#nextStep').onclick = next; $('#backForm').onclick = () => show('#formView');
  $('#dynamicForm').addEventListener('input', () => scheduleSave());
  $('#submitApplication').onclick = () => void submitApplication();
  $('#supportFiles').addEventListener('change', updateSupportList);
  $('#downloadPdfReview').onclick = downloadPdf; $('#downloadPdfDone').onclick = downloadPdf;
  clearSig = setupSignature(F, () => toast(t('errImage')));
  if (LN) nav = LN.mount($('#liquidNav'), { tone: 'light', ariaLabel: 'Main', onChange: onNav, items: navLabels().map((label, i) => ({ label, icon: LN.ICONS[['home', 'shield', 'globe', 'badge'][i] ?? 'home'], fx: ['glow', 'drop', 'spin', 'wave'][i] })) });
}
async function boot(): Promise<void> {
  wire(); setAuthMode('login');
  const tok = new URLSearchParams(location.search).get('token');
  if (tok !== null) { if (/^[0-9a-f]{48}$/.test(tok)) { await enterCustomer(tok); return; } toast(t('errBad')); }
  if ((await api.handleAuthRedirect()) === 'error') toast(t('googleErr'));
  await enterApp();
}
void boot();

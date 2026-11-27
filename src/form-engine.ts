import { DATE_PAIRS, MEMBER_COLS, MEMBER_KEYS, STEPS, type Field, type FormType } from './forms-data';
import { $, $$, esc } from './dom';
import { t } from './i18n';

export const MAX_IMAGE = 3 * 1024 * 1024;
export interface FormState { form: FormType | null; step: number; answers: Record<string, unknown>; members: Record<string, string>[]; signature: string | null; stamp: string | null; signMode: 'draw' | 'upload' }
export const newFormState = (): FormState => ({ form: null, step: 0, answers: {}, members: [{}], signature: null, stamp: null, signMode: 'draw' });

function fieldHtml(s: FormState, f: Field): string {
  const [key, label, type = 'text', required, options] = f;
  const val = s.answers[key] ?? '', id = 'f_' + key, req = required ? ' required' : '', L = esc(label);
  let head = `<label for="${id}">${L}${required ? ' *' : ''}</label>`, input = '';
  if (type === 'textarea') input = `<textarea id="${id}" name="${key}" placeholder="${L}"${req}>${esc(val)}</textarea>`;
  else if (type === 'yesno') { head = `<span class="field-label" id="${id}_l">${L}</span>`; input = `<div class="choice-row" role="radiogroup" aria-labelledby="${id}_l">${['Yes', 'No'].map((v) => `<label><input type="radio" name="${key}" value="${v}"${val === v ? ' checked' : ''}${req}> ${v}</label>`).join('')}</div>`; }
  else if (type === 'checkbox') { head = ''; input = `<div class="choice-row"><label><input type="checkbox" name="${key}"${val ? ' checked' : ''}${req}> ${L}${required ? ' *' : ''}</label></div>`; }
  else if (type === 'select') input = `<select id="${id}" name="${key}"${req}><option value="">Select…</option>${(options ?? []).map((o) => `<option${val === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else { const num = type === 'number' ? ` step="any" min="0" inputmode="decimal"${/\(%\)/.test(label) ? ' max="100"' : ''}` : ''; input = `<input id="${id}" name="${key}" type="${type}" value="${esc(val)}"${req}${num}>`; }
  return `<div class="field ${type === 'textarea' ? 'full-width' : ''}">${head}${input}</div>`;
}

export function renderStep(s: FormState): void {
  if (!s.form) return;
  const arr = STEPS[s.form], step = arr[s.step]; if (!step) return;
  const last = s.step === arr.length - 1;
  $('#extraArea').innerHTML = ''; $('#stepEyebrow').textContent = `STEP ${s.step + 1} / ${arr.length}`;
  $('#stepTitle').textContent = step.title; $('#stepDescription').textContent = step.desc;
  $('#progressBar').style.width = ((s.step + 1) / arr.length) * 100 + '%';
  $('#stepList').innerHTML = arr.map((x, i) => `<div class="step-item ${i === s.step ? 'active' : ''} ${i < s.step ? 'done' : ''}"${i === s.step ? ' aria-current="step"' : ''}><span>${i < s.step ? '✓' : i + 1}</span>${esc(x.title)}</div>`).join('');
  $('#prevStep').style.visibility = s.step === 0 ? 'hidden' : 'visible';
  $('#nextLabel').textContent = last ? t('reviewBtn') : t('nextBtn');
  $('#fieldGrid').innerHTML = step.fields.map((f) => fieldHtml(s, f)).join('');
  if (s.form === 'GPA' && s.step === 2) { renderMembers(s); wireGpaTotals(s); }
}

/** Salin nilai borang ke state (hanya jika borang sedang dipaparkan). */
export function collect(s: FormState): void {
  const form = $<HTMLFormElement>('#dynamicForm');
  if (!s.form || $('#formView').classList.contains('hidden')) return;
  new FormData(form).forEach((v, k) => { s.answers[k] = typeof v === 'string' ? v : ''; });
  $$<HTMLInputElement>('input[type=checkbox]', form).forEach((x) => { s.answers[x.name] = x.checked; });
}

/* ---------- GPA: jadual orang diinsuranskan ---------- */
function renderMembers(s: FormState): void {
  const wrap = document.createElement('div'); wrap.className = 'field full-width';
  wrap.innerHTML = `<span class="field-label">Particular of persons to be insured – Page 7/7</span><div class="table-wrap"><table class="repeat-table"><thead><tr>${MEMBER_COLS.map((x) => `<th>${x}</th>`).join('')}<th><span class="sr-only"></span></th></tr></thead><tbody id="memberRows"></tbody></table></div><button type="button" class="add-row" id="addMember">＋ Add insured person</button>`;
  $('#extraArea').append(wrap); drawMemberRows(s);
  $('#addMember').onclick = () => { s.members.push({}); drawMemberRows(s); };
}
function drawMemberRows(s: FormState): void {
  $('#memberRows').innerHTML = s.members.map((m, i) => `<tr>${MEMBER_KEYS.map((k, c) => `<td><input data-row="${i}" data-key="${k}" value="${esc(m[k] ?? '')}" maxlength="120" aria-label="${MEMBER_COLS[c]} #${i + 1}"${k === 'premium' ? ' inputmode="decimal"' : ''}></td>`).join('')}<td><button type="button" class="row-del" data-del="${i}" aria-label="Remove person #${i + 1}">×</button></td></tr>`).join('');
  $$<HTMLInputElement>('#memberRows input').forEach((el) => { el.oninput = () => { const m = s.members[Number(el.dataset.row)]; if (m) m[el.dataset.key ?? ''] = el.value; if (el.dataset.key === 'premium') recalcGpa(s, true); }; });
  $$('#memberRows [data-del]').forEach((b) => { b.onclick = () => { const i = Number(b.dataset.del); if (s.members.length > 1) s.members.splice(i, 1); else s.members[0] = {}; drawMemberRows(s); recalcGpa(s, true); }; });
}
const q = (n: string): HTMLInputElement | null => document.querySelector<HTMLInputElement>(`[name=${n}]`);
function wireGpaTotals(s: FormState): void {
  const p = q('totalPremium'); if (!p) return;
  p.addEventListener('input', () => { p.dataset.manual = p.value ? '1' : ''; recalcGpa(s, false); });
  q('stampDuty')?.addEventListener('input', () => recalcGpa(s, false));
}
function recalcGpa(s: FormState, fromMembers: boolean): void {
  if (s.form !== 'GPA' || s.step !== 2) return;
  const p = q('totalPremium'), tax = q('serviceTax'), pay = q('totalPayable'); if (!p || !tax || !pay) return;
  const sum = s.members.reduce((a, m) => a + (parseFloat(m.premium ?? '') || 0), 0);
  if (fromMembers && sum > 0 && !p.dataset.manual) p.value = sum.toFixed(2);
  const prem = parseFloat(p.value) || 0, tx = +(prem * 0.08).toFixed(2), stamp = parseFloat(q('stampDuty')?.value ?? '') || 0;
  tax.value = prem ? tx.toFixed(2) : ''; pay.value = prem ? (prem + tx + stamp).toFixed(2) : '';
}

/* ---------- pengesahan + ringkasan ---------- */
export function dateError(s: FormState): string | null {
  for (const [a, b] of DATE_PAIRS) { const x = s.answers[a], y = s.answers[b]; if (typeof x === 'string' && typeof y === 'string' && x && y && y < x) return t('errDate'); }
  return null;
}
export function firstMissing(s: FormState): { step: number; label: string } | null {
  if (!s.form) return null;
  const arr = STEPS[s.form];
  for (let i = 0; i < arr.length; i++) for (const f of arr[i]?.fields ?? []) {
    if (!f[3]) continue; const v = s.answers[f[0]];
    if (f[2] === 'checkbox' ? v !== true : !String(v ?? '').trim()) return { step: i, label: f[1] };
  }
  return null;
}
export const displayValue = (v: unknown): string => (v === true ? 'Yes' : v === false ? 'No' : String(v ?? ''));
export function reviewHtml(s: FormState): string {
  if (!s.form) return '';
  let html = '';
  for (const st of STEPS[s.form]) {
    const rows = st.fields.filter((f) => { const v = s.answers[f[0]]; return v !== undefined && v !== '' && v !== false; }).map((f) => `<div class="summary-item"><small>${esc(f[1])}</small><b>${esc(displayValue(s.answers[f[0]]))}</b></div>`);
    if (rows.length) html += `<h3 class="summary-title">${esc(st.title)}</h3>` + rows.join('');
  }
  if (s.form === 'GPA') { const named = s.members.filter((m) => Object.values(m).some(Boolean)); html += `<h3 class="summary-title">Insured persons</h3><div class="summary-item"><small>Count</small><b>${named.length}</b></div><div class="summary-item"><small>Names</small><b>${esc(named.map((m) => m.name).filter(Boolean).join(', ') || '-')}</b></div>`; }
  return html || '<p>No answers yet.</p>';
}

/* ---------- imej tandatangan / cop: semak jenis, saiz, magic-byte; tukar ke PNG kecil ---------- */
export async function normalizeImage(dataUrl: string): Promise<string> {
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m || !m[2]) throw new Error('image');
  const b = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47, jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (b.length > MAX_IMAGE || (m[1] === 'png' ? !png : !jpg)) throw new Error('image');
  const img = new Image();
  await new Promise<void>((ok, no) => { img.onload = () => ok(); img.onerror = () => no(new Error('image')); img.src = dataUrl; });
  const k = Math.min(1, 900 / Math.max(img.width, img.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
export function readImage(file: File): Promise<string> {
  return new Promise((ok, no) => {
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > MAX_IMAGE) return no(new Error('image'));
    const r = new FileReader(); r.onerror = () => no(new Error('image'));
    r.onload = () => normalizeImage(String(r.result)).then(ok, no); r.readAsDataURL(file);
  });
}

/** Kanvas tandatangan: lukis (tetikus/sentuhan) atau muat naik. Mengembalikan fungsi pembersih. */
export function setupSignature(s: FormState, onError: () => void): () => void {
  const c = $<HTMLCanvasElement>('#signatureCanvas'), ctx = c.getContext('2d'); if (!ctx) return () => undefined;
  let drawing = false;
  const paint = (): void => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.strokeStyle = '#111827'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; };
  const pos = (e: PointerEvent): [number, number] => { const r = c.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height]; };
  const clear = (): void => { paint(); s.signature = null; };
  c.style.touchAction = 'none';
  c.onpointerdown = (e) => { if (s.signMode !== 'draw') return; drawing = true; c.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
  c.onpointermove = (e) => { if (!drawing) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); };
  const end = (): void => { if (!drawing) return; drawing = false; s.signature = c.toDataURL('image/png'); };
  c.onpointerup = end; c.onpointercancel = end;
  const mode = (m: 'draw' | 'upload'): void => { s.signMode = m; $$('[data-signmode]').forEach((b) => b.classList.toggle('active', b.dataset.signmode === m)); $('#chooseSignature').classList.toggle('hidden', m !== 'upload'); };
  $$('[data-signmode]').forEach((b) => { b.onclick = () => mode(b.dataset.signmode === 'upload' ? 'upload' : 'draw'); });
  $('#chooseSignature').onclick = () => $<HTMLInputElement>('#signatureFile').click();
  $('#clearSignature').onclick = clear;
  $<HTMLInputElement>('#signatureFile').onchange = (e) => {
    const f = (e.target as HTMLInputElement).files?.[0]; (e.target as HTMLInputElement).value = ''; if (!f) return;
    readImage(f).then((d) => { s.signature = d; const i = new Image(); i.onload = () => { paint(); const k = Math.min(c.width / i.width, c.height / i.height); ctx.drawImage(i, (c.width - i.width * k) / 2, (c.height - i.height * k) / 2, i.width * k, i.height * k); }; i.src = d; }, onError);
  };
  $<HTMLInputElement>('#stampFile').onchange = (e) => {
    const f = (e.target as HTMLInputElement).files?.[0]; (e.target as HTMLInputElement).value = ''; if (!f) return;
    readImage(f).then((d) => { s.stamp = d; $('#stampPreview').innerHTML = `<img src="${d}" alt="Company stamp">`; }, onError);
  };
  paint(); mode('draw'); $('#stampPreview').innerHTML = s.stamp ? `<img src="${s.stamp}" alt="Company stamp">` : '';
  return clear;
}

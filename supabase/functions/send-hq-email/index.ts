// Generali OneForm — Gmail delivery worker (Supabase Edge Function / Deno)
// Secrets are configured with `supabase secrets set`; never put them in frontend code.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});
const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const enc = new TextEncoder();
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
const cleanHeader = (s: string) => s.replace(/[\r\n\x00-\x1f\x7f]/g, ' ').slice(0, 180);
const wrap64 = (s: string) => s.match(/.{1,76}/g)?.join('\r\n') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
  const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
  const REFRESH_TOKEN = Deno.env.get('GOOGLE_REFRESH_TOKEN') ?? '';
  const MAILBOX = Deno.env.get('GMAIL_SHARED_MAILBOX') ?? '';
  const HQ_EMAIL = Deno.env.get('HQ_EMAIL') ?? '';
  if (![SUPABASE_URL, SERVICE_KEY, CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, MAILBOX, HQ_EMAIL].every(Boolean)) {
    return json({ error: 'server_not_configured' }, 503);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const token = String(body?.token ?? '');
  const reference = String(body?.reference_no ?? '');
  const pdf = body?.pdf;
  const files = Array.isArray(body?.attachments) ? body.attachments : [];
  if (!/^[0-9a-f]{48}$/.test(token) || !/^GEN-\d{8}-[A-F0-9]{6}$/.test(reference)) return json({ error: 'invalid_request' }, 400);
  if (typeof pdf !== 'string' || pdf.length < 20 || pdf.length > 9_000_000 || !Array.isArray(files) || files.length > 8) return json({ error: 'invalid_files' }, 400);

  let pdfBytes: Uint8Array;
  try { pdfBytes = Uint8Array.from(atob(pdf), (c) => c.charCodeAt(0)); } catch { return json({ error: 'invalid_pdf' }, 400); }
  if (new TextDecoder().decode(pdfBytes.slice(0, 4)) !== '%PDF') return json({ error: 'invalid_pdf' }, 400);

  const safeFiles: { name: string; type: string; data: string }[] = [];
  let totalBytes = pdfBytes.byteLength;
  for (const f of files) {
    if (!f || typeof f.name !== 'string' || typeof f.type !== 'string' || typeof f.data !== 'string') return json({ error: 'invalid_attachment' }, 400);
    const name = cleanHeader(f.name).replace(/[\\/]/g, '_');
    const type = f.type.toLowerCase();
    if (!name || name.length > 120 || !/^[\w .()\-]+$/.test(name) || !/^(application\/pdf|image\/(jpeg|png)|application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet))$/.test(type)) return json({ error: 'unsupported_attachment' }, 400);
    if (f.data.length > 8_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(f.data)) return json({ error: 'attachment_too_large' }, 413);
    totalBytes += Math.floor(f.data.length * 3 / 4);
    safeFiles.push({ name, type, data: f.data });
  }
  if (totalBytes > 18_000_000) return json({ error: 'email_size_limit' }, 413);

  const restHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
  const base = SUPABASE_URL.replace(/\/$/, '');
  const tokenHash = await sha256(token);
  const lookup = await fetch(`${base}/rest/v1/applications?token_hash=eq.${tokenHash}&select=id,reference_no,form_type,status,hq_email_status,profiles(full_name,email)`, { headers: restHeaders });
  if (!lookup.ok) return json({ error: 'application_lookup_failed' }, 502);
  const rows = await lookup.json();
  const app = rows?.[0];
  if (!app || app.reference_no !== reference || app.status !== 'submitted') return json({ error: 'application_not_submitted' }, 403);
  if (app.hq_email_status === 'sent') return json({ ok: true, already_sent: true });

  // Atomic claim prevents normal double-click/retry duplicate emails.
  const claim = await fetch(`${base}/rest/v1/applications?id=eq.${app.id}&hq_email_status=eq.pending&status=eq.submitted&select=id`, {
    method: 'PATCH', headers: { ...restHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({ hq_email_status: 'sending', hq_email_error: null }),
  });
  const claimed = claim.ok ? await claim.json() : [];
  if (!claimed.length) return json({ error: 'email_already_processing' }, 409);

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token' }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) throw new Error('google_oauth_failed');

    const boundary = `oneform_${crypto.randomUUID().replaceAll('-', '')}`;
    const subject = `Generali OneForm | ${reference} | ${app.form_type}`;
    const agent = Array.isArray(app.profiles) ? app.profiles[0] : app.profiles;
    const textBody = [
      'Permohonan baharu diterima melalui Generali OneForm.',
      '', `Rujukan: ${reference}`, `Jenis borang: ${app.form_type}`,
      `Ejen: ${agent?.full_name ?? '-'} (${agent?.email ?? '-'})`,
      '', 'Lampiran utama: PDF permohonan.', 'Dokumen sokongan dilampirkan sebagai fail berasingan.',
    ].join('\r\n');
    const parts = [
      `From: ${cleanHeader(MAILBOX)}`,
      `To: ${cleanHeader(HQ_EMAIL)}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '', `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: 8bit', '', textBody,
      `--${boundary}`, 'Content-Type: application/pdf; name="' + reference + '.pdf"', 'Content-Transfer-Encoding: base64', 'Content-Disposition: attachment; filename="' + reference + '.pdf"', '', wrap64(pdf),
    ];
    for (const f of safeFiles) parts.push(`--${boundary}`, `Content-Type: ${f.type}; name="${f.name}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${f.name}"`, '', wrap64(f.data));
    parts.push(`--${boundary}--`, '');
    const raw = b64url(parts.join('\r\n'));
    const send = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', headers: { Authorization: `Bearer ${tokenJson.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    const sendJson = await send.json();
    if (!send.ok) throw new Error(`gmail_send_failed_${send.status}`);

    await fetch(`${base}/rest/v1/applications?id=eq.${app.id}`, {
      method: 'PATCH', headers: restHeaders,
      body: JSON.stringify({ hq_email_status: 'sent', hq_email_sent_at: new Date().toISOString(), hq_email_error: null }),
    });
    return json({ ok: true, message_id: sendJson.id ?? null });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'email_failed';
    await fetch(`${base}/rest/v1/applications?id=eq.${app.id}`, {
      method: 'PATCH', headers: restHeaders,
      body: JSON.stringify({ hq_email_status: 'failed', hq_email_error: reason.slice(0, 240) }),
    });
    return json({ error: 'email_delivery_failed', detail: reason }, 502);
  }
});

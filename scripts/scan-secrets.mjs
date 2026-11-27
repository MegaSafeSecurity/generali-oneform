// Imbas fail yang dijejaki Git untuk rahsia. Gagal (exit 1) jika jumpa.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
const bad = [];
for (const f of files) {
  if (f === 'scripts/scan-secrets.mjs' || /\.(png|pdf|ico|woff2?)$/i.test(f)) continue;
  if (/^\.env(\..*)?$/.test(f) && f !== '.env.example') bad.push(`${f}: fail .env dijejaki Git`);
  let t; try { t = readFileSync(f, 'utf8'); } catch { continue; }
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t)) bad.push(`${f}: private key`);
  if (/sb_secret_[A-Za-z0-9_-]{20,}/.test(t)) bad.push(`${f}: Supabase secret key`);
  if (/AKIA[0-9A-Z]{16}/.test(t)) bad.push(`${f}: AWS key`);
  if (/GOCSPX-[A-Za-z0-9_-]{20,}/.test(t)) bad.push(`${f}: Google OAuth client secret`);
  for (const m of t.matchAll(/eyJ[\w-]{10,}\.(eyJ[\w-]{10,})\.[\w-]{10,}/g)) {
    try { if (JSON.parse(Buffer.from(m[1], 'base64url').toString()).role === 'service_role') bad.push(`${f}: JWT service_role`); } catch { /* abaikan */ }
  }
}
if (bad.length) { console.error('RAHSIA DIJUMPAI:\n - ' + bad.join('\n - ')); process.exit(1); }
console.log(`Imbasan rahsia OK (${files.length} fail)`);

// public/ -> dist/ ; src/main.ts (+pdf-lib) -> dist/app.js. Kunci Supabase disuntik dari persekitaran, tidak pernah disimpan dalam repo.
import { build } from 'esbuild';
import { cpSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) for (const l of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
let url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
let key = (process.env.SUPABASE_ANON_KEY || '').trim();
const die = (msg) => { console.error('\nBUILD GAGAL: ' + msg + '\n'); process.exit(1); };
if (!url || !key) {
  if (process.env.CI_PLACEHOLDER === '1') { url = 'https://placeholder.supabase.co'; key = 'placeholder'; }
  else die('SUPABASE_URL dan SUPABASE_ANON_KEY belum ditetapkan (Render > Environment, atau fail .env tempatan).');
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && !/^http:\/\/localhost:\d+$/.test(url)) die('SUPABASE_URL tidak sah: ' + url);
let role = null; try { role = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role; } catch { /* bukan JWT */ }
if (role === 'service_role' || key.startsWith('sb_secret_')) die('Itu kunci RAHSIA (service_role). Jangan letak dalam frontend - guna anon/publishable key sahaja.');

rmSync('dist', { recursive: true, force: true });
cpSync('public', 'dist', { recursive: true });
await build({
  entryPoints: ['src/main.ts'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/app.js', legalComments: 'none',
  define: { __SUPABASE_URL__: JSON.stringify(url), __SUPABASE_ANON_KEY__: JSON.stringify(key) },
});
const html = readFileSync('dist/index.html', 'utf8').replaceAll('%%SUPABASE_ORIGIN%%', new URL(url).origin);
writeFileSync('dist/index.html', html);
writeFileSync('dist/404.html', html);
console.log('dist/ siap ->', new URL(url).origin);

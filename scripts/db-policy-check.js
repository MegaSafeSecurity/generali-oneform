// Static audit of "the database has access rules": RLS everywhere, default-deny writes, no anon access, safe definer functions,
// and the API reads user data through an RLS-enforced (user-JWT) client, not the RLS-bypassing secret key.
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.join(__dirname, '..'), MIG = path.join(ROOT, 'supabase', 'migrations');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const sql = fs.readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort().map((f) => fs.readFileSync(path.join(MIG, f), 'utf8')).join('\n').replace(/--.*$/gm, '').toLowerCase();
const tables = [...sql.matchAll(/create table (?:if not exists )?public\.(\w+)/g)].map((m) => m[1]);
ok(tables.length >= 8, `found ${tables.length} public tables: ${tables.join(', ')}`);
for (const t of tables) ok(new RegExp(`alter table public\\.${t} enable row level security`).test(sql), `RLS enabled on public.${t}`);
const revoke = (sql.match(/revoke all on [^;]*from anon, authenticated;/g) || []).join(' ');
for (const t of tables) ok(revoke.includes(`public.${t}`), `public.${t}: all anon/authenticated privileges revoked (default deny)`);
const grants = [...sql.matchAll(/grant ([^;]*?) on ([^;]*?) to ([^;]*);/g)].filter((m) => /public\./.test(m[2]));
ok(grants.every((g) => /^select$/.test(g[1].trim()) && !/anon/.test(g[3])), 'only SELECT is granted on tables, and never to anon');
const policies = [...sql.matchAll(/create policy (\w+) on ([\w.]+)\s+(?:as \w+\s+)?for (\w+) to ([\w, ]+?)\s+(?:using|with)/g)];
ok(policies.length >= 6, `${policies.length} policies defined`);
ok(policies.every((p) => p[3] === 'select' || /deny_all/.test(p[1])), 'every real policy is read-only (writes only via the server API)');
ok(!/(using|with check)\s*\(\s*true\s*\)/.test(sql), 'no permissive "using (true)" policies');
ok(policies.filter((p) => /anon/.test(p[4])).every((p) => /deny_all/.test(p[1])), 'anon has no policy except explicit deny-all');
for (const t of ['guest_links', 'email_outbox']) ok(new RegExp(`create policy ${t}_deny_all on public\\.${t}`).test(sql), `server-only table public.${t} has an explicit deny-all policy`);
const defs = [...sql.matchAll(/create (?:or replace )?function ([\w.]+)[\s\S]*?\$\$;/g)].filter((m) => /security definer/.test(m[0]));
ok(defs.length > 0 && defs.every((m) => /set search_path\s*=\s*''/.test(m[0])), 'every SECURITY DEFINER function pins search_path');
ok(/insert into storage\.buckets[\s\S]*'private-application-files'[\s\S]*false/.test(sql), 'private storage bucket is created with public = false');
ok(!/create policy [^;]*on storage\.objects/.test(sql), 'no storage.objects policy: files are reachable only via server-issued signed URLs');
ok(/alter default privileges in schema public revoke all on tables from anon, authenticated/.test(sql), 'future public tables are not auto-exposed to anon/authenticated');
// Store code: RLS must actually be in force on user-facing reads.
const store = fs.readFileSync(path.join(ROOT, 'src', 'store', 'supabase.js'), 'utf8');
ok(/const userDb = \(jwt\)/.test(store) && /SUPABASE_PUBLISHABLE_KEY[^;]*global: \{ headers: \{ Authorization/.test(store), 'store has a user-scoped client (publishable key + caller JWT)');
const list = store.slice(store.indexOf('async listApplications'), store.indexOf('async createApplication'));
ok(/userDb\(jwt\)\.from\('applications'\)/.test(list) && !/admin\.from\('applications'\)/.test(list), 'listApplications reads through the RLS-enforced client');
console.log(fail ? `\n${fail} FAILED` : '\nall database-rule checks passed'); process.exit(fail ? 1 : 0);

# Security model: secrets on the server, rules in the database

## 1. Secrets never reach the browser
| Value | Lives in | Used by | Reaches `public/`? |
|---|---|---|---|
| `SUPABASE_SECRET_KEY` (bypasses RLS) | server `.env` / host secret manager | `src/store/supabase.js` only: JWT verification, writes, server-only tables | No |
| `SUPABASE_PUBLISHABLE_KEY` | server `.env` | `src/store/supabase.js` `userDb(jwt)`: reads on behalf of a user so RLS applies | No (never needed by the current UI) |
| `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_OAUTH_STATE_SECRET` | server `.env` / secret manager | `src/services/gmail.js` | No |
| Guest-link token | URL fragment of the customer link | Only its SHA-256 hash is stored server side | n/a |

The static file server only serves `public/`. `.env`, `src/`, `supabase/`, `docs/`, `scripts/`, `package.json` return 404.
CSP is `script-src 'self'` (no inline or third-party script). `.env` and `.env.*` are git-ignored; `.env.example` holds empty values.
Agent sessions are httpOnly + SameSite=Strict cookies (JavaScript cannot read them); writes need an `X-Requested-With` header (CSRF); login is throttled per IP and per account. Customer links are one-time, expire in 7 days, and live in the URL fragment (`#t=`), which browsers never send to servers or referrers.
Verified by `npm run security` (scans `public/` for key/JWT/private-key patterns and probes 14 sensitive URLs over HTTP).

## 2. The database enforces access rules (Supabase, migrations 002 + 003)
- Row Level Security enabled on all 8 public tables; all anon/authenticated privileges revoked, then only `SELECT` granted back.
- Read policies: an agent sees only rows where `agent_id = auth.uid()`; admins (via `private.is_admin()`, `SECURITY DEFINER`, `search_path=''`) see all.
- No INSERT/UPDATE/DELETE policy exists: browsers cannot write. Writes happen only in the trusted API after authorization checks.
- `guest_links` and `email_outbox` are server-only (explicit deny-all policies).
- Storage bucket `private-application-files` is private, 20 MB cap, PDF/PNG/JPEG only, with no `storage.objects` policies (files are reached only through short-lived signed URLs issued by the API).
- Future tables/functions are not auto-exposed to `anon`/`authenticated` (default privileges revoked).
- **RLS is only enforced for clients that carry the user's JWT.** The secret key bypasses RLS, so the store reads user data with `userDb(jwt)` (publishable key + caller JWT). Earlier code read with the secret key while claiming RLS applied; that is fixed.

## 3. What was verified, and what was not
Verified in the build sandbox: `npm run verify` = syntax checks, 21 HTTP smoke tests, security probes, static SQL policy audit (with mutation tests proving the checks fail on regressions), and 26 end-to-end API checks and 6 Supabase-store checks that run the real code against a stubbed `@supabase/supabase-js`.
**Not verified (needs your environment):** the SQL itself on a real Postgres (run `supabase/tests/rls_staging_test.sql` on staging); `npm install` and live Supabase/Gmail calls; HTTPS, backups, PDPA review, penetration test (see DEPLOYMENT-CHECKLIST).

# Prototype QA results

Date: 2026-11-23

## Passed in this environment
- `node --check server.js`
- `node --check public/app.js`
- Node built-in HTTP server starts on port 3000.
- `GET /` serves the portal HTML.
- `POST /api/guest-links` creates a random 256-bit guest token and returns a seven-day link.
- Original PDF template download routes are wired.
- Client-side app includes language toggle, form steps, repeatable GPA insured-person rows, signature canvas/upload, company stamp upload, review and demo submission.

## Not tested / not production-ready
- Third-party browser/device compatibility and accessibility audit.
- Full end-to-end upload and submission on multiple browsers.
- Persistent storage, real database, agent/admin authentication and agent assignment.
- Exact field coordinate overlay and completed official PDF rendering.
- PDF output comparison/print QA; final official PDF generation is intentionally not enabled.
- External security assessment, penetration testing and PDPA/legal review.

## Interpretation
The package is a runnable prototype. It is not evidence of a secure production deployment. Demo data is volatile in-memory data; the public demo admin listing endpoint is unauthenticated and must be removed or protected before any public deployment.

## v0.3 upgrade verification (2026-11-24, sandbox)
Passed: `npm run check` (syntax, all server + client files); `npm test` (21 checks: static files, CSP header, path traversal, all 3 PDF template downloads return `%PDF`, guest link create/validate, wrong-form/bad-image/array-payload rejection, single-use link -> 409, demo-admin disabled by default).
Headless Chromium (WebGL via SwiftShader): zero console/page errors; navbar renders in WebGL mode; nav switching PI/PL/Biz PA/Home; required-field and date-order validation block progress; drafts restored when switching forms; GPA totals (1000 -> 80 tax -> 1090 with 10 stamp duty); grouped review summary; guest-link flow incl. wrong-form toast; no horizontal overflow at 390px and 768px.
**Not verified here:** `npm install` + `npm run start:api` (no network in the sandbox, so Express/Supabase/Googleapis paths were syntax-checked only); SQL migration 002 (no Postgres); Safari/Firefox; real devices; real Gmail/Supabase credentials; PDF overlay (still not implemented, see PDF-FIELD-MAPPING-REGISTER.md).

## v0.4 (phase 1: agent login + Supabase persistence), sandbox verification
`npm run verify`: syntax checks; 26 API checks (login/refresh/logout, CSRF, httpOnly cookies, create application, one-time link, submit validation, 401 after use, brute-force 429, production refuses demo mode); security scan; DB-policy audit; 6 Supabase-store checks against a stubbed SDK (publishable key + JWT for reads, hashed link tokens, optimistic claim, private bucket).
Headless Chromium full flow: agent login -> nav preselects form -> create link -> session survives reload -> customer opens link, auto-fills all steps, signs, submits -> agent list shows "Diterima" -> reused link rejected -> logout.
**Not verified here:** real Supabase (Auth, PostgREST, Storage, RLS), Render deployment, Safari/Firefox, real devices. Run `docs/GO-LIVE.md` section C on staging.

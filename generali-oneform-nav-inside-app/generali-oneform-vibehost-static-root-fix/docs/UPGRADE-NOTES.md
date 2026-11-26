# v0.3 upgrade notes

## Fixed
- `npm start` started the API only (no UI) and crashed without Supabase env. Now `npm start` = UI + demo API; `npm run start:api` = Supabase/Gmail API. README/launchers corrected; separate ports (`PORT` 3000 / `API_PORT` 3100).
- `/api/demo-admin/applications` was public: now 404 unless `DEMO_ADMIN=1` and caller is localhost. Server binds to 127.0.0.1 by default.
- Guest links were reusable indefinitely: a second submit now returns 409. Payload shape validated; expired sessions/rate-limit buckets are pruned.
- API: `timingSafeEqual` threw (HTTP 500) on a tampered OAuth state of different length; malformed JSON now 400; friendly error for missing env.
- Migrations: `001` conflicted with `002`; moved to `supabase/legacy/`.
- Service worker was cache-first for everything (users stuck on old versions after an upgrade): now network-first for the shell, never caches `/api` or PDFs.
- Fonts: CSS referenced DM Sans/Manrope but never loaded them, and shorthands without fallback rendered buttons/inputs in the browser default serif. Now a system sans + serif stack (no external font requests; CSP-safe).
- Form: required fields/consent checkboxes were never enforced (buttons were `type=button`); date ranges unchecked; labels not linked to inputs; Review showed raw keys (`firm`, `reg`); language toggle did not relabel the Next button; Submit could be double-clicked; Start again left signature/stamp in memory; mobile layout overflowed horizontally; "Kembali" sat on the same line as the eyebrow.
- Added: per-form in-memory drafts (switch forms without losing data), GPA premium/8% tax/payable calculation, remove-row for insured persons, grouped review, `prefers-reduced-motion`, skip link, aria-live toast.

## Added
- Transparent Generali logo (`public/assets/generali-logo.png`, `@2x`, `generali-mark.png`, PWA icons, favicon) extracted from the supplied image; shown in header, portal hero, form panel, review and done screens.
- Liquid Navbar "Waterline": Option A (native vanilla port). Items: Utama, Biz PA, Public Liability, PI Security Guards. Desktop = sticky pill under the header; <=860px = icon-only floating dock. WebGL shader with CSS-drop fallback.

## Known limits
- Logo/branding use needs Generali authorization (see DEPLOYMENT-CHECKLIST).
- PDF field overlay is still not implemented; the app downloads the blank official templates only.

# Generali OneForm — PI / PL / Biz PA (GPA workflow)

A downloadable **development prototype** based on the three blank Generali PDFs supplied in `Borang Kosong Generali.zip`.

## Important status — read before using

This package is a working UI/API prototype, **not a production insurance application** and not an official Generali portal. It currently supports:

- Responsive web/PWA shell and BM/English UI toggle.
- PI, PL and Biz PA form-step data capture (the source form calls the third product **BIZ PA PROPOSAL FORM / BORANG CADANGAN BIZ PA**; do not relabel it as a different official product without Generali confirmation).
- Guest-link creation with 256-bit random token, SHA-256 token hash on server, 7-day expiry and revocation-ready session structure.
- Drawn or uploaded applicant signature; PNG/JPG company-stamp upload.
- Original blank PDFs available for download.
- Demo submission reference number.

It does **not** yet provide persistent database storage, production-grade admin authentication, agent assignment, email/SMS delivery, malware scanning, exact PDF field overlays, verified electronic-signature evidence, or live Generali submission. Uploaded signature/stamp files and submissions are memory-only and disappear when the server restarts. Do not use real customer personal/medical/financial data in this demo.

## Source PDFs included

Copied from the user's `Borang Kosong Generali.zip` (blank templates only; filled company example PDFs are deliberately excluded):

- `public/templates/PI-Security-Guards-02-2025.pdf` — 6 A4 pages.
- `public/templates/Public-Liability-02-2025.pdf` — 5 A4 pages.
- `public/templates/Biz-PA-Proposal-12-2025.pdf` — 7 A4 pages.

The filled example ZIP is treated only as reference and is not redistributed in this project.

## Run locally

Requirements: Node.js 20 or later. No third-party npm packages are required for this demo.

```bash
npm start          # local dev: in-memory data, prints a demo agent login
npm run verify     # syntax + 26 API tests + security scan + DB-rule audit + store tests
```

Open `http://localhost:3000` and sign in with the credentials printed in the terminal. Data is lost on restart in this mode.

**Go live (free tier):** follow `docs/GO-LIVE.md` (Supabase + Render). With `SUPABASE_*` set the same `npm start` stores everything in Supabase; with `NODE_ENV=production` it refuses to run without them.

The homepage includes a **Create customer link (Demo)** action. Choose PI, PL or GPA; copy the generated URL and open it in a separate browser/incognito window to test the guest flow. Links expire after seven days. Demo records are kept only in server memory.

## Current form scope

- PI: General Data; Company Profile & Controls; Activities & Risk Details; Claims, Declaration & Signature.
- PL: Proposer Details; Risk & Premises; Limit, Declaration & Stamp.
- Biz PA: Proposer & Contact Details; Declaration & Payment; Persons to be Insured table.

The UI fields are a first-pass digital collection inventory based on text extracted from the blank PDFs. The PDFs are flattened (no AcroForm fields were detected). Therefore the current prototype **does not claim 100% coordinate mapping** and deliberately does not output a falsely completed official PDF.

## Required work before official PDF output

1. Visual QA every source page at print resolution.
2. Create a coordinate map for every text field, checkbox, date, signature and stamp, using A4 page points (595.28 × 841.89 pt) and a consistent top-left to PDF bottom-left coordinate transform.
3. Verify long text wrapping, tickbox alignment, font size, field overflow, multi-page continuation and GPA repeat rows.
4. Have the agent/Generali confirm acceptable signature, stamp, privacy-consent and submission workflow.
5. Compare generated PDFs page-by-page against blank originals and obtain sign-off. Until then, only download the blank source template from this app.

See `docs/PDF-FIELD-MAPPING-REGISTER.md` and `docs/SOURCE-FORM-INVENTORY.md`.

## Production architecture target

- Next.js/Node backend or equivalent server-only API layer.
- PostgreSQL with RLS policies for customer ownership and explicitly assigned agent access.
- Guest-link tokens stored only as hashes; random, one-time or revocable, short expiry, optional OTP challenge for high-risk applications.
- Private object storage, short-lived signed URLs, file signature validation and malware scanning.
- Secrets in hosting secret manager; never in browser bundles, source maps, public environment variables or Git.
- MFA for agents/admins; least-privilege roles; audit events; backup encryption; retention/deletion policy.
- PDPA Malaysia assessment, Generali agent authorization, brand approval and confirmation of insurer's approved submission process.

## Security caveats

The demo uses in-memory maps and no real identity provider. The demo-admin endpoint is intentionally unauthenticated and must be removed before production. Do not expose this demo publicly with live customer information. Do not treat the browser's validation as authorization; repeat all validation and permission checks on the server in production.

## Files

- `server.js` — dependency-free UI server + in-memory demo API (`npm start`).
- `src/` — Express + Supabase + Gmail API foundation (`npm run start:api`).
- `public/liquid-nav.js` — vanilla port of the Liquid Navbar "Waterline" (WebGL water shader); its CSS (`.nimbus-*`) is in `styles.css`.
- `public/index.html`, `public/styles.css`, `public/app.js` — responsive portal and form flow.
- `public/sw.js`, `public/manifest.webmanifest` — basic PWA shell.
- `supabase/migrations/` — production database starting point; review and test before deployment.


## Google + database integration foundation

See `docs/GOOGLE-SUPABASE-INTEGRATION.md` and migration `supabase/migrations/002_agent_portal_google_email.sql`. The new API scaffold is under `src/`. It is not production-ready until the documented secrets, persistent OAuth state, access checks, storage, email worker, PDF mapping and security tests are completed.


### Start the new API scaffold on Windows

Copy `.env.example` to `.env`, configure server-only values, then run `start-api-windows.bat` (`npm run start:api`, port 3100). `start-windows.bat` starts the portal UI + demo on port 3000 and opens the browser; it is not the production API and does not connect to the new database or Gmail integration.

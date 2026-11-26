# Generali OneForm — Updated VibeHost Build Brief (Two Separate Websites)

**Workspace target:** https://app.vibehost.com/workspace/tera-kinabalu  
**Source:** Continue from the uploaded `generali-oneform-production.zip`. Preserve its code, assets, official PDF templates, database migrations and current features. This brief supersedes older assumptions about a single portal/homepage. The owner cannot grant the AI access to private accounts or secrets by sharing a workspace URL alone; use the workspace's authenticated AI builder and its supported integrations.

## Business architecture — two different websites
Build two distinct websites/frontends with their own branding/navigation, while sharing one secure backend, database, PDF service, and document storage. Separate hostnames/domains are preferred if VibeHost supports custom domains; otherwise distinct public/internal app URLs/routes with separate access policies are acceptable. Do not expose the staff portal from the public customer site.

### Website A — Staff Portal (HQ + Agent, same site and same UI)
- HQ and Agent use one website, one login page, one dashboard application, same navigation shell. Only role/capability and display name differ after login; do not create separate HQ and Agent websites.
- Sign up / sign in through **Google OAuth only** (verified Google identity/email; no app-local password). Use Supabase Auth Google provider or supported secure OAuth. Sign-up creates a pending account/profile; HQ must activate/assign Agent role. No self-assigned HQ/admin roles.
- Prevent duplicate users: use the immutable Google provider `sub` as identity key and unique constraint; also normalize verified email and enforce uniqueness where policy permits. Existing user signs in with same Google identity and is linked to the existing profile, never creates a second profile. Do not merge accounts based only on an unverified or user-entered email. Handle email change through verified identity and controlled account update.
- Owner is HQ and may also perform Agent tasks (HQ has agent capabilities). Bootstrap HQ only using an owner-controlled server-side allowlist/secure setup step, log it, then disable/remove bootstrap path. Never infer admin based on frontend email text.
- Roles/capabilities: Agent (own/assigned submissions and customer cases), HQ (all records, assignment, review, corrections, approval, download/print, submission, agent management), owner/HQ can act as Agent. Every authorization decision on server.
- Dashboard cards and list: request count, total customers, new/unreviewed, awaiting customer details, quote requests, renewal requests, add/change-cover requests, reviewed, completed. Filter/search by reference, customer, product, request category, Agent, date, status.
- Create secure customer application link; choose PI Security Guards, PL, GPA (Biz PA/GPA template as existing source supports). Copy/share link, expiry, revoke/reissue, track form completion. Links should be tokenized, high-entropy, one-use for initial submit, time-limited, stored as token hashes.
- Review customer requests: read details, edit/correct incomplete entries, track version and who edited, add internal notes, request customer correction if needed, HQ/Agent can complete missing fields only based on verified customer instructions, and record source of edits. Never fabricate customer declarations, signatures, or consent. Reprint/download PDFs. HQ may approve and initiate authorized official submission workflow.
- Customer requests can be: new quote, renewal, change/add insurance or coverage, other. Store type and context. Customers are told they will wait for staff feedback; document collection/send is only requested when HQ/Agent asks. Do not promise automatic quotation, policy issuance, or insurer response.
- Staff document inbox: only documents provided by customer or requested later, private storage; authorized download/print; audit actions. PDFs generated from original templates.
- Staff UI should be professional, responsive desktop/mobile, BM/English-ready, clean; no fake data, sample customer names, fake references, fake counts, fake sent/approved statuses, or demo/mock mode visible. Empty states should be real and instructive.

### Website B — Customer Request/Form Website (public, no account)
- Separate public-facing customer website, separate from Staff Portal. Customer never needs to sign in or sign up. Public site must not contain staff portal navigation or dashboard, and must not expose private API, staff pages, record search, or other customers' data.
- Main landing page clearly offers only three official application form paths: **PI Security Guards**, **Public Liability (PL)**, and **GPA / Biz PA** (match actual original template naming). Use links assigned by staff; if direct entry is allowed, customer chooses form type.
- The customer form is a guided responsive form. Capture information exactly needed by the relevant original PDF and business request; use original source form wording/field requirements wherever available. Keep BM/English labels as appropriate. Include data/privacy notice, consent, customer declarations, contact info, secure supporting-document upload only where required/asked, and customer signature only for fields/declarations that actually require it.
- Customer can submit one request/application without account. After submit show genuine reference number and message: “Your request has been received. Our HQ/Agent team will review it and contact you for feedback or additional documents if required.” No fake quote/approval/policy confirmation.
- Request categories: new quotation, renewal, additional insurance/coverage amendment, and other. For renewal/additional coverage, collect existing policy details and the change/renewal details if relevant.
- Customer may be asked later to provide supporting documents via an expiring, application-scoped secure upload link (no account); this link cannot expose staff tools or other applications. The customer should not be required to send documents unless requested by staff. Do not claim email delivery or receipt unless verified by server/provider response.
- Public forms submit into shared secure backend and appear in staff portal inbox. Public form only has application-scoped permissions. Strict anti-spam/rate limits/CAPTCHA or abuse controls as available; file size/type/magic-byte validation, private quarantine/storage, safe filenames.
- Customer website should not show “test”, “demo”, “prototype”, “QA”, or fake/sample content. These terms can remain in internal developer docs/tests; automated checks are not to be removed or bypassed.

## Official PDF requirements (Phase 2)
Use the original PDF templates included in the source ZIP, not a recreated/redesigned version:
- PI Security Guards original: 6 pages
- Public Liability original: 5 pages
- Biz PA / GPA original: 7 pages
Total 18 pages.
Implement complete page-by-page mapping of all text fields, checkboxes, dates, repeated rows/tables, declarations, signature/stamp as required. Use overlay on original PDF, preserving page size, layout, wording, logos, boxes and pagination. Version maps per template revision. Do not claim 100% exactness until visually calibrated and compared to original for all pages at print resolution; retain internal validation but remove QA/test branding from customer-facing UI.

## Submission workflow (Phase 3)
- Request received -> staff review -> request more info if necessary -> staff correction with audit history -> HQ approval -> PDF generation -> preview -> server-authorized submission to HQ mailbox -> outbox state -> provider result -> HQ acknowledgement and reference (record separately).
- HQ/Agent can review, edit incomplete data (with provenance/audit log), download/print, and generate PDFs. Signature/consent must be customer-supplied; staff cannot forge it or complete customer declaration as if signed.
- Server email provider (Gmail API/OAuth or approved provider) only. HQ recipient address is server-side allow-listed; never accept recipient from browser or customer. No auto-send before authorized approval and final preview/confirmation. Persist submission/outbox, idempotency key, retry/backoff, failure and acknowledgement separately. Do not claim delivery from API acceptance alone.

## Persistent database / storage
- Supabase Postgres migrations and Auth; private storage buckets for supporting docs and generated PDFs. Persist user profiles, Google identity, role/status, applications, request type, form answers, application/form versions, customer-link token hashes, files, review/approval/edit events, PDF versions/checksums, submission/outbox, acknowledgement, audit logs.
- RLS + server authorization; Agents only own/assigned records; HQ/admin only via explicit capability. Public application token is scoped to one application and only allowed public operations. No in-memory store or localStorage for production business records. Production fail-closed if database/auth/storage configuration is missing.
- Data retention/backup and PDPA privacy/consent policy; minimize sensitive collection, secure file deletion policy, backup/restore instructions.

## Secrets / hardening
- Never place Supabase service-role/private keys, DB credentials, Google OAuth client secret, refresh tokens, email API credentials, private signing keys, storage secret, or server tokens in frontend source, HTML, browser bundle, public env vars, source maps, Git, localStorage, browser-visible request payloads, logs, or Inspect.
- Keep secrets in VibeHost server secret/environment manager (or approved server-side secret store). Use only server-side routes/actions. Public OAuth client ID is not secret and may appear where OAuth protocol requires.
- HTTPS; secure HttpOnly SameSite cookies; CSRF defense; OAuth state/nonce/PKCE; strict redirect URI allowlist; CSP, HSTS, clickjacking protections, rate limits, input validation/output encoding, safe errors, request IDs, audit logging, strict CORS; prevent IDOR, privilege escalation, token replay/leak, XSS, CSRF, SQL injection, SSRF, upload abuse, open redirects and arbitrary recipient/path requests.
- Private workspace/project deployment. Do not publish the staff portal publicly or grant broad access. Public customer site only exposes customer form endpoints, never staff endpoints/data.

## VibeHost implementation instructions
1. Inspect workspace runtime and supported backend/auth/database/deploy features; verify the uploaded source archive was ingested correctly. Do not pretend you can inspect or deploy if you cannot.
2. Implement both separate frontends with shared backend, database and services; preserve existing Express server and files unless a compatibility migration is necessary. If runtime cannot support Express, migrate carefully to supported full-stack framework, preserve PDFs/assets/data/schema, and document migration.
3. Use real Supabase project and Google OAuth connection, not fake/mock login. If credentials or owner consent are missing, create a precise setup checklist and stop only at that required owner action. Do not fabricate secrets or integrations.
4. Add database migrations, unique identity constraints, RLS, server routes, secure customer link tokens, review/correction workflow, PDF mapping/generator, email outbox and UI.
5. Implement and run internal automated build/lint/security/migration/flow checks; fix failures. Keep test/QA tools internal and never present test status as customer-visible content. Do not remove or bypass checks to make the build green. Never claim verified/live/production unless confirmed by actual tool/runtime results.
6. Back up before migrations; provide rollback. Preserve production records. Do not use destructive reset, seed fake customer records into production, or overwrite existing data.
7. Keep production staff app private. Customer site may be publicly reachable only with its application-scoped public routes; no staff sign-in page/dashboard links exposed from customer surface.

## Definition of completion and handover
- Two independent websites/surfaces: Customer Forms and Staff Portal (HQ+Agent same site).
- Google sign-up/sign-in with duplicate-account prevention and verified identity; HQ bootstrap secured; role approval.
- Persistent DB/storage, RLS, private files, customer secure links.
- All PI/PL/GPA form requirements and original PDF mapping across 18 pages visually calibrated and versioned.
- Customer submits request and gets truthful receipt; staff can count customers/requests, review, correct with audit trail, download/print, request documents, approve, submit through server email and track acknowledgement.
- Secrets are server-side only, with security scan of frontend bundle and browser requests for secret leakage.
- Private staff deployment, public customer site configured safely, real URLs, backup/rollback and owner setup steps.
- Handover clearly distinguishes what was actually implemented and verified, what is blocked by owner credentials/OAuth/provider configuration, and what remains. Never mark unverified work as complete just to satisfy request.

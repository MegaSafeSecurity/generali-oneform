# Generali OneForm — QA / production release checklist

## Implemented in the Supabase repair branch (not yet live-verified)
- [x] Supabase email/password sign-in and signup client flow
- [x] Google OAuth redirect client flow
- [x] Password recovery request
- [x] Pending-agent approval screen
- [x] Role-aware application list (RLS is expected to filter rows)
- [x] Signup trigger creates inactive agent profile; public signup cannot select HQ role
- [x] Draft-only application insert/update guards and protected-field trigger
- [x] Private Storage bucket and owner/HQ policy baseline
- [x] Original interface, logo, CSS and PDF templates retained

## Must be completed before production
- [ ] Add public anon/publishable key to config.js and test approved domains
- [ ] Run both database migrations in a non-production Supabase project; inspect SQL errors
- [ ] Provision HQ role through a trusted admin-only process
- [ ] Run all tests in SECURITY-TESTS.md with two agents and one HQ account
- [ ] Add MFA, session refresh/expiry policy, rate limits and audit logging
- [ ] Implement secure customer-link issuance, hash-at-rest, expiry and one-time use
- [ ] Implement customer form and server-side submission workflow
- [ ] Map every PI/PL/Biz PA field to the original 18 PDF pages and obtain business-owner signoff
- [ ] Generate final PDFs and verify each field/checkbox/signature/stamp placement
- [ ] Implement private uploads, signed downloads, MIME/size checks and malware scanning
- [ ] Implement Gmail API sender with server-only OAuth secrets, attachments, retry and idempotency
- [ ] Confirm one shared mailbox routing without sharing user credentials
- [ ] Test e-mail delivery to the approved mailbox with non-production data
- [ ] Run browser/mobile/accessibility/load tests and backup/restore test
- [ ] Obtain Generali business owner, privacy and security approval
- [ ] Deploy only after all release gates pass

# Deployment checklist — do not launch publicly until complete

- [ ] Confirm Generali agent authorization to use the supplied logo, forms, and branded portal. (The logo is now prominent in header, portal, form, review and done screens; this approval is required before public launch.)
- [ ] Confirm with Generali whether digital signature, uploaded signature, uploaded company stamp, and online submission are acceptable.
- [ ] Confirm exact official name/meaning of the Biz PA workflow before labelling it GPA to customers.
- [ ] Finish all page-by-page PDF coordinates; verify all 18 pages (PI 6 + PL 5 + Biz PA 7).
- [ ] Verify the PI stamp placement: page 1 instructions require stamp/sign/date, while page 4 contains proposer signature/date and no separately labelled stamp box in the blank template. Obtain written guidance on acceptable placement.
- [ ] Build production database and test RLS using customer A, customer B, assigned agent, unassigned agent and admin test identities.
- [ ] Move guest-link token storage to persistent DB as hash only; use expiry, revocation, one-time/limited-use semantics and optional OTP verification.
- [x] The demo-admin listing endpoint was removed in v0.4. Agent endpoints require a signed-in agent; customers can only use their own one-time link.
- [ ] Move signature/stamp and PDF objects to private storage; add MIME sniffing, image decoding, malware scanning, size limits and signed URLs.
- [ ] Add encryption at rest, key rotation, backup/restore tests, retention/deletion rules and audit logs.
- [ ] Complete PDPA review, privacy notice, data-processing agreements and incident response plan.
- [ ] Run SAST/dependency scanning, penetration testing, rate-limit testing and accessibility/performance testing.
- [ ] Verify PDF content and page geometry at 100% print scale; obtain agent/insurer sign-off.
- [ ] Configure domain, HTTPS, secret manager, monitoring, backups and production deployment.

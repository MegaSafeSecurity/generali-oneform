# QA checklist before production

- [ ] Restore/implement full original `app.js` workflow
- [ ] Field-by-field PI/PL/Biz PA PDF mapping verified against all source pages
- [ ] Agent signup approval and HQ role provisioning
- [ ] MFA and session expiry
- [ ] Customer secure link: random token, hashed at rest, expiry and one-time use
- [ ] Agent row isolation tested with two accounts
- [ ] HQ all-record access tested
- [ ] Private Storage policies and signed URLs tested
- [ ] PDF generated, downloaded, and archived correctly
- [ ] Supporting files attached separately to HQ email
- [ ] Gmail OAuth refresh/retry/idempotency and delivery status tested
- [ ] CSP production origin configured; no unsafe wildcard CORS
- [ ] Rate limits, file scanning, audit logs, backups and retention policy
- [ ] Accessibility, mobile, browser and load tests
- [ ] Security review and business owner approval

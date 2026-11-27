# Generali OneForm — security test plan

Run only in a non-production Supabase project with synthetic users and data.

## Test identities
- Agent A: active profile, role=agent
- Agent B: active profile, role=agent
- Pending Agent: inactive profile, role=agent
- HQ: active profile, role=hq_admin

## Database / RLS tests
- [ ] Anonymous request cannot read profiles, applications, application_files or customer_links.
- [ ] Agent A can read only applications where agent_id = Agent A.
- [ ] Agent B cannot read Agent A's application, even when UUID is known.
- [ ] Pending Agent cannot insert an application.
- [ ] Agent cannot insert an application with status=submitted, email_status=sent, pdf_storage_path set, or submitted_at set.
- [ ] Agent can create only an owned draft.
- [ ] Agent cannot change agent_id, reference_no, form_type, status, pdf_storage_path, email_status or submitted_at.
- [ ] Agent cannot update an application after it is submitted.
- [ ] Agent A cannot read or modify Agent B's file objects.
- [ ] Agent cannot access customer_links token_hash through PostgREST.
- [ ] HQ can read all application rows but only trusted provisioning can assign hq_admin.
- [ ] service_role operations are used only inside trusted Edge Functions.

## Storage tests
- [ ] Bucket generali-private is not public.
- [ ] Anonymous download fails.
- [ ] Agent A upload to folder Agent A UUID succeeds only when active.
- [ ] Agent A upload to folder Agent B UUID fails.
- [ ] Agent A cannot read Agent B object.
- [ ] File size and MIME restrictions are enforced; separately scan untrusted uploads before production.

## Auth tests
- [ ] Signup creates inactive agent profile only.
- [ ] Client cannot set role=hq_admin or is_active=true via user metadata.
- [ ] Email/password login and password recovery work on approved redirect origins.
- [ ] Google OAuth redirect origin is allowlisted.
- [ ] Session expiry/logout clears browser session.
- [ ] HQ and Agent accounts are not shared, even if both notifications go to the same mailbox.

## Release gate
- [ ] All tests above executed and recorded with results.
- [ ] Customer-token issuance/expiry/one-time use tests implemented.
- [ ] PDF mapping reviewed page-by-page against all 18 original PDF pages.
- [ ] Gmail delivery tested with a non-production mailbox and harmless attachments.
- [ ] MFA, rate limiting, audit logging, backup/restore and retention approved.
- [ ] Business owner and security reviewer approve production use.

# Google Gmail integration & database foundation

## Current state and safety boundary

This bundle adds a production-oriented integration foundation, not a live connection.
The original `server.js` and UI remain the local demo (`npm start`). The new API starts with
`npm run start:api` after dependencies and server secrets are configured. It does not
create a Supabase project, Google OAuth app, mailbox, domain, or HQ authorization.
Do not enter real customer data until security review and UAT are complete.

## Google mailbox decision

Use a dedicated Google Workspace mailbox for the agency if possible, e.g.
`submissions@agency-domain.example`, and grant access only to authorized admins.
The app authenticates to that mailbox once using OAuth 2.0 and Gmail API scope
`https://www.googleapis.com/auth/gmail.send`. A consumer Gmail account can be used
for a prototype, but is not the recommended long-term agency setup.

Important distinction:
- A Gmail alias / "send mail as" address is not automatically a shared mailbox.
- Gmail delegation lets another user in the same Workspace organization send as
  the delegator; the delegated user's address can appear in the sender details.
- Domain-wide delegation is an administrator-level Workspace capability and is
  not the default recommendation for this project.
- The safest initial approach is OAuth consent while signed in as the dedicated
  submission mailbox, with its refresh token held only in the server secret store.

## 1. Install dependencies

Node.js 20+ is required. From this project directory:

```bash
npm install
```

This installs Express, Supabase JS, Google APIs, Helmet, Zod and dotenv. The original
prototype still runs with `npm start` (UI + demo API on port 3000).

## 2. Create Supabase project

1. Create a Supabase project in the agency's approved region.
2. Keep database access restricted to authorized operators.
3. Copy the project URL and server-side Secret key into the server environment.
4. Apply `supabase/migrations/002_agent_portal_google_email.sql` to a staging project. (`001` was moved to `supabase/legacy/`: it conflicts with 002 and must not be applied.)
5. Create a private Storage bucket named `private-application-files`.
6. Do not put the Supabase Secret key in `public/`, browser JavaScript, Git, or a ZIP
   distributed to agents.
7. Create each agent in Supabase Auth, then create the matching `profiles` row.
   Assign `admin` role only through a controlled administrator process.

The migration intentionally gives authenticated users read-only table grants.
Writes are expected to go through the trusted API after role/ownership checks.
The API must never trust `agent_id`, `role`, `status`, or storage paths supplied by
the browser.

## 3. Configure Google Cloud OAuth

1. Use a Google Workspace account controlled by the agency if available.
2. Create a Google Cloud project and enable Gmail API.
3. Configure the OAuth consent screen and add only approved agency admins as test
   users while in testing.
4. Create an OAuth Client ID of type Web application.
5. Add the exact redirect URI from `GOOGLE_REDIRECT_URI`.
6. Configure the OAuth app's publishing/verification status according to Google's
   requirements for the requested Gmail scope.
7. Sign in to the authorization flow as the dedicated submission mailbox account.
8. Authorize only `https://www.googleapis.com/auth/gmail.send`.
9. Store the refresh token in a managed secret store. Do not paste it into chat,
   source code, screenshots, or frontend files.

## 4. Environment variables

Copy `.env.example` to `.env` on the server only. The API loads this file with dotenv. Fill:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_SHARED_MAILBOX`
- `GOOGLE_HQ_RECIPIENT`
- `GOOGLE_OAUTH_STATE_SECRET` (random 32+ byte secret)
- `HQ_ALLOWED_RECIPIENTS` (approved HQ addresses only)

Use a secret manager in production. `.env` is only for local development and must
remain ignored by Git.

## 5. Gmail connection flow

Start API with `npm run start:api` (port `API_PORT`, default 3100). An authenticated admin calls:

`GET /api/v1/integrations/google/connect`

The API returns a Google authorization URL. Complete consent while signed in as
the dedicated shared submission mailbox. Google redirects to the configured
callback. The callback returns a refresh token once; copy it directly to the
server secret store and restart the service. Do not keep this callback open to
the public in production without a one-time, expiring admin-bound OAuth state
stored in persistent storage. The in-memory state in this scaffold is suitable
only for a single-process development test.

Before enabling send, verify the authenticated account is the intended mailbox,
verify its sender identity in Gmail settings, and send a non-customer test email
to an internal test address.

## 6. Email behavior

`src/services/gmail.js` builds a MIME email with separate attachments and sends
through `users.messages.send`. It enforces a configured HQ recipient allow-list,
limits attachments, and returns Gmail message/thread IDs. The Gmail API `sent`
response means Gmail accepted the send request; it is not proof HQ received,
opened, or accepted the submission.

The submission service requires `application.status === "approved_by_agent"`.
Before calling it, implement these missing production steps:
- load the application by ID from the database;
- verify caller is its assigned agent or admin;
- fetch only approved, virus-scanned documents from the private bucket;
- verify PDF generation version and document checksums;
- create `email_submissions` and `email_outbox` records transactionally;
- use a worker with row locking / retry backoff / idempotency;
- store Gmail message ID and status;
- record HQ acknowledgement and HQ reference separately.

Do not treat an email bounce or a successful Gmail API response as HQ acknowledgement.

## 7. RLS and access model

The migration:
- enables RLS on all application-related tables;
- allows an authenticated agent to read only records assigned to their `auth.uid()`;
- allows an active admin to read all agency records;
- gives authenticated users no direct table write privileges;
- keeps guest tokens and email queue server-only.

The trusted backend uses a server-side Supabase secret key, which bypasses RLS.
Therefore every backend route using that key MUST independently verify the
authenticated user, active profile, role, application ownership, allowed state,
and document ownership. Never expose this key to the browser.

Before production, add pgTAP tests proving:
- Agent A cannot read Agent B's application or documents;
- Agent A cannot change ownership or role;
- inactive agents are denied;
- admin can read all agency applications;
- anonymous users cannot query application tables;
- guest tokens expire, revoke, and cannot be reused beyond their policy.

## 8. No domain yet

Development can begin on localhost. For production:
- register an agency-controlled domain;
- host the portal on HTTPS;
- configure SPF, DKIM and DMARC for the sender domain;
- set the production OAuth redirect URI;
- configure approved sender identity and reply-to address;
- confirm HQ recipient addresses and attachment-size requirements.

If the shared mailbox is a free consumer Gmail account, do not assume it can provide
the same administrative controls, shared mailbox governance, or sender-domain
authentication as Google Workspace.

## 9. Not yet implemented

This is intentionally not represented as a finished production system. The current
scaffold still needs:
- persistent OAuth state and secure token storage;
- full agent/admin provisioning and MFA enforcement;
- complete CRUD APIs with transactional authorization;
- guest form endpoints backed by the database;
- private storage upload/download adapter and malware scanning;
- PDF field-coordinate mapping and visual QA for all 18 source pages;
- email outbox worker and idempotent retry implementation;
- inbound Gmail reply processing or a manual HQ acknowledgement workflow;
- rate limiting backed by shared storage;
- automated RLS/security tests, backup/restore tests and penetration testing;
- Generali approval and PDPA/legal review.

## Keys: which one goes where (v0.3)
Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` in the server `.env`. The secret key bypasses RLS and is used only for privileged server work; user-facing reads use the publishable key plus the caller's JWT so database rules apply. Apply migrations `002` then `003` (never `supabase/legacy/001`). See `docs/SECURITY-MODEL.md` and run `supabase/tests/rls_staging_test.sql` on staging.

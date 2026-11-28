# HQ access setup — Generali OneForm

This repository can authenticate an HQ user with Supabase email/password once that user exists in Supabase Auth and has an active HQ profile.

## Important: no public HQ registration

Public signup must continue to create an inactive `agent`. Do not add an HQ signup option, do not trust a role supplied by browser metadata, and do not put a service-role key in frontend files.

The current live schema uses `profiles.role = 'admin'` for HQ. The older `hq_admin` value is accepted by the frontend only for compatibility; it must not be written if the live database constraint permits only `admin`.

## Provision the HQ identity

1. Sign in to the Supabase Dashboard using an authorized project-owner account.
2. Open **Authentication → Users** and invite/create the intended corporate HQ email address. Require email verification and use the invitation/password-reset flow so the user sets their own password.
3. In **SQL Editor**, run this read-only check first, replacing the placeholder with the exact HQ email address:

```sql
select u.id, u.email, p.full_name, p.role, p.is_active
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('HQ_EMAIL_ADDRESS');
```

4. Only after verifying that the returned account is the intended HQ identity, run the following privileged update:

```sql
update public.profiles p
set role = 'admin',
    is_active = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('HQ_EMAIL_ADDRESS')
returning p.id, p.full_name, p.role, p.is_active;
```

5. Confirm exactly one row is returned with `role = 'admin'` and `is_active = true`. If zero or multiple rows are returned, stop and investigate; do not broaden the update.
6. Open the deployed OneForm site and sign in using that same email and the password established through the invitation/reset flow. The app will load the profile and show the HQ label when the role is `admin`.
7. Confirm that HQ-only database access is enforced by RLS and test with a separate ordinary Agent account. Never test using real customer information.

## Google sign-in failure

The error `Unable to exchange external code` occurs during Supabase's server-side exchange of the Google authorization code. A frontend change cannot repair an invalid Google OAuth client secret or provider configuration.

For Google sign-in, verify in Supabase **Authentication → Sign In / Providers → Google** that:
- the Google OAuth Client ID and Client Secret belong to the same Web OAuth client;
- the Google OAuth client's authorized redirect URI is exactly the Supabase callback URL shown by the Supabase dashboard (normally `https://xaidyjflzrnzomjsxhfu.supabase.co/auth/v1/callback`);
- the deployed site origin is in Supabase **URL Configuration → Redirect URLs**;
- the Google OAuth consent screen and authorized domains are configured for the intended deployment.

Do not paste OAuth secrets into GitHub, `config.js`, browser code, or chat. Email/password login is the supported fallback while Google OAuth is being repaired.

## Deployment and verification

- Deploy the reviewed frontend commit to GitHub Pages.
- Test HQ email/password login, session reload, logout, and password recovery.
- Test that an active Agent sees no HQ controls and cannot read or modify another Agent's records.
- Test that an active HQ account can view the intended HQ data.
- Do not accept real customer applications until secure customer links, PDF field mapping/finalization, file handling, Gmail delivery, and end-to-end security tests are completed.

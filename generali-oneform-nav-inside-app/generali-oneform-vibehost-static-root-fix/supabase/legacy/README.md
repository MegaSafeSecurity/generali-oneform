# Legacy migration (not applied)

`001_initial_schema.sql` is the earlier customer-centric schema. It defines `profiles`, `applications`,
`guest_links` and `application_events` with columns that conflict with `migrations/002_agent_portal_google_email.sql`
(002 needs `profiles.is_active` and `applications.agent_id`; 002 uses `create table if not exists`, so running it
after 001 silently keeps the old tables and later policies/API queries fail).

It is parked here as `.disabled` so the Supabase CLI does not apply it before 002. Use `002` only, on a new/staging project.

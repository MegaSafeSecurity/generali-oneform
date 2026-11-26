-- 003: access-rule hardening on top of 002. Apply to staging first.
-- Principle: the browser never talks to tables directly. Reads that reach a user go through RLS (user JWT),
-- writes and server-only tables go through the trusted API with the secret key.

-- 1. Private storage bucket. No storage.objects policies are created, so anon/authenticated
--    cannot list, read or write files; the API issues short-lived signed URLs after an authz check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-application-files', 'private-application-files', false, 20971520,
        array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 2. Tables/functions created later in public must be opted in explicitly, never auto-exposed.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- 3. Server-only tables: explicit deny-all so the intent is visible to reviewers and the Supabase linter.
drop policy if exists guest_links_deny_all on public.guest_links;
create policy guest_links_deny_all on public.guest_links
  for all to anon, authenticated using (false) with check (false);
drop policy if exists email_outbox_deny_all on public.email_outbox;
create policy email_outbox_deny_all on public.email_outbox
  for all to anon, authenticated using (false) with check (false);

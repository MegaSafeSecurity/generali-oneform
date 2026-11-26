-- Generali OneForm production foundation (Supabase/PostgreSQL)
-- Apply only to a new/staging Supabase project first. Review with security owner before production.
create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null,
  role text not null default 'agent' check (role in ('agent','admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  reference_no text not null unique,
  agent_id uuid not null references public.profiles(id) on delete restrict,
  insurance_type text not null check (insurance_type in ('PI','PL','GPA')),
  form_version text not null,
  form_data jsonb not null default '{}'::jsonb,
  status text not null default 'submitted'
    check (status in ('draft','submitted','under_review','needs_correction','approved_by_agent','email_queued','email_sent','delivery_failed','hq_acknowledged','hq_reference_received','closed')),
  customer_email text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_agent_created_idx on public.applications(agent_id, created_at desc);
create index if not exists applications_status_idx on public.applications(status);

create table if not exists public.guest_links (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 5),
  use_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists guest_links_application_idx on public.guest_links(application_id);

create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  document_type text not null check (document_type in ('completed_form_pdf','company_registration','company_stamp','applicant_signature','supporting_document','other')),
  storage_bucket text not null default 'private-application-files',
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  sha256 text not null,
  scan_status text not null default 'pending' check (scan_status in ('pending','clean','quarantined','failed')),
  created_at timestamptz not null default now(),
  unique(storage_bucket, storage_path)
);
create index if not exists application_documents_application_idx on public.application_documents(application_id);

create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_type text not null check (actor_type in ('customer','agent','admin','system')),
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists application_events_app_created_idx on public.application_events(application_id, created_at desc);

create table if not exists public.email_submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete restrict,
  initiated_by uuid not null references public.profiles(id) on delete restrict,
  provider text not null default 'gmail',
  from_address text not null,
  to_addresses text[] not null,
  subject text not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','delivery_failed','hq_acknowledged','hq_reference_received')),
  gmail_message_id text,
  gmail_thread_id text,
  hq_reference text,
  hq_acknowledged_at timestamptz,
  error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_submissions_app_created_idx on public.email_submissions(application_id, created_at desc);

create table if not exists public.email_submission_documents (
  submission_id uuid not null references public.email_submissions(id) on delete cascade,
  document_id uuid not null references public.application_documents(id) on delete restrict,
  primary key(submission_id, document_id)
);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.email_submissions(id) on delete cascade,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued','processing','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now()
);
create index if not exists email_outbox_ready_idx on public.email_outbox(status, next_attempt_at);

-- Admin lookup helper. Fixed search_path and private schema reduce privilege escalation risk.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- Enable RLS on every user-facing table.
alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.guest_links enable row level security;
alter table public.application_documents enable row level security;
alter table public.application_events enable row level security;
alter table public.email_submissions enable row level security;
alter table public.email_submission_documents enable row level security;
alter table public.email_outbox enable row level security;

-- Default-deny direct writes. Writes are performed by the trusted API after authz checks.
revoke all on public.profiles, public.applications, public.guest_links,
  public.application_documents, public.application_events, public.email_submissions,
  public.email_submission_documents, public.email_outbox from anon, authenticated;

grant select on public.profiles, public.applications, public.application_documents,
  public.application_events, public.email_submissions, public.email_submission_documents
  to authenticated;

create policy profiles_read_self_or_admin on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));

create policy applications_read_owner_or_admin on public.applications
for select to authenticated
using (agent_id = (select auth.uid()) or (select private.is_admin()));

create policy documents_read_owner_or_admin on public.application_documents
for select to authenticated
using (
  exists (
    select 1 from public.applications a
    where a.id = application_documents.application_id
      and (a.agent_id = (select auth.uid()) or (select private.is_admin()))
  )
);

create policy events_read_owner_or_admin on public.application_events
for select to authenticated
using (
  exists (
    select 1 from public.applications a
    where a.id = application_events.application_id
      and (a.agent_id = (select auth.uid()) or (select private.is_admin()))
  )
);

create policy email_submissions_read_owner_or_admin on public.email_submissions
for select to authenticated
using (
  exists (
    select 1 from public.applications a
    where a.id = email_submissions.application_id
      and (a.agent_id = (select auth.uid()) or (select private.is_admin()))
  )
);

create policy email_submission_documents_read_owner_or_admin on public.email_submission_documents
for select to authenticated
using (
  exists (
    select 1 from public.email_submissions s
    join public.applications a on a.id = s.application_id
    where s.id = email_submission_documents.submission_id
      and (a.agent_id = (select auth.uid()) or (select private.is_admin()))
  )
);

-- guest_links and email_outbox are server-only; no anon/authenticated policies or grants.
-- Create a private storage bucket named private-application-files in Supabase Storage.
-- Do not expose the service-role/secret key to browsers.

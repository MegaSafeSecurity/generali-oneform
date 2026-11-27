-- Generali OneForm: initial schema scaffold. Review with Generali IT/security before production.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'agent' check (role in ('agent','hq_admin')),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  reference_no text not null unique,
  agent_id uuid not null references public.profiles(id),
  customer_email text,
  form_type text not null check (form_type in ('PI','PL','GPA')),
  status text not null default 'draft' check (status in ('draft','submitted','processing','completed','rejected')),
  payload jsonb not null default '{}'::jsonb,
  pdf_storage_path text,
  email_status text not null default 'pending' check (email_status in ('pending','sending','sent','failed')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.application_files (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 8388608),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  agent_id uuid not null references public.profiles(id),
  form_type text not null check (form_type in ('PI','PL','GPA')),
  customer_email text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.application_files enable row level security;
alter table public.customer_links enable row level security;

create or replace function public.is_hq_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role='hq_admin' and p.is_active=true); $$;

create policy "profile self or HQ read" on public.profiles for select
using (id = auth.uid() or public.is_hq_admin());

create policy "agent reads own or HQ reads all applications" on public.applications for select
using (agent_id = auth.uid() or public.is_hq_admin());

create policy "agent creates own application" on public.applications for insert
with check (agent_id = auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true and p.role='agent'));

create policy "agent updates own drafts or HQ updates all" on public.applications for update
using ((agent_id = auth.uid() and status='draft') or public.is_hq_admin())
with check ((agent_id = auth.uid()) or public.is_hq_admin());

create policy "file access via owned application or HQ" on public.application_files for select
using (uploaded_by = auth.uid() or public.is_hq_admin());

create policy "agent uploads own file metadata" on public.application_files for insert
with check (uploaded_by = auth.uid() and exists(select 1 from public.applications a where a.id=application_id and a.agent_id=auth.uid()));

create policy "agent reads own links or HQ" on public.customer_links for select
using (agent_id = auth.uid() or public.is_hq_admin());

create policy "agent creates own links" on public.customer_links for insert
with check (agent_id = auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true));

-- IMPORTANT: Do not expose service-role keys in browser code. Storage bucket must be private.
-- Storage object policies and customer-token submission RPC are intentionally not enabled here.
-- Implement and test them before accepting any real customer data.

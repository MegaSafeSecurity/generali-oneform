-- Generali OneForm: email dispatch state. Safe to re-run.
alter table public.applications
  add column if not exists hq_email_status text not null default 'pending'
    check (hq_email_status in ('pending','sending','sent','failed')),
  add column if not exists hq_email_sent_at timestamptz,
  add column if not exists hq_email_error text;

create index if not exists applications_hq_email_status_idx
  on public.applications (hq_email_status, submitted_at)
  where status = 'submitted';

-- Least privilege: Edge Function reads only dispatch metadata and agent display fields.
revoke all on public.applications from service_role;
revoke all on public.profiles from service_role;
grant select (id, token_hash, reference_no, form_type, status, hq_email_status, agent_id)
  on public.applications to service_role;
grant select (id, full_name, email) on public.profiles to service_role;
grant update (hq_email_status, hq_email_sent_at, hq_email_error)
  on public.applications to service_role;

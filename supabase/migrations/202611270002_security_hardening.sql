-- Generali OneForm security hardening (safe to apply after 202611270001_initial_schema.sql)
-- Roles are provisioned by a trusted administrator only. Public signup always creates an inactive agent.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, is_active)
  values (new.id, nullif(new.raw_user_meta_data->>'full_name',''), 'agent', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_generali on auth.users;
create trigger on_auth_user_created_generali
after insert on auth.users
for each row execute function public.handle_new_user();

-- Remove the broad initial update policy and replace it with draft-only ownership.
drop policy if exists "agent updates own drafts or HQ updates all" on public.applications;
create policy "agent updates own drafts or HQ updates all"
on public.applications for update
using ((agent_id = auth.uid() and status = 'draft') or public.is_hq_admin())
with check ((agent_id = auth.uid() and status = 'draft') or public.is_hq_admin());

-- A trigger prevents agents from changing ownership, status, references or delivery metadata.
create or replace function public.guard_application_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_hq_admin() then
    return new;
  end if;
  if auth.uid() is null or old.agent_id <> auth.uid() or old.status <> 'draft' then
    raise exception 'not authorized';
  end if;
  if new.agent_id <> old.agent_id
     or new.reference_no <> old.reference_no
     or new.form_type <> old.form_type
     or new.status <> old.status
     or new.pdf_storage_path is distinct from old.pdf_storage_path
     or new.email_status <> old.email_status
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'protected application fields cannot be changed by agents';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_application_update_generali on public.applications;
create trigger guard_application_update_generali
before update on public.applications
for each row execute function public.guard_application_update();

-- File metadata visibility must follow application ownership, not uploader-supplied metadata alone.
drop policy if exists "file access via owned application or HQ" on public.application_files;
create policy "file access via owned application or HQ"
on public.application_files for select
using (
  public.is_hq_admin()
  or exists (
    select 1 from public.applications a
    where a.id = application_id and a.agent_id = auth.uid()
  )
);

drop policy if exists "agent uploads own file metadata" on public.application_files;
create policy "agent uploads own file metadata"
on public.application_files for insert
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.applications a
    join public.profiles p on p.id = a.agent_id
    where a.id = application_id
      and a.agent_id = auth.uid()
      and a.status = 'draft'
      and p.is_active = true
      and p.role = 'agent'
  )
);

-- Do not expose token hashes through the Data API. Link creation/consumption is server-only.
drop policy if exists "agent reads own links or HQ" on public.customer_links;
drop policy if exists "agent creates own links" on public.customer_links;

-- Private bucket for supporting files and generated PDFs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generali-private',
  'generali-private',
  false,
  8388608,
  array[
    'application/pdf','image/jpeg','image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = false, file_size_limit = 8388608,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "generali agent reads own files" on storage.objects;
create policy "generali agent reads own files"
on storage.objects for select to authenticated
using (
  bucket_id = 'generali-private'
  and (
    public.is_hq_admin()
    or ((storage.foldername(name))[1] = auth.uid()::text and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true))
  )
);

drop policy if exists "generali agent uploads own files" on storage.objects;
create policy "generali agent uploads own files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'generali-private'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role = 'agent'
  )
);

drop policy if exists "generali agent updates own files" on storage.objects;
create policy "generali agent updates own files"
on storage.objects for update to authenticated
using (
  bucket_id = 'generali-private'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true)
)
with check (
  bucket_id = 'generali-private'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true)
);

drop policy if exists "generali agent deletes own files" on storage.objects;
create policy "generali agent deletes own files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'generali-private'
  and (
    public.is_hq_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Deliberately no public read policy and no anonymous customer access to table rows.


-- Restrict agent-created records to initial drafts. Submission is server-mediated.
drop policy if exists "agent creates own application" on public.applications;
create policy "agent creates own application"
on public.applications for insert
with check (
  agent_id = auth.uid()
  and status = 'draft'
  and email_status = 'pending'
  and pdf_storage_path is null
  and submitted_at is null
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role = 'agent'
  )
);

create or replace function public.guard_application_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if auth.uid() is null or new.agent_id <> auth.uid()
     or new.status <> 'draft'
     or new.email_status <> 'pending'
     or new.pdf_storage_path is not null
     or new.submitted_at is not null then
    raise exception 'application must be created as an owned draft';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_application_insert_generali on public.applications;
create trigger guard_application_insert_generali
before insert on public.applications
for each row execute function public.guard_application_insert();

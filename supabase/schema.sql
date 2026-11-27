-- ============================================================================
-- Generali OneForm - skema Supabase.  BOLEH DIJALANKAN BERULANG KALI (idempotent).
-- Supabase Dashboard > SQL Editor > New query > tampal semua > Run.
--
-- SEBELUM RUN: tukar emel HQ di bawah (baris "hq_allowlist"). Hanya emel dalam senarai
-- ini yang menjadi HQ, dan hanya selepas emelnya DISAHKAN (kata laluan: pautan emel; Google: automatik).
-- ============================================================================
create extension if not exists pgcrypto with schema extensions;

-- 1) Jadual --------------------------------------------------------------------
create table if not exists public.hq_allowlist (
  email text primary key check (email = lower(email))
);
insert into public.hq_allowlist (email) values ('ganti-emel-hq@gmail.com') on conflict do nothing;   -- <== TUKAR

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       text not null default 'agent'   check (role in ('agent','hq')),
  status     text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id             uuid primary key default gen_random_uuid(),
  reference_no   text not null unique,
  token_hash     text not null unique,                     -- SHA-256 token pautan; token asal tidak disimpan
  form_type      text not null check (form_type in ('PI','PL','GPA')),
  agent_id       uuid not null references public.profiles(id) on delete restrict,
  customer_email text,
  status         text not null default 'draft' check (status in ('draft','submitted','revoked')),
  answers        jsonb not null default '{}'::jsonb,
  members        jsonb not null default '[]'::jsonb,
  draft_step     int  not null default 0,
  signature      text,
  stamp          text,
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  constraint applications_sig_chk   check (signature is null or (length(signature) <= 800000 and signature like 'data:image/png;base64,%')),
  constraint applications_stamp_chk check (stamp     is null or (length(stamp)     <= 800000 and stamp     like 'data:image/png;base64,%'))
);
create index if not exists applications_agent_idx on public.applications (agent_id, created_at desc);

-- 2) Fungsi bantuan (digunakan oleh polisi RLS) --------------------------------------
create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;
create or replace function public.is_hq() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'hq' and status = 'active');
$$;

-- 3) Profil automatik bila pengguna daftar (emel/kata laluan ATAU Google) --------------
create or replace function public.sync_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(coalesce(new.email, ''));
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, v_email,
          coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(v_email, '@', 1)))
  on conflict (id) do update set email = excluded.email;
  -- HQ: hanya jika emel dalam allowlist DAN sudah disahkan (cegah pihak lain mendaftar guna emel HQ)
  if new.email_confirmed_at is not null and exists (select 1 from public.hq_allowlist where email = v_email) then
    update public.profiles set role = 'hq', status = 'active' where id = new.id and (role <> 'hq' or status = 'pending');
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_sync on auth.users;
create trigger on_auth_user_sync
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_profile();

-- pengguna yang sudah wujud sebelum skema ini
insert into public.profiles (id, email, full_name)
select u.id, lower(coalesce(u.email, '')), coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(coalesce(u.email, ''), '@', 1))
from auth.users u on conflict (id) do nothing;
update public.profiles p set role = 'hq', status = 'active'
from auth.users u
where u.id = p.id and u.email_confirmed_at is not null
  and exists (select 1 from public.hq_allowlist a where a.email = lower(u.email)) and (p.role <> 'hq' or p.status = 'pending');

-- 4) RLS: semua tulis melalui RPC; pelanggan tiada akses terus ke jadual ------------------
alter table public.hq_allowlist enable row level security;
alter table public.profiles     enable row level security;
alter table public.applications enable row level security;
revoke all on public.hq_allowlist, public.profiles, public.applications from anon, authenticated;
grant select on public.profiles, public.applications to authenticated;
grant select, insert, delete on public.hq_allowlist to authenticated;

drop policy if exists "profiles_read_self_or_admin" on public.profiles;     -- nama polisi lama (punca ralat 42710)
drop policy if exists "profiles_read_self_or_hq"    on public.profiles;
create policy "profiles_read_self_or_hq" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_hq());

drop policy if exists "applications_read_own_or_hq" on public.applications;
create policy "applications_read_own_or_hq" on public.applications for select to authenticated
  using ((agent_id = auth.uid() and public.is_active_user()) or public.is_hq());

drop policy if exists "allowlist_hq_only" on public.hq_allowlist;
create policy "allowlist_hq_only" on public.hq_allowlist for all to authenticated
  using (public.is_hq()) with check (public.is_hq());

-- 5) RPC ejen / HQ ------------------------------------------------------------------
create or replace function public.create_application(p_form text, p_customer_email text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_token text; v_ref text; v_id uuid; v_exp timestamptz := now() + interval '7 days';
begin
  if not public.is_active_user() then raise exception 'forbidden'; end if;
  if p_form not in ('PI','PL','GPA') then raise exception 'bad_form'; end if;
  if nullif(p_customer_email, '') is not null and p_customer_email !~ '^[^\s@]{1,64}@[^\s@]{1,190}$' then raise exception 'bad_email'; end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');                       -- 48 aksara hex, 192-bit
  v_ref   := 'GEN-' || to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYYYMMDD') || '-' || upper(encode(extensions.gen_random_bytes(3), 'hex'));
  insert into public.applications (reference_no, token_hash, form_type, agent_id, customer_email, expires_at)
  values (v_ref, encode(extensions.digest(v_token, 'sha256'), 'hex'), p_form, auth.uid(), nullif(p_customer_email, ''), v_exp)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token, 'reference_no', v_ref, 'expires_at', v_exp);
end $$;

create or replace function public.revoke_application(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_user() then raise exception 'forbidden'; end if;
  update public.applications set status = 'revoked'
   where id = p_id and status = 'draft' and (agent_id = auth.uid() or public.is_hq());
  return found;
end $$;

create or replace function public.hq_set_agent_status(p_user uuid, p_status text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_hq() then raise exception 'forbidden'; end if;
  if p_status not in ('active','suspended') or p_user = auth.uid() then raise exception 'bad'; end if;
  update public.profiles set status = p_status where id = p_user and role = 'agent';
  return found;
end $$;

-- 6) RPC pelanggan (tanpa akaun; dilindungi token pautan 7 hari) -----------------------------
create or replace function public.app_by_token(p_token text) returns public.applications
language plpgsql security definer set search_path = '' as $$
declare r public.applications;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then raise exception 'bad'; end if;
  select * into r from public.applications where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then raise exception 'bad'; end if;
  if r.status = 'revoked' then raise exception 'revoked'; end if;
  if r.status = 'draft' and r.expires_at < now() then raise exception 'expired'; end if;
  return r;
end $$;

create or replace function public.customer_get(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.applications;
begin
  r := public.app_by_token(p_token);
  return jsonb_build_object('form_type', r.form_type, 'reference_no', r.reference_no, 'status', r.status,
                            'expires_at', r.expires_at, 'answers', r.answers, 'members', r.members, 'step', r.draft_step);
end $$;

create or replace function public.customer_save_draft(p_token text, p_answers jsonb, p_members jsonb, p_step int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare r public.applications;
begin
  r := public.app_by_token(p_token);
  if r.status <> 'draft' then raise exception 'locked'; end if;
  if jsonb_typeof(p_answers) <> 'object' or jsonb_typeof(p_members) <> 'array'
     or length(p_answers::text) > 200000 or length(p_members::text) > 200000 then raise exception 'bad'; end if;
  update public.applications set answers = p_answers, members = p_members, draft_step = greatest(0, least(coalesce(p_step, 0), 20)) where id = r.id;
  return true;
end $$;

create or replace function public.customer_submit(p_token text, p_answers jsonb, p_members jsonb, p_signature text, p_stamp text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.applications;
begin
  r := public.app_by_token(p_token);
  if r.status <> 'draft' then raise exception 'locked'; end if;
  if jsonb_typeof(p_answers) <> 'object' or p_answers = '{}'::jsonb or jsonb_typeof(p_members) <> 'array'
     or length(p_answers::text) > 200000 or length(p_members::text) > 200000 then raise exception 'bad'; end if;
  if p_signature is null or p_signature not like 'data:image/png;base64,%' or length(p_signature) > 800000 then raise exception 'bad_image'; end if;
  if p_stamp is not null and (p_stamp not like 'data:image/png;base64,%' or length(p_stamp) > 800000) then raise exception 'bad_image'; end if;
  update public.applications
     set answers = p_answers, members = p_members, signature = p_signature, stamp = p_stamp, status = 'submitted', submitted_at = now()
   where id = r.id;
  return jsonb_build_object('reference_no', r.reference_no);
end $$;

-- 7) Kebenaran fungsi: tiada akses lalai; beri hanya yang perlu ---------------------------
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_active_user(), public.is_hq() to authenticated;
grant execute on function public.create_application(text, text), public.revoke_application(uuid), public.hq_set_agent_status(uuid, text) to authenticated;
grant execute on function public.customer_get(text), public.customer_save_draft(text, jsonb, jsonb, int),
                          public.customer_submit(text, jsonb, jsonb, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

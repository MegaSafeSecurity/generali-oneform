-- RLS behaviour test. Run in the Supabase SQL editor on a STAGING project after migrations 002 + 003.
-- NOT executed in the build sandbox (no Postgres there). It creates temp users, asserts, then rolls back.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'agent-a@test.invalid'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'agent-b@test.invalid'),
  ('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.invalid');
insert into public.profiles (id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Agent A', 'agent'),
  ('00000000-0000-0000-0000-0000000000a2', 'Agent B', 'agent'),
  ('00000000-0000-0000-0000-0000000000ad', 'Admin', 'admin');
insert into public.applications (reference_no, agent_id, insurance_type, form_version) values
  ('T-A', '00000000-0000-0000-0000-0000000000a1', 'PI', 'test'),
  ('T-B', '00000000-0000-0000-0000-0000000000a2', 'PL', 'test');

do $$
declare n int;
begin
  -- Agent A sees only own application
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.applications; assert n = 1, 'agent A must see exactly 1 application, saw ' || n;
  -- No direct writes
  begin update public.applications set status = 'closed'; assert false, 'agent write must be denied';
  exception when insufficient_privilege then null; end;
  -- Server-only tables are invisible/denied
  begin perform 1 from public.guest_links; assert false, 'guest_links must be denied';
  exception when insufficient_privilege then null; end;
  reset role;
  -- Admin sees everything
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.applications; assert n >= 2, 'admin must see all applications';
  reset role;
  -- Anonymous sees nothing
  set local role anon;
  begin perform 1 from public.applications; assert false, 'anon must be denied';
  exception when insufficient_privilege then null; end;
  reset role;
  raise notice 'RLS staging test: ALL ASSERTIONS PASSED';
end $$;
rollback;

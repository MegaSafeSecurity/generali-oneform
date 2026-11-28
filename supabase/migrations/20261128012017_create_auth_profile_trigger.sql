-- Create a profile for every new Supabase Auth user.
-- Public signup can never choose an elevated role or activate itself.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
begin
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'New agent'
  );

  insert into public.profiles (id, full_name, role, is_active)
  values (new.id, v_full_name, 'agent', false)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_generali on auth.users;
create trigger on_auth_user_created_generali
after insert on auth.users
for each row execute function public.handle_new_user();

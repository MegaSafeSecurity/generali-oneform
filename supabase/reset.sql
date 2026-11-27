-- ============================================================================
-- reset.sql  (PILIHAN - DESTRUKTIF)
-- Padam SEMUA jadual/fungsi/polisi dalam skema "public" (data aplikasi hilang; akaun Auth kekal).
-- Jalankan HANYA jika projek Supabase anda ada skema lama yang menyebabkan ralat
-- seperti: policy "profiles_read_self_or_admin" ... already exists.
-- Selepas itu jalankan schema.sql.
-- ============================================================================
drop trigger if exists on_auth_user_sync on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

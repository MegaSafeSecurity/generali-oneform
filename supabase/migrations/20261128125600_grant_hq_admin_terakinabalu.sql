-- Grant the existing Generali OneForm account explicit HQ administrator access.
-- Target is deliberately restricted to this exact, pre-existing Auth email.
-- Run through Supabase migration/admin context; never expose service_role credentials.

DO $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id
    INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower('terakinabalu@gmail.com')
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION
      'Cannot grant HQ: terakinabalu@gmail.com does not exist in auth.users';
  END IF;

  INSERT INTO public.profiles (id, role, is_active)
  VALUES (target_user_id, 'admin', true)
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        is_active = true;
END
$$;

-- Verification query (run separately after applying):
-- SELECT u.email, p.role, p.is_active
-- FROM auth.users AS u
-- JOIN public.profiles AS p ON p.id = u.id
-- WHERE lower(u.email) = lower('terakinabalu@gmail.com');

-- Align HQ role handling with the live Generali OneForm schema.
-- The live profiles constraint uses 'admin' (not 'hq_admin') and private.is_admin()
-- is the authoritative role checker used by the newer RLS policies.

ALTER TABLE public.profiles
  ALTER COLUMN is_active SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_hq_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.is_admin();
$function$;

REVOKE ALL ON FUNCTION public.is_hq_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hq_admin() TO authenticated;

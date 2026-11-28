-- Keep trigger/event-trigger helpers out of the exposed PostgREST RPC surface.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- RLS policies call this helper for signed-in users; allow authenticated only.
REVOKE ALL ON FUNCTION public.is_hq_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hq_admin() TO authenticated;

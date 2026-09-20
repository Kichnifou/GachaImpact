-- Keep the SECURITY INVOKER trigger's object resolution independent from caller settings.
ALTER FUNCTION public.check_friend_heart_pair()
SET search_path = pg_catalog, public;

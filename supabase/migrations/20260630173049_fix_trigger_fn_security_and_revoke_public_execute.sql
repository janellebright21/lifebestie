-- Recreate the trigger function as SECURITY INVOKER (it is a simple timestamp
-- setter with no privilege escalation needed) and revoke PUBLIC EXECUTE so
-- neither anon nor authenticated can call it via RPC.

CREATE OR REPLACE FUNCTION public.update_tomorrow_prep_checklist_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Revoke from PUBLIC (covers both anon and authenticated implicitly granted roles)
REVOKE EXECUTE ON FUNCTION public.update_tomorrow_prep_checklist_updated_at() FROM PUBLIC;

-- Ensure the named roles are also explicitly revoked for belt-and-suspenders safety
REVOKE EXECUTE ON FUNCTION public.update_tomorrow_prep_checklist_updated_at() FROM anon, authenticated;

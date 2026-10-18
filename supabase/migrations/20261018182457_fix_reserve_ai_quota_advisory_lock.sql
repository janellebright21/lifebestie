-- ════════════════════════════════════════════════════════════════════════════
-- Fix reserve_ai_quota: safe atomic daily-quota reservation.
--
-- Previous deployed version (migration 20261003122309) contained
--   SELECT COALESCE(SUM(call_count),0) ... FOR UPDATE
-- which Postgres rejects (aggregate + row lock) and which, even if it ran,
-- only locked existing rows — unsafe for a user/day with zero rows or with
-- rows only for other function names.
--
-- Fix: take a transaction-level advisory lock keyed on p_user_id (same user
-- across ALL functions) BEFORE reading the daily SUM, then compare p_limit,
-- then upsert. Concurrent calls for the same user serialize on the lock.
-- Null/invalid p_limit fails closed (returns false).
--
-- Signature, SECURITY DEFINER, search_path, service_role-only EXECUTE,
-- current-date total across all functions, and existing billing/access
-- checks are preserved. No quota bypass, no limit change.
--
-- Rollback: re-apply CREATE OR REPLACE FUNCTION reserve_ai_quota and
-- release_ai_quota from migration 20261003122309 verbatim (backup below);
-- advisory-lock semantics are additive, no schema or row changes.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Backup of pre-fix reserve_ai_quota (captured from live DB 2026-10-18) ──
-- CREATE OR REPLACE FUNCTION public.reserve_ai_quota(p_user_id uuid, p_function text, p_provider text DEFAULT 'anthropic'::text, p_limit integer DEFAULT 50)
-- RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
-- AS $function$
-- DECLARE current_count integer;
-- BEGIN
--   SELECT COALESCE(SUM(call_count), 0) INTO current_count FROM ai_usage_daily
--   WHERE user_id = p_user_id AND date = CURRENT_DATE AND function_name = p_function
--   FOR UPDATE;
--   SELECT COALESCE(SUM(call_count), 0) INTO current_count FROM ai_usage_daily
--   WHERE user_id = p_user_id AND date = CURRENT_DATE;
--   IF current_count >= p_limit THEN RETURN false; END IF;
--   INSERT INTO ai_usage_daily (user_id, date, function_name, provider, call_count, estimated_cost_cents, last_call_at)
--   VALUES (p_user_id, CURRENT_DATE, p_function, p_provider, 1, 0, now())
--   ON CONFLICT (user_id, date, function_name)
--   DO UPDATE SET call_count = ai_usage_daily.call_count + 1, last_call_at = now();
--   RETURN true;
-- END;
-- $function$;

CREATE OR REPLACE FUNCTION public.reserve_ai_quota(
  p_user_id   uuid,
  p_function  text,
  p_provider  text DEFAULT 'anthropic',
  p_limit     integer DEFAULT 50
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
BEGIN
  -- Fail closed on null/invalid limits
  IF p_limit IS NULL OR p_limit < 0 THEN
    RETURN false;
  END IF;

  -- Transaction-level advisory lock keyed on the user, same key across ALL
  -- functions. Held until transaction end, so concurrent requests for the
  -- same user serialize before the daily SUM is read.
  PERFORM pg_advisory_xact_lock(hashtextextended('ai_quota:' || p_user_id::text, 0));

  SELECT COALESCE(SUM(call_count), 0) INTO current_count
  FROM ai_usage_daily
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  IF current_count >= p_limit THEN
    RETURN false;
  END IF;

  INSERT INTO ai_usage_daily (user_id, date, function_name, provider, call_count, estimated_cost_cents, last_call_at)
  VALUES (p_user_id, CURRENT_DATE, p_function, p_provider, 1, 0, now())
  ON CONFLICT (user_id, date, function_name)
  DO UPDATE SET
    call_count = ai_usage_daily.call_count + 1,
    last_call_at = now();

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_ai_quota(uuid, text, text, integer) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_ai_quota(uuid, text, text, integer) TO service_role;

-- ── release_ai_quota: same per-user transaction advisory lock ───────────────
CREATE OR REPLACE FUNCTION public.release_ai_quota(
  p_user_id  uuid,
  p_function text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ai_quota:' || p_user_id::text, 0));

  UPDATE ai_usage_daily
  SET call_count = GREATEST(call_count - 1, 0)
  WHERE user_id = p_user_id
    AND date = CURRENT_DATE
    AND function_name = p_function
    AND call_count > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_ai_quota(uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_ai_quota(uuid, text) TO service_role;

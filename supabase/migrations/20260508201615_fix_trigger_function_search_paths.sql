/*
  # Fix mutable search_path in trigger functions

  ## Summary
  All five `updated_at` trigger functions had a mutable search_path, which
  is a security risk because an attacker with CREATE SCHEMA privileges could
  shadow standard functions by placing objects earlier in the search path.

  ## Fix
  Recreate each function with `SET search_path = public, pg_catalog` so the
  search path is fixed at function-creation time and cannot be manipulated
  at call time.

  ## Affected functions
  - public.update_daily_plans_updated_at
  - public.update_goals_updated_at
  - public.update_user_memory_updated_at
  - public.update_weekly_grocery_lists_updated_at
  - public.update_grocery_budget_updated_at
*/

CREATE OR REPLACE FUNCTION public.update_daily_plans_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_goals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_memory_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_weekly_grocery_lists_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_grocery_budget_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

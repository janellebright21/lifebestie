/*
  # Persist Plan My Day editor state and enforce private ownership

  Stores the user-arranged Plan My Day items separately from the AI-generated
  high-impact and small-win lists.

  The project still had four legacy memory_id/anonymous policies on daily_plans.
  They are removed before saved notes are enabled. The authenticated user_id
  policies are retained (and created if missing), so each user can access only
  their own dated plan.

  This migration does not delete or rewrite planner records.
*/

ALTER TABLE public.daily_plans
  ADD COLUMN IF NOT EXISTS planner_items jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.daily_plans
  ADD COLUMN IF NOT EXISTS planner_items_saved_at timestamptz;

COMMENT ON COLUMN public.daily_plans.planner_items IS
  'User-arranged Plan My Day items, including order, time, notes, locks, and completion state.';

COMMENT ON COLUMN public.daily_plans.planner_items_saved_at IS
  'Last successful explicit save from the Plan My Day sheet; null means no customized plan has been saved.';

ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can select daily_plans" ON public.daily_plans;
DROP POLICY IF EXISTS "Delete own daily_plans" ON public.daily_plans;
DROP POLICY IF EXISTS "Insert daily_plans with memory_id" ON public.daily_plans;
DROP POLICY IF EXISTS "Update own daily_plans" ON public.daily_plans;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_plans'
      AND policyname = 'Users can view own daily plans'
  ) THEN
    CREATE POLICY "Users can view own daily plans"
      ON public.daily_plans
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_plans'
      AND policyname = 'Users can insert own daily plans'
  ) THEN
    CREATE POLICY "Users can insert own daily plans"
      ON public.daily_plans
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_plans'
      AND policyname = 'Users can update own daily plans'
  ) THEN
    CREATE POLICY "Users can update own daily plans"
      ON public.daily_plans
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_plans'
      AND policyname = 'Users can delete own daily plans'
  ) THEN
    CREATE POLICY "Users can delete own daily plans"
      ON public.daily_plans
      FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END
$$;

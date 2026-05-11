/*
  # Add adaptive planning columns to daily_plans

  ## Summary
  Extends daily_plans with the data needed to make the planner adaptive:
  track skipped tasks, completion rates, load calibration, and adaptation
  events that surface as in-app nudges.

  ## New columns on `daily_plans`
  - `skipped_tasks` (jsonb, default [])
      Array of PlanTask objects that were in the plan but NOT completed by
      end of day. Used to auto-reschedule into tomorrow's plan.
  - `completion_rate` (numeric 0–1, nullable)
      Fraction of plan tasks completed that day. Computed when the day ends
      or when the user manually triggers a recap. Used to detect overload.
  - `load_hint` (text, default 'normal')
      Carries forward into the next day's generation: 'light' | 'normal' | 'heavy'.
      Set by the adaptive logic when the user is consistently falling behind or
      finishing early.
  - `adaptations` (jsonb, default [])
      Array of AdaptationEvent objects shown as nudge banners in the UI.
      Shape: { type, message, task_id?, created_at }
      type: 'reschedule' | 'next_task' | 'load_reduced' | 'time_hint'
  - `focus_hours` (jsonb, default [])
      Array of hour integers (0-23) when the user tends to complete tasks.
      Built up from completion timestamps. Used to surface "You focus best at
      X — want to do this then?" suggestions.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_plans' AND column_name = 'skipped_tasks'
  ) THEN
    ALTER TABLE daily_plans ADD COLUMN skipped_tasks jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_plans' AND column_name = 'completion_rate'
  ) THEN
    ALTER TABLE daily_plans ADD COLUMN completion_rate numeric;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_plans' AND column_name = 'load_hint'
  ) THEN
    ALTER TABLE daily_plans ADD COLUMN load_hint text NOT NULL DEFAULT 'normal';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_plans' AND column_name = 'adaptations'
  ) THEN
    ALTER TABLE daily_plans ADD COLUMN adaptations jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_plans' AND column_name = 'focus_hours'
  ) THEN
    ALTER TABLE daily_plans ADD COLUMN focus_hours jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_plans' AND column_name = 'completion_timestamps'
  ) THEN
    ALTER TABLE daily_plans ADD COLUMN completion_timestamps jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

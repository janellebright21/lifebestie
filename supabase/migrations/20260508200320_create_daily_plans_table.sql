/*
  # Create daily_plans table

  ## Summary
  Stores one AI-generated daily plan per user per day. Plans are generated
  on demand each morning and cached so the same plan is returned for the
  rest of the day without another AI call.

  ## New Tables
  - `daily_plans`
    - `id` (uuid, primary key)
    - `memory_id` (uuid) — anonymous user identity matching other tables
    - `plan_date` (date) — the calendar date this plan covers (YYYY-MM-DD)
    - `high_impact` (jsonb) — array of 2–3 PlanTask objects (goal-linked, important)
    - `small_wins` (jsonb) — array of 2–3 PlanTask objects (quick, maintenance)
    - `message` (text) — motivational intro message from the AI
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz, auto-updated by trigger)

  ## PlanTask shape (stored in jsonb arrays):
    {
      id: string,           -- matches a real task id, or a generated suggestion id
      title: string,
      type: "high_impact" | "small_win",
      reason: string,       -- one-line explanation of why this was chosen
      linked_goal_id?: string,
      linked_goal_title?: string,
      duration?: number,    -- minutes
      completed: boolean
    }

  ## Constraints
  - UNIQUE (memory_id, plan_date) — one plan per user per day

  ## Security
  - RLS enabled
  - Anon and authenticated users can read/insert/update/delete their own rows
*/

CREATE TABLE IF NOT EXISTS daily_plans (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id   uuid        NOT NULL,
  plan_date   date        NOT NULL,
  high_impact jsonb       NOT NULL DEFAULT '[]'::jsonb,
  small_wins  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  message     text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_plans_memory_id_plan_date_key'
  ) THEN
    ALTER TABLE daily_plans
      ADD CONSTRAINT daily_plans_memory_id_plan_date_key
      UNIQUE (memory_id, plan_date);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_daily_plans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_plans_updated_at ON daily_plans;
CREATE TRIGGER daily_plans_updated_at
  BEFORE UPDATE ON daily_plans
  FOR EACH ROW EXECUTE FUNCTION update_daily_plans_updated_at();

ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select daily_plans"
  ON daily_plans FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anon can insert daily_plans"
  ON daily_plans FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon can update daily_plans"
  ON daily_plans FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete daily_plans"
  ON daily_plans FOR DELETE
  TO anon, authenticated
  USING (true);

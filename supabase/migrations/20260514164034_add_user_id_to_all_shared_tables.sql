/*
  # Add user_id ownership to all tables missing it

  This migration ensures every table that stores per-user data has a user_id
  column so Row Level Security can enforce strict per-account isolation.

  Tables updated:
  - meals
  - grocery_budget (also fixes unique constraint to be per-user)
  - spending_snapshots (also adds user_id to unique constraint)
  - receipts
  - daily_plans (also adds user_id to unique constraint)

  All tables get RLS enabled and four policies (SELECT/INSERT/UPDATE/DELETE)
  that restrict access to the row owner.
*/

-- ── meals ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meals' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE meals ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS meals_user_id_idx ON meals (user_id);
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own meals" ON meals;
CREATE POLICY "Users can view own meals" ON meals FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own meals" ON meals;
CREATE POLICY "Users can insert own meals" ON meals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own meals" ON meals;
CREATE POLICY "Users can update own meals" ON meals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own meals" ON meals;
CREATE POLICY "Users can delete own meals" ON meals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── grocery_budget ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grocery_budget' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE grocery_budget ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Replace global unique(memory_id) with per-user unique
ALTER TABLE grocery_budget DROP CONSTRAINT IF EXISTS grocery_budget_memory_id_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'grocery_budget'::regclass AND conname = 'grocery_budget_user_id_key'
  ) THEN
    ALTER TABLE grocery_budget ADD CONSTRAINT grocery_budget_user_id_key UNIQUE (user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS grocery_budget_user_id_idx ON grocery_budget (user_id);
ALTER TABLE grocery_budget ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own grocery budget" ON grocery_budget;
CREATE POLICY "Users can view own grocery budget" ON grocery_budget FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own grocery budget" ON grocery_budget;
CREATE POLICY "Users can insert own grocery budget" ON grocery_budget FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own grocery budget" ON grocery_budget;
CREATE POLICY "Users can update own grocery budget" ON grocery_budget FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own grocery budget" ON grocery_budget;
CREATE POLICY "Users can delete own grocery budget" ON grocery_budget FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── spending_snapshots ────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spending_snapshots' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE spending_snapshots ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Replace global unique(memory_id, week_start_date) with per-user
ALTER TABLE spending_snapshots DROP CONSTRAINT IF EXISTS spending_snapshots_memory_id_week_start_date_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'spending_snapshots'::regclass AND conname = 'spending_snapshots_user_id_week_start_date_key'
  ) THEN
    ALTER TABLE spending_snapshots ADD CONSTRAINT spending_snapshots_user_id_week_start_date_key UNIQUE (user_id, week_start_date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS spending_snapshots_user_id_idx ON spending_snapshots (user_id);
ALTER TABLE spending_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own spending snapshots" ON spending_snapshots;
CREATE POLICY "Users can view own spending snapshots" ON spending_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own spending snapshots" ON spending_snapshots;
CREATE POLICY "Users can insert own spending snapshots" ON spending_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own spending snapshots" ON spending_snapshots;
CREATE POLICY "Users can update own spending snapshots" ON spending_snapshots FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own spending snapshots" ON spending_snapshots;
CREATE POLICY "Users can delete own spending snapshots" ON spending_snapshots FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── receipts ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receipts' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE receipts ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS receipts_user_id_idx ON receipts (user_id);
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own receipts" ON receipts;
CREATE POLICY "Users can view own receipts" ON receipts FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own receipts" ON receipts;
CREATE POLICY "Users can insert own receipts" ON receipts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own receipts" ON receipts;
CREATE POLICY "Users can update own receipts" ON receipts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own receipts" ON receipts;
CREATE POLICY "Users can delete own receipts" ON receipts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── daily_plans ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_plans' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE daily_plans ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Replace global unique(memory_id, plan_date) with per-user
ALTER TABLE daily_plans DROP CONSTRAINT IF EXISTS daily_plans_memory_id_plan_date_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'daily_plans'::regclass AND conname = 'daily_plans_user_id_plan_date_key'
  ) THEN
    ALTER TABLE daily_plans ADD CONSTRAINT daily_plans_user_id_plan_date_key UNIQUE (user_id, plan_date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS daily_plans_user_id_idx ON daily_plans (user_id);
ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own daily plans" ON daily_plans;
CREATE POLICY "Users can view own daily plans" ON daily_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own daily plans" ON daily_plans;
CREATE POLICY "Users can insert own daily plans" ON daily_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own daily plans" ON daily_plans;
CREATE POLICY "Users can update own daily plans" ON daily_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own daily plans" ON daily_plans;
CREATE POLICY "Users can delete own daily plans" ON daily_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);

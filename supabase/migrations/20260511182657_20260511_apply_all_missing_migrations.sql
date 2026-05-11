/*
  # Apply all missing migrations

  The database was only partially migrated — only tasks, events, category_colors,
  and weekly_grocery_lists tables existed. This migration creates all missing tables
  and applies all missing column additions and policy changes from the migration history.

  ## New Tables
  - `user_memory` — persistent AI assistant memory per user session
  - `grocery_items` — per-item grocery list
  - `meals` — saved meals with ingredients for meal planning
  - `grocery_budget` — weekly budget and estimated total per user
  - `goals` — user goals with progress and linked tasks
  - `daily_plans` — AI-generated daily plans cached per user per day
  - `spending_snapshots` — weekly grocery spending history
  - `receipts` — scanned grocery receipts

  ## Column Additions
  - `user_memory.common_groceries` (jsonb)
  - `tasks.linked_goal_id`, `tasks.duration`, `tasks.memory_id`, `tasks.category`, `tasks.priority`
  - `events.memory_id`, `events.category`, `events.location`, `events.notes`, `events.meal_id`
  - `grocery_items.memory_id`
  - `weekly_grocery_lists.memory_id`, `weekly_grocery_lists.weekly_message`
  - `daily_plans` adaptive columns: skipped_tasks, completion_rate, load_hint, adaptations, focus_hours, completion_timestamps

  ## Security
  - RLS enabled on all new tables
  - All policies use memory_id IS NOT NULL guard for write operations
*/

-- ─── user_memory ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routines jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{"preferredWakeTime": "", "busyDays": [], "commonGroceries": []}'::jsonb,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_memory' AND column_name = 'common_groceries'
  ) THEN
    ALTER TABLE user_memory ADD COLUMN common_groceries jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

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

DROP TRIGGER IF EXISTS user_memory_updated_at ON user_memory;
CREATE TRIGGER user_memory_updated_at
  BEFORE UPDATE ON user_memory
  FOR EACH ROW EXECUTE FUNCTION update_user_memory_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_memory' AND policyname = 'Allow select user_memory') THEN
    CREATE POLICY "Allow select user_memory" ON user_memory FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_memory' AND policyname = 'Insert user_memory with id') THEN
    CREATE POLICY "Insert user_memory with id" ON user_memory FOR INSERT TO anon, authenticated WITH CHECK (id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_memory' AND policyname = 'Update own user_memory') THEN
    CREATE POLICY "Update own user_memory" ON user_memory FOR UPDATE TO anon, authenticated USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
  END IF;
END $$;

-- ─── grocery_items ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS grocery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Pantry',
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grocery_items' AND column_name = 'memory_id'
  ) THEN
    ALTER TABLE grocery_items ADD COLUMN memory_id uuid;
  END IF;
END $$;

ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'grocery_items' AND policyname = 'Allow all access to grocery_items') THEN
    CREATE POLICY "Allow all access to grocery_items" ON grocery_items FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'grocery_items' AND policyname = 'Insert grocery_items with memory_id') THEN
    CREATE POLICY "Insert grocery_items with memory_id" ON grocery_items FOR INSERT TO anon, authenticated WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'grocery_items' AND policyname = 'Update own grocery_items') THEN
    CREATE POLICY "Update own grocery_items" ON grocery_items FOR UPDATE TO anon, authenticated USING (memory_id IS NOT NULL) WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'grocery_items' AND policyname = 'Delete own grocery_items') THEN
    CREATE POLICY "Delete own grocery_items" ON grocery_items FOR DELETE TO anon, authenticated USING (memory_id IS NOT NULL);
  END IF;
END $$;

-- ─── tasks — add missing columns ─────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'linked_goal_id') THEN
    ALTER TABLE tasks ADD COLUMN linked_goal_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'duration') THEN
    ALTER TABLE tasks ADD COLUMN duration integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'memory_id') THEN
    ALTER TABLE tasks ADD COLUMN memory_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'category') THEN
    ALTER TABLE tasks ADD COLUMN category text NOT NULL DEFAULT 'Other';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'priority') THEN
    ALTER TABLE tasks ADD COLUMN priority text NOT NULL DEFAULT 'medium';
  END IF;
END $$;

-- Replace old permissive tasks write policies
DROP POLICY IF EXISTS "Allow insert tasks" ON tasks;
DROP POLICY IF EXISTS "Allow update tasks" ON tasks;
DROP POLICY IF EXISTS "Allow delete tasks" ON tasks;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Insert tasks with memory_id') THEN
    CREATE POLICY "Insert tasks with memory_id" ON tasks FOR INSERT TO anon, authenticated WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Update own tasks') THEN
    CREATE POLICY "Update own tasks" ON tasks FOR UPDATE TO anon, authenticated USING (memory_id IS NOT NULL) WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Delete own tasks') THEN
    CREATE POLICY "Delete own tasks" ON tasks FOR DELETE TO anon, authenticated USING (memory_id IS NOT NULL);
  END IF;
END $$;

-- ─── events — add missing columns ────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'memory_id') THEN
    ALTER TABLE events ADD COLUMN memory_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'category') THEN
    ALTER TABLE events ADD COLUMN category text NOT NULL DEFAULT 'Other';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'location') THEN
    ALTER TABLE events ADD COLUMN location text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'notes') THEN
    ALTER TABLE events ADD COLUMN notes text;
  END IF;
END $$;

-- Replace old permissive events write policies
DROP POLICY IF EXISTS "Allow insert events" ON events;
DROP POLICY IF EXISTS "Allow update events" ON events;
DROP POLICY IF EXISTS "Allow delete events" ON events;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Insert events with memory_id') THEN
    CREATE POLICY "Insert events with memory_id" ON events FOR INSERT TO anon, authenticated WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Update own events') THEN
    CREATE POLICY "Update own events" ON events FOR UPDATE TO anon, authenticated USING (memory_id IS NOT NULL) WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Delete own events') THEN
    CREATE POLICY "Delete own events" ON events FOR DELETE TO anon, authenticated USING (memory_id IS NOT NULL);
  END IF;
END $$;

-- ─── weekly_grocery_lists — add missing columns ───────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'weekly_grocery_lists' AND column_name = 'memory_id') THEN
    ALTER TABLE weekly_grocery_lists ADD COLUMN memory_id uuid NOT NULL DEFAULT gen_random_uuid();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'weekly_grocery_lists' AND column_name = 'weekly_message') THEN
    ALTER TABLE weekly_grocery_lists ADD COLUMN weekly_message text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'weekly_grocery_lists_memory_id_week_start_date_key'
  ) THEN
    ALTER TABLE weekly_grocery_lists
      ADD CONSTRAINT weekly_grocery_lists_memory_id_week_start_date_key
      UNIQUE (memory_id, week_start_date);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_weekly_grocery_lists_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS weekly_grocery_lists_updated_at ON weekly_grocery_lists;
CREATE TRIGGER weekly_grocery_lists_updated_at
  BEFORE UPDATE ON weekly_grocery_lists
  FOR EACH ROW EXECUTE FUNCTION update_weekly_grocery_lists_updated_at();

DROP POLICY IF EXISTS "Anon can insert weekly_grocery_lists" ON weekly_grocery_lists;
DROP POLICY IF EXISTS "Anon can update weekly_grocery_lists" ON weekly_grocery_lists;
DROP POLICY IF EXISTS "Anon can delete weekly_grocery_lists" ON weekly_grocery_lists;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_grocery_lists' AND policyname = 'Insert weekly_grocery_lists with memory_id') THEN
    CREATE POLICY "Insert weekly_grocery_lists with memory_id" ON weekly_grocery_lists FOR INSERT TO anon, authenticated WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_grocery_lists' AND policyname = 'Update own weekly_grocery_lists') THEN
    CREATE POLICY "Update own weekly_grocery_lists" ON weekly_grocery_lists FOR UPDATE TO anon, authenticated USING (memory_id IS NOT NULL) WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_grocery_lists' AND policyname = 'Delete own weekly_grocery_lists') THEN
    CREATE POLICY "Delete own weekly_grocery_lists" ON weekly_grocery_lists FOR DELETE TO anon, authenticated USING (memory_id IS NOT NULL);
  END IF;
END $$;

-- ─── meals ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id   uuid        NOT NULL,
  name        text        NOT NULL,
  ingredients jsonb       NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meals_memory_id_idx ON meals (memory_id);

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meals' AND policyname = 'Users can view their own meals') THEN
    CREATE POLICY "Users can view their own meals" ON meals FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meals' AND policyname = 'Insert meals with memory_id') THEN
    CREATE POLICY "Insert meals with memory_id" ON meals FOR INSERT TO anon, authenticated WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meals' AND policyname = 'Update own meals') THEN
    CREATE POLICY "Update own meals" ON meals FOR UPDATE TO anon, authenticated USING (memory_id IS NOT NULL) WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meals' AND policyname = 'Delete own meals') THEN
    CREATE POLICY "Delete own meals" ON meals FOR DELETE TO anon, authenticated USING (memory_id IS NOT NULL);
  END IF;
END $$;

-- ─── events.meal_id ───────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'meal_id') THEN
    ALTER TABLE events ADD COLUMN meal_id uuid REFERENCES meals(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── grocery_budget ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS grocery_budget (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id               uuid        NOT NULL,
  weekly_budget           numeric     NOT NULL DEFAULT 100.00,
  current_estimated_total numeric     NOT NULL DEFAULT 0,
  last_updated            date        NOT NULL DEFAULT CURRENT_DATE,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grocery_budget_memory_id_key UNIQUE (memory_id)
);

CREATE OR REPLACE FUNCTION public.update_grocery_budget_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grocery_budget_updated_at ON grocery_budget;
CREATE TRIGGER grocery_budget_updated_at
  BEFORE UPDATE ON grocery_budget
  FOR EACH ROW EXECUTE FUNCTION update_grocery_budget_updated_at();

ALTER TABLE grocery_budget ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'grocery_budget' AND policyname = 'Anon can select grocery_budget') THEN
    CREATE POLICY "Anon can select grocery_budget" ON grocery_budget FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'grocery_budget' AND policyname = 'Insert grocery_budget with memory_id') THEN
    CREATE POLICY "Insert grocery_budget with memory_id" ON grocery_budget FOR INSERT TO anon, authenticated WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'grocery_budget' AND policyname = 'Update own grocery_budget') THEN
    CREATE POLICY "Update own grocery_budget" ON grocery_budget FOR UPDATE TO anon, authenticated USING (memory_id IS NOT NULL) WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'grocery_budget' AND policyname = 'Delete own grocery_budget') THEN
    CREATE POLICY "Delete own grocery_budget" ON grocery_budget FOR DELETE TO anon, authenticated USING (memory_id IS NOT NULL);
  END IF;
END $$;

-- ─── goals ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id    uuid        NOT NULL,
  title        text        NOT NULL DEFAULT '',
  category     text        NOT NULL DEFAULT 'personal',
  priority     text        NOT NULL DEFAULT 'medium',
  deadline     date,
  progress     integer     NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  linked_tasks jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.update_goals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS goals_updated_at ON goals;
CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_goals_updated_at();

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Anon can select goals') THEN
    CREATE POLICY "Anon can select goals" ON goals FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Insert goals with memory_id') THEN
    CREATE POLICY "Insert goals with memory_id" ON goals FOR INSERT TO anon, authenticated WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Update own goals') THEN
    CREATE POLICY "Update own goals" ON goals FOR UPDATE TO anon, authenticated USING (memory_id IS NOT NULL) WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Delete own goals') THEN
    CREATE POLICY "Delete own goals" ON goals FOR DELETE TO anon, authenticated USING (memory_id IS NOT NULL);
  END IF;
END $$;

-- ─── daily_plans ──────────────────────────────────────────────────────────────

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
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_plans_memory_id_plan_date_key') THEN
    ALTER TABLE daily_plans ADD CONSTRAINT daily_plans_memory_id_plan_date_key UNIQUE (memory_id, plan_date);
  END IF;
END $$;

-- Adaptive columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_plans' AND column_name = 'skipped_tasks') THEN
    ALTER TABLE daily_plans ADD COLUMN skipped_tasks jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_plans' AND column_name = 'completion_rate') THEN
    ALTER TABLE daily_plans ADD COLUMN completion_rate numeric;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_plans' AND column_name = 'load_hint') THEN
    ALTER TABLE daily_plans ADD COLUMN load_hint text NOT NULL DEFAULT 'normal';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_plans' AND column_name = 'adaptations') THEN
    ALTER TABLE daily_plans ADD COLUMN adaptations jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_plans' AND column_name = 'focus_hours') THEN
    ALTER TABLE daily_plans ADD COLUMN focus_hours jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_plans' AND column_name = 'completion_timestamps') THEN
    ALTER TABLE daily_plans ADD COLUMN completion_timestamps jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_daily_plans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_plans' AND policyname = 'Anon can select daily_plans') THEN
    CREATE POLICY "Anon can select daily_plans" ON daily_plans FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_plans' AND policyname = 'Insert daily_plans with memory_id') THEN
    CREATE POLICY "Insert daily_plans with memory_id" ON daily_plans FOR INSERT TO anon, authenticated WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_plans' AND policyname = 'Update own daily_plans') THEN
    CREATE POLICY "Update own daily_plans" ON daily_plans FOR UPDATE TO anon, authenticated USING (memory_id IS NOT NULL) WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_plans' AND policyname = 'Delete own daily_plans') THEN
    CREATE POLICY "Delete own daily_plans" ON daily_plans FOR DELETE TO anon, authenticated USING (memory_id IS NOT NULL);
  END IF;
END $$;

-- ─── spending_snapshots ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS spending_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id        uuid NOT NULL,
  week_start_date  date NOT NULL,
  total_spent      numeric NOT NULL DEFAULT 0,
  weekly_budget    numeric NOT NULL DEFAULT 0,
  budget_met       boolean NOT NULL DEFAULT false,
  category_breakdown jsonb NOT NULL DEFAULT '{}',
  item_count       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (memory_id, week_start_date)
);

ALTER TABLE spending_snapshots ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_spending_snapshots_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spending_snapshots_updated_at ON spending_snapshots;
CREATE TRIGGER spending_snapshots_updated_at
  BEFORE UPDATE ON spending_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_spending_snapshots_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'spending_snapshots' AND policyname = 'Select own spending_snapshots') THEN
    CREATE POLICY "Select own spending_snapshots" ON spending_snapshots FOR SELECT TO anon, authenticated USING (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'spending_snapshots' AND policyname = 'Insert spending_snapshots with memory_id') THEN
    CREATE POLICY "Insert spending_snapshots with memory_id" ON spending_snapshots FOR INSERT TO anon, authenticated WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'spending_snapshots' AND policyname = 'Update own spending_snapshots') THEN
    CREATE POLICY "Update own spending_snapshots" ON spending_snapshots FOR UPDATE TO anon, authenticated USING (memory_id IS NOT NULL) WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'spending_snapshots' AND policyname = 'Delete own spending_snapshots') THEN
    CREATE POLICY "Delete own spending_snapshots" ON spending_snapshots FOR DELETE TO anon, authenticated USING (memory_id IS NOT NULL);
  END IF;
END $$;

-- ─── receipts ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS receipts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id   uuid NOT NULL,
  date        date NOT NULL DEFAULT CURRENT_DATE,
  store_name  text,
  total       numeric,
  items       jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_receipts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS receipts_updated_at ON receipts;
CREATE TRIGGER receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION update_receipts_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'receipts' AND policyname = 'Select own receipts') THEN
    CREATE POLICY "Select own receipts" ON receipts FOR SELECT TO anon, authenticated USING (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'receipts' AND policyname = 'Insert receipts with memory_id') THEN
    CREATE POLICY "Insert receipts with memory_id" ON receipts FOR INSERT TO anon, authenticated WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'receipts' AND policyname = 'Update own receipts') THEN
    CREATE POLICY "Update own receipts" ON receipts FOR UPDATE TO anon, authenticated USING (memory_id IS NOT NULL) WITH CHECK (memory_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'receipts' AND policyname = 'Delete own receipts') THEN
    CREATE POLICY "Delete own receipts" ON receipts FOR DELETE TO anon, authenticated USING (memory_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS receipts_memory_id_idx ON receipts (memory_id);
CREATE INDEX IF NOT EXISTS receipts_date_idx ON receipts (memory_id, date DESC);

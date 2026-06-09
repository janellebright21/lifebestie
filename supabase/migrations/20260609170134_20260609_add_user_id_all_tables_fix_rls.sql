/*
  # Add user_id to all tables and replace memory_id-based RLS with auth.uid() policies

  All 12 user-data tables gain a user_id column (FK → auth.users).
  Old policies that used (memory_id IS NOT NULL) or (true) as their
  condition are dropped and replaced with auth.uid() = user_id checks.
*/

-- ─── user_memory ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_memory' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE user_memory ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_memory_user_id_idx ON user_memory (user_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_memory'::regclass AND conname = 'user_memory_user_id_key'
  ) THEN
    ALTER TABLE user_memory ADD CONSTRAINT user_memory_user_id_key UNIQUE (user_id);
  END IF;
END $$;

ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select user_memory" ON user_memory;
DROP POLICY IF EXISTS "Insert user_memory with id" ON user_memory;
DROP POLICY IF EXISTS "Update own user_memory" ON user_memory;
DROP POLICY IF EXISTS "Users can view own memory" ON user_memory;
DROP POLICY IF EXISTS "Users can insert own memory" ON user_memory;
DROP POLICY IF EXISTS "Users can update own memory" ON user_memory;
DROP POLICY IF EXISTS "Users can delete own memory" ON user_memory;

CREATE POLICY "user_memory_select" ON user_memory FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_memory_insert" ON user_memory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_memory_update" ON user_memory FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_memory_delete" ON user_memory FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── tasks ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks (user_id);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to tasks" ON tasks;
DROP POLICY IF EXISTS "Insert tasks with memory_id" ON tasks;
DROP POLICY IF EXISTS "Update own tasks" ON tasks;
DROP POLICY IF EXISTS "Delete own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;

CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── events ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE events ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS events_user_id_idx ON events (user_id);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to events" ON events;
DROP POLICY IF EXISTS "Insert events with memory_id" ON events;
DROP POLICY IF EXISTS "Update own events" ON events;
DROP POLICY IF EXISTS "Delete own events" ON events;
DROP POLICY IF EXISTS "Users can view own events" ON events;
DROP POLICY IF EXISTS "Users can insert own events" ON events;
DROP POLICY IF EXISTS "Users can update own events" ON events;
DROP POLICY IF EXISTS "Users can delete own events" ON events;

CREATE POLICY "events_select" ON events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "events_insert" ON events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "events_update" ON events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "events_delete" ON events FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── grocery_items ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grocery_items' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE grocery_items ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS grocery_items_user_id_idx ON grocery_items (user_id);
ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to grocery_items" ON grocery_items;
DROP POLICY IF EXISTS "Insert grocery_items with memory_id" ON grocery_items;
DROP POLICY IF EXISTS "Update own grocery_items" ON grocery_items;
DROP POLICY IF EXISTS "Delete own grocery_items" ON grocery_items;

CREATE POLICY "grocery_items_select" ON grocery_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "grocery_items_insert" ON grocery_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "grocery_items_update" ON grocery_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "grocery_items_delete" ON grocery_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── weekly_grocery_lists ─────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_grocery_lists' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE weekly_grocery_lists ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS weekly_grocery_lists_user_id_idx ON weekly_grocery_lists (user_id);

-- Replace memory_id-based unique constraint with per-user one
ALTER TABLE weekly_grocery_lists DROP CONSTRAINT IF EXISTS weekly_grocery_lists_memory_id_week_start_date_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'weekly_grocery_lists'::regclass AND conname = 'weekly_grocery_lists_user_id_week_start_date_key'
  ) THEN
    ALTER TABLE weekly_grocery_lists ADD CONSTRAINT weekly_grocery_lists_user_id_week_start_date_key UNIQUE (user_id, week_start_date);
  END IF;
END $$;

ALTER TABLE weekly_grocery_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon can select weekly_grocery_lists" ON weekly_grocery_lists;
DROP POLICY IF EXISTS "Insert weekly_grocery_lists with memory_id" ON weekly_grocery_lists;
DROP POLICY IF EXISTS "Update own weekly_grocery_lists" ON weekly_grocery_lists;
DROP POLICY IF EXISTS "Delete own weekly_grocery_lists" ON weekly_grocery_lists;
DROP POLICY IF EXISTS "Users manage own weekly grocery lists" ON weekly_grocery_lists;

CREATE POLICY "wgl_select" ON weekly_grocery_lists FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wgl_insert" ON weekly_grocery_lists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wgl_update" ON weekly_grocery_lists FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wgl_delete" ON weekly_grocery_lists FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── goals ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE goals ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS goals_user_id_idx ON goals (user_id);
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon can select goals" ON goals;
DROP POLICY IF EXISTS "Insert goals with memory_id" ON goals;
DROP POLICY IF EXISTS "Update own goals" ON goals;
DROP POLICY IF EXISTS "Delete own goals" ON goals;
DROP POLICY IF EXISTS "Users can view own goals" ON goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
DROP POLICY IF EXISTS "Users can update own goals" ON goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON goals;

CREATE POLICY "goals_select" ON goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "goals_insert" ON goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_update" ON goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_delete" ON goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── category_colors ──────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'category_colors' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE category_colors ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE category_colors DROP CONSTRAINT IF EXISTS category_colors_category_key;
CREATE INDEX IF NOT EXISTS category_colors_user_id_idx ON category_colors (user_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'category_colors'::regclass AND conname = 'category_colors_user_id_category_key'
  ) THEN
    ALTER TABLE category_colors ADD CONSTRAINT category_colors_user_id_category_key UNIQUE (user_id, category);
  END IF;
END $$;

ALTER TABLE category_colors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select on category_colors" ON category_colors;
DROP POLICY IF EXISTS "Allow public insert on category_colors" ON category_colors;
DROP POLICY IF EXISTS "Allow public update on category_colors" ON category_colors;
DROP POLICY IF EXISTS "Users can view own category colors" ON category_colors;
DROP POLICY IF EXISTS "Users can insert own category colors" ON category_colors;
DROP POLICY IF EXISTS "Users can update own category colors" ON category_colors;
DROP POLICY IF EXISTS "Users can delete own category colors" ON category_colors;

CREATE POLICY "cat_colors_select" ON category_colors FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cat_colors_insert" ON category_colors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cat_colors_update" ON category_colors FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cat_colors_delete" ON category_colors FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── meals ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meals' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE meals ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meals' AND column_name = 'meal_type'
  ) THEN
    ALTER TABLE meals ADD COLUMN meal_type text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meals' AND column_name = 'meal_date'
  ) THEN
    ALTER TABLE meals ADD COLUMN meal_date date;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS meals_user_id_idx ON meals (user_id);
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own meals" ON meals;
DROP POLICY IF EXISTS "Insert meals with memory_id" ON meals;
DROP POLICY IF EXISTS "Update own meals" ON meals;
DROP POLICY IF EXISTS "Delete own meals" ON meals;
DROP POLICY IF EXISTS "Users can view own meals" ON meals;
DROP POLICY IF EXISTS "Users can insert own meals" ON meals;
DROP POLICY IF EXISTS "Users can update own meals" ON meals;
DROP POLICY IF EXISTS "Users can delete own meals" ON meals;
DROP POLICY IF EXISTS "Users manage own meals" ON meals;

CREATE POLICY "meals_select" ON meals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "meals_insert" ON meals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meals_update" ON meals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meals_delete" ON meals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── grocery_budget ───────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grocery_budget' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE grocery_budget ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE grocery_budget DROP CONSTRAINT IF EXISTS grocery_budget_memory_id_key;
CREATE INDEX IF NOT EXISTS grocery_budget_user_id_idx ON grocery_budget (user_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'grocery_budget'::regclass AND conname = 'grocery_budget_user_id_key'
  ) THEN
    ALTER TABLE grocery_budget ADD CONSTRAINT grocery_budget_user_id_key UNIQUE (user_id);
  END IF;
END $$;

ALTER TABLE grocery_budget ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon can select grocery_budget" ON grocery_budget;
DROP POLICY IF EXISTS "Insert grocery_budget with memory_id" ON grocery_budget;
DROP POLICY IF EXISTS "Update own grocery_budget" ON grocery_budget;
DROP POLICY IF EXISTS "Delete own grocery_budget" ON grocery_budget;
DROP POLICY IF EXISTS "Users can view own grocery budget" ON grocery_budget;
DROP POLICY IF EXISTS "Users can insert own grocery budget" ON grocery_budget;
DROP POLICY IF EXISTS "Users can update own grocery budget" ON grocery_budget;
DROP POLICY IF EXISTS "Users can delete own grocery budget" ON grocery_budget;
DROP POLICY IF EXISTS "Users manage own grocery budget" ON grocery_budget;

CREATE POLICY "gb_select" ON grocery_budget FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "gb_insert" ON grocery_budget FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gb_update" ON grocery_budget FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gb_delete" ON grocery_budget FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── spending_snapshots ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spending_snapshots' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE spending_snapshots ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE spending_snapshots DROP CONSTRAINT IF EXISTS spending_snapshots_memory_id_week_start_date_key;
CREATE INDEX IF NOT EXISTS spending_snapshots_user_id_idx ON spending_snapshots (user_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'spending_snapshots'::regclass AND conname = 'spending_snapshots_user_id_week_start_date_key'
  ) THEN
    ALTER TABLE spending_snapshots ADD CONSTRAINT spending_snapshots_user_id_week_start_date_key UNIQUE (user_id, week_start_date);
  END IF;
END $$;

ALTER TABLE spending_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Select own spending_snapshots" ON spending_snapshots;
DROP POLICY IF EXISTS "Insert spending_snapshots with memory_id" ON spending_snapshots;
DROP POLICY IF EXISTS "Update own spending_snapshots" ON spending_snapshots;
DROP POLICY IF EXISTS "Delete own spending_snapshots" ON spending_snapshots;
DROP POLICY IF EXISTS "Users can view own spending snapshots" ON spending_snapshots;
DROP POLICY IF EXISTS "Users can insert own spending snapshots" ON spending_snapshots;
DROP POLICY IF EXISTS "Users can update own spending snapshots" ON spending_snapshots;
DROP POLICY IF EXISTS "Users can delete own spending snapshots" ON spending_snapshots;

CREATE POLICY "ss_select" ON spending_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ss_insert" ON spending_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_update" ON spending_snapshots FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_delete" ON spending_snapshots FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── receipts ─────────────────────────────────────────────────────────────────
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
DROP POLICY IF EXISTS "Select own receipts" ON receipts;
DROP POLICY IF EXISTS "Insert receipts with memory_id" ON receipts;
DROP POLICY IF EXISTS "Update own receipts" ON receipts;
DROP POLICY IF EXISTS "Delete own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can view own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can insert own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can update own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can delete own receipts" ON receipts;

CREATE POLICY "receipts_select" ON receipts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "receipts_insert" ON receipts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "receipts_update" ON receipts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "receipts_delete" ON receipts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── daily_plans ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_plans' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE daily_plans ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE daily_plans DROP CONSTRAINT IF EXISTS daily_plans_memory_id_plan_date_key;
CREATE INDEX IF NOT EXISTS daily_plans_user_id_idx ON daily_plans (user_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'daily_plans'::regclass AND conname = 'daily_plans_user_id_plan_date_key'
  ) THEN
    ALTER TABLE daily_plans ADD CONSTRAINT daily_plans_user_id_plan_date_key UNIQUE (user_id, plan_date);
  END IF;
END $$;

ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon can select daily_plans" ON daily_plans;
DROP POLICY IF EXISTS "Insert daily_plans with memory_id" ON daily_plans;
DROP POLICY IF EXISTS "Update own daily_plans" ON daily_plans;
DROP POLICY IF EXISTS "Delete own daily_plans" ON daily_plans;
DROP POLICY IF EXISTS "Users can view own daily plans" ON daily_plans;
DROP POLICY IF EXISTS "Users can insert own daily plans" ON daily_plans;
DROP POLICY IF EXISTS "Users can update own daily plans" ON daily_plans;
DROP POLICY IF EXISTS "Users can delete own daily plans" ON daily_plans;

CREATE POLICY "dp_select" ON daily_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "dp_insert" ON daily_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dp_update" ON daily_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dp_delete" ON daily_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);

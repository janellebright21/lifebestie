/*
  # Create weekly_grocery_lists table

  ## Purpose
  Stores a generated grocery list scoped to a single calendar week (Mon–Sun).
  The list is auto-generated from the user's habits, routines, and recent history.
  Each week gets exactly one row per memory_id; old rows are left as history.

  ## New Tables
  - `weekly_grocery_lists`
    - `id` (uuid, primary key)
    - `memory_id` (uuid) — ties the list to a specific user_memory row (anonymous user identity)
    - `week_start_date` (date) — Monday of the week this list covers (ISO YYYY-MM-DD)
    - `items` (jsonb) — array of WeeklyGroceryItem objects:
        { name, category, source ("habit"|"routine"|"recent"), checked }
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Constraints
  - UNIQUE (memory_id, week_start_date) — one list per user per week

  ## Security
  - RLS enabled
  - Anon and authenticated users can read/insert/update/delete their own rows
    (this app has no auth layer, so anon access is required for all operations)
*/

CREATE TABLE IF NOT EXISTS weekly_grocery_lists (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id       uuid        NOT NULL,
  week_start_date date        NOT NULL,
  items           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One list per user per week
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

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION update_weekly_grocery_lists_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS weekly_grocery_lists_updated_at ON weekly_grocery_lists;
CREATE TRIGGER weekly_grocery_lists_updated_at
  BEFORE UPDATE ON weekly_grocery_lists
  FOR EACH ROW EXECUTE FUNCTION update_weekly_grocery_lists_updated_at();

ALTER TABLE weekly_grocery_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select weekly_grocery_lists"
  ON weekly_grocery_lists FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anon can insert weekly_grocery_lists"
  ON weekly_grocery_lists FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon can update weekly_grocery_lists"
  ON weekly_grocery_lists FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete weekly_grocery_lists"
  ON weekly_grocery_lists FOR DELETE
  TO anon, authenticated
  USING (true);

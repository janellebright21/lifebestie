/*
  # Create spending_snapshots table

  ## Purpose
  Tracks weekly grocery spending history per user to enable trend analysis,
  pattern identification, and smarter budget suggestions over time.

  ## New Tables
  - `spending_snapshots`
    - `id` (uuid, pk)
    - `memory_id` (uuid) — ties to user_memory.id, same pattern as all other tables
    - `week_start_date` (date) — ISO Monday of the tracked week (YYYY-MM-DD)
    - `total_spent` (numeric) — sum of non-skipped item prices for that week
    - `weekly_budget` (numeric) — the budget target set that week
    - `budget_met` (boolean) — true if total_spent <= weekly_budget
    - `category_breakdown` (jsonb) — object mapping category name → total cost, e.g. {"Produce": 18.50, "Snacks": 12.00}
    - `item_count` (integer) — number of non-skipped items
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
    - UNIQUE (memory_id, week_start_date) — one snapshot per user per week, upsertable

  ## Security
  - RLS enabled, matching the pattern of all other tables in this project
  - anon + authenticated can insert/update/delete rows where memory_id IS NOT NULL
  - SELECT is open (memory_id IS NOT NULL guard) so the client can read its own history
*/

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

-- Auto-update updated_at on row modification
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

CREATE TRIGGER spending_snapshots_updated_at
  BEFORE UPDATE ON spending_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_spending_snapshots_updated_at();

-- SELECT: only own rows
CREATE POLICY "Select own spending_snapshots"
  ON spending_snapshots FOR SELECT
  TO anon, authenticated
  USING (memory_id IS NOT NULL);

-- INSERT: must supply memory_id
CREATE POLICY "Insert spending_snapshots with memory_id"
  ON spending_snapshots FOR INSERT
  TO anon, authenticated
  WITH CHECK (memory_id IS NOT NULL);

-- UPDATE: can only update rows with a valid memory_id
CREATE POLICY "Update own spending_snapshots"
  ON spending_snapshots FOR UPDATE
  TO anon, authenticated
  USING (memory_id IS NOT NULL)
  WITH CHECK (memory_id IS NOT NULL);

-- DELETE
CREATE POLICY "Delete own spending_snapshots"
  ON spending_snapshots FOR DELETE
  TO anon, authenticated
  USING (memory_id IS NOT NULL);

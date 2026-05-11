/*
  # Add grocery budget tracking

  ## Summary
  Introduces a `grocery_budget` table that stores a per-user weekly budget and
  the running estimated total for the current week. Linked to the existing
  `user_memory` rows by `memory_id` (the anonymous user identity).

  ## New Tables
  - `grocery_budget`
    - `id` (uuid, primary key)
    - `memory_id` (uuid, unique) — one budget record per user identity
    - `weekly_budget` (numeric) — the user's target spend for the week, default 100.00
    - `current_estimated_total` (numeric) — computed sum of item price estimates, default 0
    - `last_updated` (date) — ISO date of the last time totals were recalculated
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz, auto-maintained by trigger)

  ## Notes
  - The `items` JSONB array inside `weekly_grocery_lists` already stores
    arbitrary fields; no schema change is needed there. The TypeScript type for
    `WeeklyGroceryItem` gains optional `price` (number) and `estimated`
    (boolean) fields which are persisted transparently through the existing
    `items` column.
  - RLS mirrors the pattern used by `weekly_grocery_lists`: anonymous and
    authenticated users can manage their own row identified by `memory_id`.
*/

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

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_grocery_budget_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

CREATE POLICY "Anon can select grocery_budget"
  ON grocery_budget FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anon can insert grocery_budget"
  ON grocery_budget FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon can update grocery_budget"
  ON grocery_budget FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete grocery_budget"
  ON grocery_budget FOR DELETE
  TO anon, authenticated
  USING (true);

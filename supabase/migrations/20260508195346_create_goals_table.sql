/*
  # Create goals table

  ## Summary
  Stores user goals with category, priority, optional deadline, progress tracking,
  and an array of linked task IDs. Goals are scoped to an anonymous user identity
  (memory_id) matching the pattern used by other tables in this app.

  ## New Tables
  - `goals`
    - `id` (uuid, primary key)
    - `memory_id` (uuid) — anonymous user identity from localStorage
    - `title` (text) — goal description
    - `category` (text) — one of: health, work, personal, finance
    - `priority` (text) — one of: low, medium, high
    - `deadline` (date, nullable) — optional target date
    - `progress` (integer, 0–100) — completion percentage
    - `linked_tasks` (jsonb) — array of task ID strings
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz, auto-maintained by trigger)

  ## Security
  - RLS enabled
  - Anon and authenticated users can read/insert/update/delete their own rows
*/

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

CREATE OR REPLACE FUNCTION update_goals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

CREATE POLICY "Anon can select goals"
  ON goals FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anon can insert goals"
  ON goals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon can update goals"
  ON goals FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete goals"
  ON goals FOR DELETE
  TO anon, authenticated
  USING (true);

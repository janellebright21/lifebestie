/*
  # Create user_memory table

  Stores persistent memory for the LifeBestie AI assistant.

  1. New Tables
    - `user_memory`
      - `id` (uuid, primary key) — single row per user session
      - `routines` (jsonb) — array of routine objects {name, time, days[], tasks[]}
      - `preferences` (jsonb) — {preferredWakeTime, busyDays[], commonGroceries[]}
      - `history` (jsonb) — array of {date, actions[]} entries
      - `updated_at` (timestamptz) — last modified timestamp

  2. Security
    - RLS enabled
    - Public anon read/write allowed (single-user app, no auth layer)

  Notes
    - A single row keyed by a fixed session ID is used since this is a private, single-user app.
    - updated_at is automatically refreshed via trigger on each update.
*/

CREATE TABLE IF NOT EXISTS user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routines jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{
    "preferredWakeTime": "",
    "busyDays": [],
    "commonGroceries": []
  }'::jsonb,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select user_memory"
  ON user_memory FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert user_memory"
  ON user_memory FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update user_memory"
  ON user_memory FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_user_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_memory_updated_at
  BEFORE UPDATE ON user_memory
  FOR EACH ROW EXECUTE FUNCTION update_user_memory_updated_at();

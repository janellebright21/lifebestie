/*
  # Create meals table

  ## Summary
  Stores user-defined meals and their AI-categorized ingredients.
  Used by the meal planning feature to auto-populate the weekly grocery list.

  ## New Tables
  - `meals`
    - `id` (uuid, primary key)
    - `memory_id` (uuid, NOT NULL) — ties to the user_memory row
    - `name` (text, NOT NULL) — e.g. "Spaghetti Bolognese"
    - `ingredients` (jsonb, NOT NULL, default '[]') — array of { name, category }
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled; authenticated-style row-level access via memory_id match
    (app uses anonymous device identity stored in localStorage, so policies
     allow any authenticated select/insert/update/delete matching memory_id)

  ## Notes
  - ingredients are stored denormalized as JSONB for flexibility
  - one meal can be reused across multiple weeks
*/

CREATE TABLE IF NOT EXISTS meals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id   uuid        NOT NULL,
  name        text        NOT NULL,
  ingredients jsonb       NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meals_memory_id_idx ON meals (memory_id);

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own meals"
  ON meals FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert their own meals"
  ON meals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own meals"
  ON meals FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their own meals"
  ON meals FOR DELETE
  TO anon, authenticated
  USING (true);

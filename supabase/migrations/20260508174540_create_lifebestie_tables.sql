/*
  # LifeBestie App - Initial Schema

  1. New Tables
    - `tasks`
      - `id` (uuid, primary key)
      - `title` (text)
      - `completed` (boolean, default false)
      - `due_date` (date, nullable)
      - `created_at` (timestamptz)

    - `events`
      - `id` (uuid, primary key)
      - `title` (text)
      - `event_date` (date)
      - `event_time` (text, nullable - stored as HH:MM string)
      - `created_at` (timestamptz)

    - `grocery_items`
      - `id` (uuid, primary key)
      - `name` (text)
      - `category` (text - Produce, Dairy, Pantry, Snacks)
      - `checked` (boolean, default false)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Policies allow public access (no auth in this version - single user app)

  Note: This is a single-user personal assistant app with no auth layer in this version.
  RLS policies allow anonymous access since there is only one user.
*/

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to tasks"
  ON tasks FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert tasks"
  ON tasks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update tasks"
  ON tasks FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete tasks"
  ON tasks FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  event_time text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to events"
  ON events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert events"
  ON events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update events"
  ON events FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete events"
  ON events FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS grocery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Pantry',
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to grocery_items"
  ON grocery_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert grocery_items"
  ON grocery_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update grocery_items"
  ON grocery_items FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete grocery_items"
  ON grocery_items FOR DELETE
  TO anon, authenticated
  USING (true);

/*
  # Add category_colors table

  Stores the user's preferred pastel color key for each task/event category.

  1. New Tables
    - `category_colors`
      - `id` (uuid, primary key)
      - `category` (text, unique) – category name e.g. "Work", "Kids"
      - `color_key` (text) – one of the pastel palette keys (e.g. "blue", "pink")
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled
    - Public SELECT / INSERT / UPDATE (single-user app matching existing pattern)
*/

CREATE TABLE IF NOT EXISTS category_colors (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category    text        UNIQUE NOT NULL,
  color_key   text        NOT NULL DEFAULT 'blue',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE category_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on category_colors"
  ON category_colors FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on category_colors"
  ON category_colors FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on category_colors"
  ON category_colors FOR UPDATE
  USING (true)
  WITH CHECK (true);

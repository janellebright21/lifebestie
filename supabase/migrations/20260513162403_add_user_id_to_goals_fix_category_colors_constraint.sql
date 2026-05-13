/*
  # Fix user ownership across goals and category_colors

  1. Goals table
     - Add `user_id` column (uuid, FK to auth.users)
     - Add index for fast per-user queries

  2. Category_colors table
     - Drop the old global UNIQUE (category) constraint — it prevents multiple
       users from having their own color for the same category
     - Add UNIQUE (user_id, category) so each user can have their own per-category color
     - Add index for fast per-user queries

  3. Security
     - Enable RLS on goals (if not already)
     - Add per-user SELECT / INSERT / UPDATE / DELETE policies for goals
     - Refresh category_colors RLS policies to use user_id
*/

-- ── Goals: add user_id ────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE goals ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS goals_user_id_idx ON goals (user_id);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own goals" ON goals;
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goals" ON goals;
CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own goals" ON goals;
CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── Category_colors: replace global unique with per-user unique ───────────────

ALTER TABLE category_colors DROP CONSTRAINT IF EXISTS category_colors_category_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'category_colors'::regclass
      AND conname = 'category_colors_user_id_category_key'
  ) THEN
    ALTER TABLE category_colors ADD CONSTRAINT category_colors_user_id_category_key
      UNIQUE (user_id, category);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS category_colors_user_id_idx ON category_colors (user_id);

ALTER TABLE category_colors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own category colors" ON category_colors;
CREATE POLICY "Users can view own category colors"
  ON category_colors FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own category colors" ON category_colors;
CREATE POLICY "Users can insert own category colors"
  ON category_colors FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own category colors" ON category_colors;
CREATE POLICY "Users can update own category colors"
  ON category_colors FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own category colors" ON category_colors;
CREATE POLICY "Users can delete own category colors"
  ON category_colors FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

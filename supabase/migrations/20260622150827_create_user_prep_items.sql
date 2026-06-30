CREATE TABLE IF NOT EXISTS user_prep_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title)
);

ALTER TABLE user_prep_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_prep_items" ON user_prep_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_prep_items" ON user_prep_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_prep_items" ON user_prep_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_prep_items" ON user_prep_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- user_settings: per-user module preferences
-- disabled_modules stores only the IDs of modules the user has turned OFF
-- (sparse representation — empty array = all defaults active)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  disabled_modules text[] NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_user_settings" ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_user_settings" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_user_settings" ON user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_user_settings" ON user_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

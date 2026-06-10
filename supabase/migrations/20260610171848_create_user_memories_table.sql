CREATE TABLE IF NOT EXISTS user_memories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category     text NOT NULL CHECK (category IN (
    'Preference','Goal','Challenge','Routine','Favorite','Household','Wellness','Budget','Other'
  )),
  title        text NOT NULL,
  value        text NOT NULL DEFAULT '',
  source       text NOT NULL DEFAULT 'manual',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_memories_user_id_idx ON user_memories(user_id);

ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_memories" ON user_memories FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_memories" ON user_memories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_memories" ON user_memories FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_memories" ON user_memories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

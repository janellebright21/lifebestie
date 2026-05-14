/*
  # Tighten user_memory: one row per user + RLS policies

  - Add UNIQUE (user_id) so each auth user has exactly one memory record
  - Enable RLS and add per-user SELECT/INSERT/UPDATE/DELETE policies
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_memory'::regclass AND conname = 'user_memory_user_id_key'
  ) THEN
    ALTER TABLE user_memory ADD CONSTRAINT user_memory_user_id_key UNIQUE (user_id);
  END IF;
END $$;

ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own memory" ON user_memory;
CREATE POLICY "Users can view own memory" ON user_memory FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own memory" ON user_memory;
CREATE POLICY "Users can insert own memory" ON user_memory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own memory" ON user_memory;
CREATE POLICY "Users can update own memory" ON user_memory FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own memory" ON user_memory;
CREATE POLICY "Users can delete own memory" ON user_memory FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS bestie_relationship (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score               integer     NOT NULL DEFAULT 0,
  last_app_open_date  date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE bestie_relationship ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_bestie_relationship" ON bestie_relationship
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_bestie_relationship" ON bestie_relationship
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_bestie_relationship" ON bestie_relationship
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_bestie_relationship" ON bestie_relationship
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS tomorrow_prep_checklist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prep_date   date NOT NULL,
  checked_items text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, prep_date)
);

ALTER TABLE tomorrow_prep_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_prep_checklist" ON tomorrow_prep_checklist FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_prep_checklist" ON tomorrow_prep_checklist FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_prep_checklist" ON tomorrow_prep_checklist FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_prep_checklist" ON tomorrow_prep_checklist FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_tomorrow_prep_checklist_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tomorrow_prep_checklist_updated_at
  BEFORE UPDATE ON tomorrow_prep_checklist
  FOR EACH ROW EXECUTE FUNCTION update_tomorrow_prep_checklist_updated_at();

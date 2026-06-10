-- routine_templates: user-defined routines with ordered steps
CREATE TABLE IF NOT EXISTS routine_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT '',
  -- steps: ordered array of { id: uuid, title: text }
  steps       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_routine_templates" ON routine_templates FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_routine_templates" ON routine_templates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_routine_templates" ON routine_templates FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_routine_templates" ON routine_templates FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- routine_runs: a single execution of a routine on a given date
-- completed_step_ids: array of step UUIDs the user has checked off
CREATE TABLE IF NOT EXISTS routine_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id         uuid NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  run_date            date NOT NULL DEFAULT CURRENT_DATE,
  -- snapshot of steps at time of run so edits don't corrupt in-progress runs
  steps_snapshot      jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_step_ids  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE routine_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_routine_runs" ON routine_runs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_routine_runs" ON routine_runs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_routine_runs" ON routine_runs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_routine_runs" ON routine_runs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

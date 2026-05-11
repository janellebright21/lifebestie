/*
  # Add linked_goal_id and duration to tasks

  ## Summary
  Extends the existing tasks table with two optional columns needed for the
  goal-linked task system.

  ## Changes to `tasks`
  - `linked_goal_id` (uuid, nullable) — foreign key to goals.id (no cascade:
    tasks stay if a goal is deleted; app layer handles cleanup)
  - `duration` (integer, nullable) — estimated duration in minutes

  ## Notes
  - Both columns are nullable so existing rows are unaffected.
  - No RLS changes needed; tasks table already has permissive policies that
    match the goals table pattern.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'linked_goal_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN linked_goal_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'duration'
  ) THEN
    ALTER TABLE tasks ADD COLUMN duration integer;
  END IF;
END $$;

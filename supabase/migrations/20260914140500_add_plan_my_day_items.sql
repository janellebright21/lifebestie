/*
  # Persist Plan My Day editor state

  Stores the user-arranged Plan My Day items separately from the AI-generated
  high-impact and small-win lists. This is additive and leaves existing planner
  data, constraints, and RLS policies unchanged.

  planner_items stores task membership, order, time, notes, lock state, and the
  completion snapshot shown in the Plan My Day sheet. A nullable saved timestamp
  distinguishes an intentionally saved empty plan from a plan that has never
  been customized.
*/

ALTER TABLE daily_plans
  ADD COLUMN IF NOT EXISTS planner_items jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE daily_plans
  ADD COLUMN IF NOT EXISTS planner_items_saved_at timestamptz;

COMMENT ON COLUMN daily_plans.planner_items IS
  'User-arranged Plan My Day items, including order, time, notes, locks, and completion state.';

COMMENT ON COLUMN daily_plans.planner_items_saved_at IS
  'Last successful explicit save from the Plan My Day sheet; null means no customized plan has been saved.';

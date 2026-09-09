/*
  # Add plan_items jsonb column to daily_plans

  ## Summary
  Stores the Plan My Day sheet's ordered task list (PlanItem[]) per user per date.
  This is additive — the existing AI Morning Plan columns (high_impact, small_wins,
  message, etc.) are untouched and continue to power the Home DailyPlanCard.

  ## Column
  - `plan_items` (jsonb, NOT NULL, default '[]') — array of PlanItem objects:
    {
      taskId: string,     -- real database task id (never a temp id)
      title: string,
      priority: TaskPriority,
      category: TaskCategory,
      duration: number | null,
      time: string,       -- HH:MM or ''
      notes: string,
      completed: boolean,
      locked: boolean
    }

  ## Safety
  - Non-destructive: ADD COLUMN IF NOT EXISTS with a default
  - RLS already enforced by existing policies (dp_select/insert/update/delete)
  - No new constraints or indexes needed
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_plans' AND column_name = 'plan_items'
  ) THEN
    ALTER TABLE daily_plans ADD COLUMN plan_items jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

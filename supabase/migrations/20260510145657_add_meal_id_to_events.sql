/*
  # Add meal_id to events table

  Links a planner event to a saved meal so ingredients are
  automatically pushed to the weekly grocery list.

  1. Changes
    - `events` table gets a nullable `meal_id` (uuid) column referencing the meals table

  2. Notes
    - Foreign key is soft (no CASCADE) so deleting a meal doesn't delete the event
    - Column is nullable — most events have no linked meal
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'meal_id'
  ) THEN
    ALTER TABLE events ADD COLUMN meal_id uuid REFERENCES meals(id) ON DELETE SET NULL;
  END IF;
END $$;

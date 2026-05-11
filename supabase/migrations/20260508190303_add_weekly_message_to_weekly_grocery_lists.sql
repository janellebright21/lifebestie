/*
  # Add weekly_message to weekly_grocery_lists

  ## Changes
  - `weekly_grocery_lists`
    - New column `weekly_message` (text, nullable) — stores the AI-generated intro
      message shown at the top of the "This Week" grocery tab when a new list is created.
      Null means no message has been generated yet (e.g. lists created before this migration).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_grocery_lists' AND column_name = 'weekly_message'
  ) THEN
    ALTER TABLE weekly_grocery_lists ADD COLUMN weekly_message text;
  END IF;
END $$;

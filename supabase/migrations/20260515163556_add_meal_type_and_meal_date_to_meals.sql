/*
  # Add meal_type and meal_date to meals table

  New columns:
  - meal_type: text — one of 'Breakfast', 'Lunch', 'Dinner', 'Snack' (nullable for existing rows)
  - meal_date: date — the date this meal is planned for (nullable for existing rows)
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meals' AND column_name = 'meal_type'
  ) THEN
    ALTER TABLE meals ADD COLUMN meal_type text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meals' AND column_name = 'meal_date'
  ) THEN
    ALTER TABLE meals ADD COLUMN meal_date date;
  END IF;
END $$;

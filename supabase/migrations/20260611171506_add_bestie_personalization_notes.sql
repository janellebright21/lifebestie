-- Add soft personalization note columns to user_profiles
-- These store lightweight text preferences that the Bestie uses in greetings/suggestions.
-- All columns are nullable — nothing is required.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'planning_struggle'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN planning_struggle text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'meal_preference'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN meal_preference text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'wellness_preference'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN wellness_preference text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'encouragement_style'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN encouragement_style text;
  END IF;
END $$;

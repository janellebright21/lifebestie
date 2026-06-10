-- Add personalization preferences to the existing user_settings table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'theme'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN theme text NOT NULL DEFAULT 'cozy-coffee';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'bg_skin'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN bg_skin text NOT NULL DEFAULT 'solid';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'avatar_theme'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN avatar_theme text NOT NULL DEFAULT 'classic';
  END IF;
END $$;

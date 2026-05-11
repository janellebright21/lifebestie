/*
  # Add category, priority, location, and notes columns to tasks and events

  ## Changes to tasks table
  - `category` (text, default 'Other') — one of: Work, Kids, Home, Self-care, Other
  - `priority` (text, default 'medium') — one of: low, medium, high

  ## Changes to events table
  - `category` (text, default 'Other') — one of: Work, Kids, Home, Self-care, Other
  - `location` (text, nullable) — optional location string
  - `notes` (text, nullable) — optional free-text notes

  These columns are additive — existing rows get their defaults and all existing
  functionality is preserved.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'category'
  ) THEN
    ALTER TABLE tasks ADD COLUMN category text NOT NULL DEFAULT 'Other';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'priority'
  ) THEN
    ALTER TABLE tasks ADD COLUMN priority text NOT NULL DEFAULT 'medium';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'category'
  ) THEN
    ALTER TABLE events ADD COLUMN category text NOT NULL DEFAULT 'Other';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'location'
  ) THEN
    ALTER TABLE events ADD COLUMN location text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'notes'
  ) THEN
    ALTER TABLE events ADD COLUMN notes text;
  END IF;
END $$;

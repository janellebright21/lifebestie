/*
  # Add memory_id to tasks, events, and grocery_items

  ## Summary
  tasks, events, and grocery_items had no per-user identity column, making it
  impossible to write scoped RLS policies. This migration adds a nullable
  memory_id (uuid) to each table so that RLS can restrict access to the
  owning anonymous session.

  Existing rows are left with NULL memory_id — they remain accessible only
  through the old catch-all SELECT policies (which are left intact for now)
  and will be naturally replaced as users generate new data.

  ## Changes
  - `tasks`         — add column `memory_id uuid`
  - `events`        — add column `memory_id uuid`
  - `grocery_items` — add column `memory_id uuid`

  ## Notes
  - No foreign key constraint is added (user_memory rows are created lazily
    and we don't want inserts to fail if memory hasn't been initialised yet).
  - RLS policy replacement happens in the next migration.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'memory_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN memory_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'memory_id'
  ) THEN
    ALTER TABLE events ADD COLUMN memory_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grocery_items' AND column_name = 'memory_id'
  ) THEN
    ALTER TABLE grocery_items ADD COLUMN memory_id uuid;
  END IF;
END $$;

/*
  # Add commonGroceries to user_memory

  ## Changes
  - Adds a `common_groceries` JSONB column to `user_memory`
    - Stores an array of objects: { name, category, frequency, lastAdded }
    - Defaults to an empty JSON array
  - Existing rows get an empty array default automatically

  ## Notes
  - The old `commonGroceries` string array lived inside the `preferences` JSONB field.
    It is left in place for backward compatibility; the hook will ignore it going forward.
*/

ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS common_groceries jsonb NOT NULL DEFAULT '[]'::jsonb;

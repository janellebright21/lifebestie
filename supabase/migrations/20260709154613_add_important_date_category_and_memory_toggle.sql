/*
# Add ImportantDate memory category and memory_enabled setting

## Changes

### 1. user_memories table
- Widens the `category` CHECK constraint to include 'ImportantDate'.
- All existing rows are preserved; only the constraint is updated.

### 2. user_settings table
- Adds `memory_enabled` boolean column (NOT NULL, default true).
- When false: Emma will not suggest new memories, will not include memories in AI context,
  and will not save new memories from chat. Existing memories are NOT deleted.

## Security
- RLS policies on both tables are unchanged.
- No new tables; no data loss.
*/

-- 1. Widen the category constraint to include ImportantDate
ALTER TABLE user_memories
  DROP CONSTRAINT IF EXISTS user_memories_category_check;

ALTER TABLE user_memories
  ADD CONSTRAINT user_memories_category_check
  CHECK (category IN (
    'Preference',
    'Goal',
    'Challenge',
    'Routine',
    'Favorite',
    'Household',
    'Wellness',
    'Budget',
    'Other',
    'Meal',
    'WorkSchedule',
    'EncouragementStyle',
    'ImportantDate'
  ));

-- 2. Add memory_enabled to user_settings (safe; no existing data loss)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS memory_enabled boolean NOT NULL DEFAULT true;

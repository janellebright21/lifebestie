-- Expand the category constraint to include the required Emma memory categories.
-- Existing rows are preserved; only the CHECK constraint is widened.

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
    'EncouragementStyle'
  ));

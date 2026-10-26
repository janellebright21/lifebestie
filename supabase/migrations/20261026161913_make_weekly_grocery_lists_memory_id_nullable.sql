/*
# Make weekly_grocery_lists.memory_id nullable

## Why
The `memory_id` column was created NOT NULL in the original anonymous-user era.
The app now has authentication and uses `user_id` for ownership filtering.
The frontend hook (`useWeeklyGroceryList`) reads `memory_id` from localStorage,
which can be null if the user memory record hasn't been created yet — causing
insert failures with a NOT NULL constraint violation.

## Changes
- Alter `weekly_grocery_lists.memory_id` from NOT NULL to NULLABLE.
- No data is lost: existing rows keep their `memory_id` values.
- No RLS or policy changes: ownership is already enforced via `user_id`.
*/
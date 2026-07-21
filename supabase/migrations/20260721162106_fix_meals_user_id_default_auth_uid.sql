/*
# Fix meals table user_id column default

## Summary
The meals table's `user_id` column was added as nullable with no default.
The RLS policies require `auth.uid() = user_id` for all CRUD operations,
but without a `DEFAULT auth.uid()` on the column, any insert that omits
`user_id` (or passes null) silently fails the RLS check and returns zero rows.

## Changes
- Set `user_id` to `NOT NULL` and `DEFAULT auth.uid()` so inserts that omit
  `user_id` are automatically filled from the authenticated session.
- This matches the existing RLS policies (meals_select/insert/update/delete)
  which already enforce `auth.uid() = user_id`.

## Security
- RLS policies are unchanged — they already correctly scope to
  `auth.uid() = user_id` for `authenticated` role only.
- No `anon` access (this app requires sign-in).
- Users can only access their own meals; no weakening of security.

## Notes
1. Existing rows with null user_id are backfilled to a sentinel value
   is not possible (we don't know the owner). Those rows are orphaned
   from the old no-auth schema and will be invisible to all authenticated
   users. This is acceptable — they were created before user isolation
   was enforced.
2. The column default `auth.uid()` only applies on INSERT when the client
   omits the column. The frontend continues to pass `user_id` explicitly,
   but the default acts as a safety net.
*/

-- Backfill: set user_id on any null rows to a sentinel so the NOT NULL
-- constraint can be applied. These rows are already invisible (RLS
-- requires auth.uid() = user_id, and null never matches), so this
-- doesn't change behavior — it just lets us apply NOT NULL.
UPDATE meals SET user_id = '00000000-0000-0000-0000-000000000000'::uuid
WHERE user_id IS NULL;

ALTER TABLE meals
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

-- Re-index for faster user-scoped queries (index already exists, but
-- recreate to be safe and idempotent).
CREATE INDEX IF NOT EXISTS meals_user_id_idx ON meals (user_id);

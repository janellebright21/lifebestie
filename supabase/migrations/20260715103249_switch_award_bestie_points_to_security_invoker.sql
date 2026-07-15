/*
# Switch award_bestie_points to SECURITY INVOKER

## Summary
The Supabase security audit flagged that the `award_bestie_points` function runs
as SECURITY DEFINER, which means it executes with the privileges of the function
owner (postgres) regardless of who calls it. While the function had an internal
`auth.uid()` guard, SECURITY DEFINER is a higher-privilege execution model than
necessary here.

This migration switches the function to SECURITY INVOKER, so it runs with the
caller's own privileges and is subject to Row Level Security on the tables it
touches. To make this work, we add the missing INSERT and UPDATE policies to the
`bestie_relationship_rewards` table (it previously only had a SELECT policy and
relied on the SECURITY DEFINER function to bypass RLS for writes).

## Changes

### Function
- `award_bestie_points` is recreated as `SECURITY INVOKER` instead of
  `SECURITY DEFINER`. The function body and logic are unchanged.
- `search_path = public` is retained.

### Policies on bestie_relationship_rewards
- `insert_own_rewards`: allows authenticated users to INSERT their own reward
  rows (`WITH CHECK (auth.uid() = user_id)`).
- `update_own_rewards`: allows authenticated users to UPDATE their own reward
  rows. Needed for `INSERT ... ON CONFLICT DO UPDATE` if the conflict path
  performs an update (currently the function uses `DO NOTHING`, but the policy
  is added for completeness and future safety).

## Security
- The function now runs as the caller (SECURITY INVOKER), so RLS applies to all
  table operations inside it. An authenticated user can only affect their own
  rows in both `bestie_relationship_rewards` and `bestie_relationship`.
- The internal `auth.uid() IS NULL` guard remains as a defense-in-depth check.
- EXECUTE privilege remains granted to `authenticated` only (from the previous
  migration). `anon` and `PUBLIC` remain revoked.

## Important notes
1. The `bestie_relationship` table already has all four CRUD policies scoped to
   `auth.uid() = user_id`, so the function's upsert into that table works under
   SECURITY INVOKER without any policy changes.
2. This migration is idempotent — the policies are dropped before creation, and
   `CREATE OR REPLACE FUNCTION` is safe to re-run.
*/
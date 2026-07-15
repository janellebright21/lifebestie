/*
# Revoke EXECUTE on award_bestie_points from anon and PUBLIC

## Summary
The `award_bestie_points` function is a SECURITY DEFINER function that writes to
the `bestie_relationship_rewards` table (which has no INSERT/UPDATE/DELETE RLS
policies — only this function may write to it). The function already guards
against unauthenticated callers internally (`auth.uid() IS NULL` → raise
exception), but the Supabase security audit flagged that the `anon` role still
holds EXECUTE privilege on the function, making it callable via
`/rest/v1/rpc/award_bestie_points` without authentication.

This migration closes that gap at the privilege level by:
1. Re-revoking EXECUTE from PUBLIC (the original migration attempted this, but
   Supabase grants EXECUTE on new functions to `anon` automatically, so the
   revoke must be re-applied).
2. Explicitly revoking EXECUTE from the `anon` role.
3. Confirming the grant to `authenticated` (the only role that should call this).

## Changes
- `REVOKE EXECUTE ON FUNCTION award_bestie_points(...) FROM PUBLIC;`
- `REVOKE EXECUTE ON FUNCTION award_bestie_points(...) FROM anon;`
- `GRANT EXECUTE ON FUNCTION award_bestie_points(...) TO authenticated;`

## Security
- After this migration, only `authenticated` users can invoke the function.
- The function remains SECURITY DEFINER so it can write to the
  `bestie_relationship_rewards` table, which is locked down by RLS with no
  direct INSERT/UPDATE/DELETE policies.
- The internal `auth.uid()` check remains as a defense-in-depth guard.

## Important notes
1. The `anon` role loses the ability to call `award_bestie_points`. This is
   intentional — the frontend only calls this function after the user signs in
   (via `supabase.rpc` with an authenticated session), so anon access was never
   needed.
2. This migration is idempotent — re-running it has no adverse effect.
*/
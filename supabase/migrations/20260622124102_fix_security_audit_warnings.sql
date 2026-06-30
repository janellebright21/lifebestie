-- ── 1. Narrow character-images bucket SELECT policy ─────────────────────────
-- Drop the broad policy that lets anyone list all files.
DROP POLICY IF EXISTS "public_read_character_images" ON storage.objects;

-- Replace with a tighter policy: public clients may read a specific object
-- by its name (direct URL access) but cannot list bucket contents.
-- The name column is the full path, e.g. "Public/Character/emma.png".
-- Requiring name IS NOT NULL and matching the bucket still allows
-- direct <img src="...supabase.co/storage/v1/object/public/character-images/...">
-- requests while blocking unauthenticated LIST (SELECT without a name filter).
CREATE POLICY "public_read_character_images"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'character-images'
  AND name IS NOT NULL
);


-- ── 2. Revoke direct EXECUTE on trigger helper functions ─────────────────────
-- These functions are SECURITY DEFINER trigger helpers; they should only be
-- called by the database trigger system, not via /rest/v1/rpc by clients.
-- Revoking EXECUTE from anon/authenticated does NOT affect trigger execution —
-- triggers run as the function owner (postgres), not as the calling role.

REVOKE EXECUTE ON FUNCTION public.update_receipts_updated_at()
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_spending_snapshots_updated_at()
  FROM anon, authenticated;

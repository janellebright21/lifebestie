-- Add INSERT and UPDATE policies to bestie_relationship_rewards so the
-- SECURITY INVOKER function can write rows on behalf of the authenticated
-- owner. Previously the table only had a SELECT policy and relied on the
-- SECURITY DEFINER function to bypass RLS for writes.

DROP POLICY IF EXISTS "insert_own_rewards" ON bestie_relationship_rewards;
CREATE POLICY "insert_own_rewards" ON bestie_relationship_rewards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_rewards" ON bestie_relationship_rewards;
CREATE POLICY "update_own_rewards" ON bestie_relationship_rewards
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Recreate the function as SECURITY INVOKER. The body is unchanged.
CREATE OR REPLACE FUNCTION award_bestie_points(
  p_reward_type text,
  p_source_id   text,
  p_points      integer,
  p_description text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_new_score  integer;
  v_awarded    boolean := false;
BEGIN
  -- Verify the caller is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Attempt to insert the reward row.  ON CONFLICT DO NOTHING means this is a
  -- no-op when the same (user_id, reward_type, source_id) already exists.
  INSERT INTO bestie_relationship_rewards
    (user_id, reward_type, source_id, points, description)
  VALUES
    (v_user_id, p_reward_type, p_source_id, p_points, p_description)
  ON CONFLICT (user_id, reward_type, source_id) DO NOTHING;

  -- GET DIAGNOSTICS tells us if the INSERT actually affected a row.
  IF FOUND THEN
    v_awarded := true;

    -- Atomically create or increment the relationship score row.
    INSERT INTO bestie_relationship (user_id, score, last_app_open_date)
    VALUES (v_user_id, p_points, NULL)
    ON CONFLICT (user_id) DO UPDATE
      SET score      = bestie_relationship.score + p_points,
          updated_at = now();

    -- Read back the new score so the client can update its state.
    SELECT score INTO v_new_score
    FROM bestie_relationship
    WHERE user_id = v_user_id;
  ELSE
    -- Duplicate — return current score without changing it.
    SELECT COALESCE(score, 0) INTO v_new_score
    FROM bestie_relationship
    WHERE user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'awarded',    v_awarded,
    'new_score',  v_new_score
  );
END;
$$;

-- Re-assert the privilege grants after the function recreation.
-- CREATE OR REPLACE preserves existing grants, but we re-assert to be safe.
REVOKE EXECUTE ON FUNCTION award_bestie_points(text, text, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION award_bestie_points(text, text, integer, text) FROM anon;
GRANT  EXECUTE ON FUNCTION award_bestie_points(text, text, integer, text) TO authenticated;
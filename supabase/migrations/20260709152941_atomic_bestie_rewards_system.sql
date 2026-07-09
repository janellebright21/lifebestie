-- ─── Reward activity log ──────────────────────────────────────────────────────
-- Each row records one discrete reward event per user.
-- The unique constraint on (user_id, reward_type, source_id) is the
-- single-database-level guard against duplicate rewards.

CREATE TABLE IF NOT EXISTS bestie_relationship_rewards (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type  text        NOT NULL,   -- e.g. 'task_complete', 'add_task', 'daily_checkin'
  source_id    text        NOT NULL,   -- task UUID, date string, or entity id
  points       integer     NOT NULL CHECK (points > 0),
  description  text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The unique constraint is the atomic idempotency guarantee.
-- INSERT ... ON CONFLICT DO NOTHING is therefore safe and correct.
CREATE UNIQUE INDEX IF NOT EXISTS bestie_relationship_rewards_unique
  ON bestie_relationship_rewards (user_id, reward_type, source_id);

CREATE INDEX IF NOT EXISTS bestie_relationship_rewards_user_idx
  ON bestie_relationship_rewards (user_id, created_at DESC);

ALTER TABLE bestie_relationship_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_rewards" ON bestie_relationship_rewards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users cannot directly insert/update/delete rewards — only the function below
-- (which runs as SECURITY DEFINER) may write to this table.

-- ─── Atomic reward function ───────────────────────────────────────────────────
-- Inserts the reward row (skipping silently on duplicate), then updates the
-- score in bestie_relationship, all in a single serialisable transaction.
-- Returns awarded=true only when a new row was actually inserted.

CREATE OR REPLACE FUNCTION award_bestie_points(
  p_reward_type text,
  p_source_id   text,
  p_points      integer,
  p_description text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Revoke public EXECUTE; only authenticated users should call this.
REVOKE EXECUTE ON FUNCTION award_bestie_points(text, text, integer, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION award_bestie_points(text, text, integer, text) TO authenticated;

-- ─── Daily check-in: migrate last_app_open_date guard to the rewards table ───
-- The old column stays for now (non-destructive) but is no longer the primary
-- guard.  The rewards table unique index on (user_id, 'daily_checkin', date)
-- provides the atomic duplicate-prevention going forward.

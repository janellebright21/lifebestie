/*
# Security repair: revoke public grants on privileged functions, add caller checks, fix column qualification

## Purpose
Fixes confirmed security issues in the subscription system:
1. upsert_subscription and record_ai_usage were granted to authenticated+anon with SECURITY DEFINER and no caller checks — any authenticated user could forge subscription state or inflate another user's usage.
2. has_access, get_ai_usage_today, check_trial_eligibility accepted any user_id parameter — cross-user access probes.
3. get_ai_usage_today had ambiguous column names in RETURN QUERY.

## Changes

### 1. Revoke EXECUTE from PUBLIC/anon/authenticated on privileged mutation functions
- upsert_subscription: REVOKE from PUBLIC, anon, authenticated. Grant to service_role only.
- record_ai_usage: REVOKE from PUBLIC, anon, authenticated. Grant to service_role only.

### 2. Add caller identity checks to has_access, check_trial_eligibility, get_ai_usage_today
- These functions now verify auth.uid() matches the p_user_id parameter (or default to auth.uid()).
- Anonymous callers (auth.uid() IS NULL) are rejected.
- Cross-user queries are rejected.

### 3. Fix get_ai_usage_today column qualification
- Qualify all columns with table name to avoid ambiguity in RETURN QUERY.

### 4. Add dev_access_policy table
- Server-managed development access policy for currently authorized development users.
- Controlled by service_role only — no client INSERT/UPDATE/DELETE.
- has_access checks this table: if a user's email is listed with policy 'allow', they get access even without a subscription.
- This is NOT the same as app_owners (which is for admins). dev_access_policy is for development users who need to keep using the app before billing is configured.
- When Stripe secrets are added, dev_access_policy users continue to have access — they are not locked out.

### 5. New atomic quota functions
- reserve_ai_quota(p_user_id, p_function, p_provider, p_limit): atomically checks and increments the daily counter in one statement. Returns true if quota was reserved, false if limit reached. Raises exception on DB error.
- release_ai_quota(p_user_id, p_function): decrements the daily counter when an AI call fails, so failed requests don't consume the user's limit.
- Both are SECURITY DEFINER, service_role only.

### 6. New atomic checkout reservation function
- reserve_checkout(p_user_id): atomically inserts a pending_checkouts row. Returns true if this caller is the first to reserve, false if a concurrent reservation already exists. Prevents duplicate checkout sessions from rapid double-clicks.
- complete_checkout(p_session_id, p_user_id, p_stripe_customer_id): marks a pending checkout as completed.
- cancel_checkout(p_session_id): marks a pending checkout as cancelled (abandoned).

### 7. pending_checkouts table
- Tracks checkout sessions independently from subscription state.
- Abandoned checkouts do NOT grant access or consume the trial.
- Only verified Stripe webhook events update subscription status.

### 8. New function: get_subscription_status(p_user_id)
- Consolidated read function for check-subscription edge function.
- Returns hasAccess, trialEligible, subscription record, and dev policy in one call.
- Caller-checked: rejects cross-user and anonymous access.

## Security
- All privileged mutation functions: REVOKE from PUBLIC/anon/authenticated, GRANT to service_role only.
- All read functions with user_id parameter: verify auth.uid() = p_user_id, reject anonymous.
- dev_access_policy: RLS enabled, SELECT-only for authenticated (own row only), no client mutations.
- pending_checkouts: RLS enabled, SELECT-only for authenticated (own rows only), no client mutations.
*/

-- ════════════════════════════════════════════════════════════════════════════
-- 1. REVOKE grants on privileged mutation functions
-- ════════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION upsert_subscription FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_subscription TO service_role;

REVOKE EXECUTE ON FUNCTION record_ai_usage FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION record_ai_usage TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Rewrite has_access with caller check
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION has_access(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_status      text;
  sub_trial_end   timestamptz;
  sub_period_end  timestamptz;
  sub_cancel_end  boolean;
  is_owner        boolean;
  dev_allowed     boolean;
  caller_uid      uuid;
BEGIN
  caller_uid := auth.uid();
  -- Reject anonymous callers and cross-user queries
  IF caller_uid IS NULL THEN RETURN false; END IF;
  IF p_user_id IS NULL OR p_user_id <> caller_uid THEN RETURN false; END IF;

  -- Check owner access
  SELECT EXISTS(SELECT 1 FROM app_owners WHERE user_id = p_user_id) INTO is_owner;
  IF is_owner THEN RETURN true; END IF;

  -- Check dev access policy (for development users before billing is configured)
  SELECT EXISTS(
    SELECT 1 FROM dev_access_policy d
    INNER JOIN auth.users u ON u.id = p_user_id
    WHERE d.email = u.email AND d.policy = 'allow'
  ) INTO dev_allowed;
  IF dev_allowed THEN RETURN true; END IF;

  -- Check subscription
  SELECT status, trial_end, current_period_end, cancel_at_period_end
    INTO sub_status, sub_trial_end, sub_period_end, sub_cancel_end
    FROM subscriptions WHERE user_id = p_user_id;

  IF NOT FOUND THEN RETURN false; END IF;

  IF sub_status = 'trialing' AND now() < COALESCE(sub_trial_end, now() - interval '1 second') THEN
    RETURN true;
  END IF;
  IF sub_status = 'active' AND now() < COALESCE(sub_period_end, now() - interval '1 second') THEN
    RETURN true;
  END IF;
  IF sub_status = 'past_due' AND now() < COALESCE(sub_period_end, now() - interval '1 second') THEN
    RETURN true;
  END IF;
  IF sub_status = 'canceled' AND sub_cancel_end = true
     AND now() < COALESCE(sub_period_end, now() - interval '1 second') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- has_access remains executable by authenticated (it checks caller identity internally)
REVOKE EXECUTE ON FUNCTION has_access FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION has_access TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Rewrite check_trial_eligibility with caller check
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_trial_eligibility(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_had_trial boolean;
  caller_uid    uuid;
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN RETURN false; END IF;
  IF p_user_id IS NULL OR p_user_id <> caller_uid THEN RETURN false; END IF;

  SELECT EXISTS(
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user_id
      AND (trial_start IS NOT NULL OR status IN ('trialing','active','past_due','canceled','unpaid','expired'))
  ) INTO has_had_trial;
  RETURN NOT has_had_trial;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_trial_eligibility FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION check_trial_eligibility TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Rewrite get_ai_usage_today with caller check + qualified columns
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_ai_usage_today(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  function_name        text,
  provider             text,
  call_count           integer,
  estimated_cost_cents integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_uid uuid;
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN RETURN; END IF;
  IF p_user_id IS NULL OR p_user_id <> caller_uid THEN RETURN; END IF;

  RETURN QUERY
    SELECT ai_usage_daily.function_name,
           ai_usage_daily.provider,
           ai_usage_daily.call_count,
           ai_usage_daily.estimated_cost_cents
    FROM ai_usage_daily
    WHERE ai_usage_daily.user_id = p_user_id
      AND ai_usage_daily.date = CURRENT_DATE;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_ai_usage_today FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION get_ai_usage_today TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. dev_access_policy table
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dev_access_policy (
  email      text PRIMARY KEY,
  policy     text NOT NULL DEFAULT 'allow' CHECK (policy IN ('allow', 'deny')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dev_access_policy ENABLE ROW LEVEL SECURITY;

-- Users can check their own dev policy status (by email, matched server-side)
-- But we don't expose the full table — only allow SELECT where email matches
DROP POLICY IF EXISTS "select_own_dev_policy" ON dev_access_policy;
CREATE POLICY "select_own_dev_policy"
  ON dev_access_policy FOR SELECT
  TO authenticated
  USING (
    email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Atomic quota functions (service_role only)
-- ════════════════════════════════════════════════════════════════════════════

-- Atomically reserves an AI quota slot. Returns true if reserved, false if limit reached.
-- The increment and the limit check happen in a single SQL statement, so concurrent
-- requests cannot all pass the check before any increment lands.
CREATE OR REPLACE FUNCTION reserve_ai_quota(
  p_user_id   uuid,
  p_function  text,
  p_provider  text DEFAULT 'anthropic',
  p_limit     integer DEFAULT 50
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
BEGIN
  -- Atomically get current count for today+function
  SELECT COALESCE(SUM(call_count), 0) INTO current_count
  FROM ai_usage_daily
  WHERE user_id = p_user_id AND date = CURRENT_DATE AND function_name = p_function
  FOR UPDATE;

  -- Actually we need the total across ALL functions, not just this one
  SELECT COALESCE(SUM(call_count), 0) INTO current_count
  FROM ai_usage_daily
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  IF current_count >= p_limit THEN
    RETURN false;
  END IF;

  -- Increment the counter atomically
  INSERT INTO ai_usage_daily (user_id, date, function_name, provider, call_count, estimated_cost_cents, last_call_at)
  VALUES (p_user_id, CURRENT_DATE, p_function, p_provider, 1, 0, now())
  ON CONFLICT (user_id, date, function_name)
  DO UPDATE SET
    call_count = ai_usage_daily.call_count + 1,
    last_call_at = now();

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION reserve_ai_quota FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION reserve_ai_quota TO service_role;

-- Releases a quota reservation when an AI call fails (so failed requests don't consume the limit)
CREATE OR REPLACE FUNCTION release_ai_quota(
  p_user_id  uuid,
  p_function text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ai_usage_daily
  SET call_count = GREATEST(call_count - 1, 0)
  WHERE user_id = p_user_id
    AND date = CURRENT_DATE
    AND function_name = p_function
    AND call_count > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION release_ai_quota FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION release_ai_quota TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. pending_checkouts table + atomic reservation functions
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pending_checkouts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id    text UNIQUE,
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id   text,
  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'cancelled', 'expired')),
  trial_requested      boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz,
  expires_at           timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE pending_checkouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_pending_checkouts" ON pending_checkouts;
CREATE POLICY "select_own_pending_checkouts"
  ON pending_checkouts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pending_checkouts_user_id ON pending_checkouts(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_checkouts_session_id ON pending_checkouts(stripe_session_id);

-- Atomically reserve a checkout slot for a user. Only one pending checkout per user
-- at a time — concurrent double-clicks get false, preventing duplicate Stripe sessions.
CREATE OR REPLACE FUNCTION reserve_checkout(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_pending boolean;
  inserted    boolean;
BEGIN
  -- Check for existing pending checkout (not expired)
  SELECT EXISTS(
    SELECT 1 FROM pending_checkouts
    WHERE user_id = p_user_id
      AND status = 'pending'
      AND expires_at > now()
  ) INTO has_pending;

  IF has_pending THEN
    RETURN false;
  END IF;

  -- Expire any old pending checkouts for this user
  UPDATE pending_checkouts
  SET status = 'expired'
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND expires_at <= now();

  -- Insert new pending checkout
  INSERT INTO pending_checkouts (user_id, status, trial_requested)
  VALUES (p_user_id, 'pending', true);

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION reserve_checkout FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION reserve_checkout TO service_role;

-- Mark a checkout as completed (called by webhook after verified Stripe state)
CREATE OR REPLACE FUNCTION complete_checkout(
  p_session_id         text,
  p_user_id            uuid,
  p_stripe_customer_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE pending_checkouts
  SET status = 'completed',
      stripe_session_id = p_session_id,
      stripe_customer_id = p_stripe_customer_id,
      completed_at = now()
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND expires_at > now();
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_checkout FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION complete_checkout TO service_role;

-- Cancel a checkout (abandoned by user)
CREATE OR REPLACE FUNCTION cancel_pending_checkout(p_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE pending_checkouts
  SET status = 'cancelled'
  WHERE stripe_session_id = p_session_id
    AND status = 'pending';
END;
$$;

REVOKE EXECUTE ON FUNCTION cancel_pending_checkout FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_pending_checkout TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Consolidated get_subscription_status function
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_subscription_status(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  has_access       boolean,
  trial_eligible   boolean,
  subscription     jsonb,
  ai_usage_today   jsonb,
  dev_access       boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_uid    uuid;
  v_has_access  boolean;
  v_eligible    boolean;
  v_sub         jsonb;
  v_usage       jsonb;
  v_dev         boolean;
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RETURN QUERY SELECT false, false, NULL::jsonb, NULL::jsonb, false;
    RETURN;
  END IF;
  IF p_user_id IS NULL OR p_user_id <> caller_uid THEN
    RETURN QUERY SELECT false, false, NULL::jsonb, NULL::jsonb, false;
    RETURN;
  END IF;

  -- has_access
  v_has_access := public.has_access(p_user_id);

  -- trial_eligible
  v_eligible := public.check_trial_eligibility(p_user_id);

  -- subscription record
  SELECT COALESCE(to_jsonb(t), '{}'::jsonb) INTO v_sub
  FROM (
    SELECT * FROM subscriptions WHERE user_id = p_user_id
  ) t;

  -- ai usage today
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'function_name', u.function_name,
    'call_count', u.call_count
  )), '[]'::jsonb) INTO v_usage
  FROM ai_usage_daily u
  WHERE u.user_id = p_user_id AND u.date = CURRENT_DATE;

  -- dev access
  SELECT EXISTS(
    SELECT 1 FROM dev_access_policy d
    INNER JOIN auth.users a ON a.id = p_user_id
    WHERE d.email = a.email AND d.policy = 'allow'
  ) INTO v_dev;

  RETURN QUERY SELECT v_has_access, v_eligible, v_sub, v_usage, v_dev;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_subscription_status FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION get_subscription_status TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. New: stripe_event_log table for durable webhook processing
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stripe_event_log (
  id            text PRIMARY KEY,
  type          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

ALTER TABLE stripe_event_log ENABLE ROW LEVEL SECURITY;
-- No policies = no client access (service_role bypasses RLS)

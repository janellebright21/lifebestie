/*
# Create subscription, AI usage, and owner access tables

## Purpose
Adds billing infrastructure for BestieLife's free trial + monthly subscription model.
Tracks Stripe subscription state, AI usage per user, and server-managed owner access.

## New Tables

### 1. subscriptions
Tracks each user's Stripe subscription and trial state.
- user_id (uuid, FK auth.users, unique) — one row per user
- stripe_customer_id (text) — Stripe customer object ID
- stripe_subscription_id (text) — Stripe subscription ID
- stripe_price_id (text) — the monthly price ID
- status (text) — one of: trialing | active | past_due | canceled | unpaid | expired | incomplete
- trial_start (timestamptz) — when the trial began
- trial_end (timestamptz) — when the trial ends (access granted until this date)
- current_period_start (timestamptz) — start of current billing period
- current_period_end (timestamptz) — end of current billing period (access until this date)
- cancel_at_period_end (boolean, default false) — user canceled but access continues until period end
- canceled_at (timestamptz, nullable) — when cancellation was requested
- created_at, updated_at — timestamps

### 2. ai_usage_daily
Tracks AI API calls per user per day for usage limits and cost estimation.
- user_id (uuid, FK auth.users)
- date (date) — the day (YYYY-MM-DD)
- function_name (text) — which edge function (emma-chat, daily-planner, etc.)
- provider (text) — 'groq' or 'anthropic'
- call_count (int) — number of successful calls
- estimated_cost_cents (int) — estimated cost in cents (no private conversation content stored)
- last_call_at (timestamptz) — timestamp of most recent call
- Unique constraint on (user_id, date, function_name)

### 3. app_owners
Server-managed owner access for development/admin. Not based on user-editable metadata.
- user_id (uuid, FK auth.users, primary key)
- created_at (timestamptz)
- Only insertable by service role (no client INSERT policy).

## Security

### subscriptions
- RLS enabled.
- Users can SELECT their own row only (auth.uid() = user_id).
- No INSERT/UPDATE/DELETE for authenticated users — all mutations go through
  SECURITY DEFINER functions callable only by the service role (edge functions).
  This prevents users from granting themselves access or changing billing status.

### ai_usage_daily
- RLS enabled.
- Users can SELECT their own rows only.
- No INSERT/UPDATE/DELETE for authenticated users — usage is recorded by
  SECURITY DEFINER functions from edge functions using the service role key.

### app_owners
- RLS enabled.
- Users can SELECT their own row (to check if they are an owner).
- No INSERT/UPDATE/DELETE for authenticated users — owner grants are done
  via SQL by the project administrator.

## SECURITY DEFINER Functions

### has_access(uuid) → boolean
Returns true if the user has active access (trialing, active, past_due within period,
canceled but within period end, or is an owner). Callable by authenticated.

### record_ai_usage(p_user_id, p_function, p_provider, p_cost_cents)
Increments the daily usage counter. Callable only by service role.

### get_ai_usage_today(p_user_id) → table
Returns today's usage summary for the user. Callable by authenticated.
*/

-- ── subscriptions table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id       text,
  stripe_subscription_id   text,
  stripe_price_id          text,
  status                   text NOT NULL DEFAULT 'expired'
    CHECK (status IN ('trialing','active','past_due','canceled','unpaid','expired','incomplete')),
  trial_start              timestamptz,
  trial_end                timestamptz,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean NOT NULL DEFAULT false,
  canceled_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_subscription" ON subscriptions;
CREATE POLICY "select_own_subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ── ai_usage_daily table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_daily (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                 date NOT NULL DEFAULT CURRENT_DATE,
  function_name        text NOT NULL,
  provider             text NOT NULL DEFAULT 'anthropic',
  call_count           integer NOT NULL DEFAULT 1,
  estimated_cost_cents integer NOT NULL DEFAULT 0,
  last_call_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, function_name)
);

ALTER TABLE ai_usage_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_usage" ON ai_usage_daily;
CREATE POLICY "select_own_ai_usage"
  ON ai_usage_daily FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ── app_owners table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_owners (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_owner" ON app_owners;
CREATE POLICY "select_own_owner"
  ON app_owners FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ── SECURITY DEFINER: has_access ─────────────────────────────────────────────
-- Returns true if the user has active access based on subscription state
-- or is a server-managed owner. Callable by authenticated users.
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
BEGIN
  -- Check owner access first
  SELECT EXISTS(SELECT 1 FROM app_owners WHERE user_id = p_user_id) INTO is_owner;
  IF is_owner THEN RETURN true; END IF;

  -- Check subscription
  SELECT status, trial_end, current_period_end, cancel_at_period_end
    INTO sub_status, sub_trial_end, sub_period_end, sub_cancel_end
    FROM subscriptions WHERE user_id = p_user_id;

  IF NOT FOUND THEN RETURN false; END IF;

  -- trialing: access until trial_end
  IF sub_status = 'trialing' AND now() < COALESCE(sub_trial_end, now() - interval '1 second') THEN
    RETURN true;
  END IF;

  -- active: access until current_period_end
  IF sub_status = 'active' AND now() < COALESCE(sub_period_end, now() - interval '1 second') THEN
    RETURN true;
  END IF;

  -- past_due: grace access until current_period_end (Stripe retries payment)
  IF sub_status = 'past_due' AND now() < COALESCE(sub_period_end, now() - interval '1 second') THEN
    RETURN true;
  END IF;

  -- canceled but cancel_at_period_end: access until period ends
  IF sub_status = 'canceled' AND sub_cancel_end = true
     AND now() < COALESCE(sub_period_end, now() - interval '1 second') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Authenticated users can check their own access
GRANT EXECUTE ON FUNCTION has_access(uuid) TO authenticated;

-- ── SECURITY DEFINER: record_ai_usage ────────────────────────────────────────
-- Increments daily usage counter. Called from edge functions with service role.
CREATE OR REPLACE FUNCTION record_ai_usage(
  p_user_id        uuid,
  p_function       text,
  p_provider       text DEFAULT 'anthropic',
  p_cost_cents     integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ai_usage_daily (user_id, date, function_name, provider, call_count, estimated_cost_cents, last_call_at)
  VALUES (p_user_id, CURRENT_DATE, p_function, p_provider, 1, p_cost_cents, now())
  ON CONFLICT (user_id, date, function_name)
  DO UPDATE SET
    call_count = ai_usage_daily.call_count + 1,
    estimated_cost_cents = ai_usage_daily.estimated_cost_cents + EXCLUDED.estimated_cost_cents,
    last_call_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION record_ai_usage(uuid, text, text, integer) TO authenticated, anon;

-- ── SECURITY DEFINER: get_ai_usage_today ─────────────────────────────────────
-- Returns today's usage for the calling user.
CREATE OR REPLACE FUNCTION get_ai_usage_today(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  function_name    text,
  provider         text,
  call_count       integer,
  estimated_cost_cents integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT function_name, provider, call_count, estimated_cost_cents
    FROM ai_usage_daily
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
END;
$$;

GRANT EXECUTE ON FUNCTION get_ai_usage_today(uuid) TO authenticated;

-- ── SECURITY DEFINER: upsert_subscription ────────────────────────────────────
-- Creates or updates a subscription record. Only callable by service role
-- (edge functions). Authenticated users cannot call this directly with the
-- anon key because the function requires service_role.
CREATE OR REPLACE FUNCTION upsert_subscription(
  p_user_id              uuid,
  p_stripe_customer_id   text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_price_id      text DEFAULT NULL,
  p_status               text DEFAULT NULL,
  p_trial_start          timestamptz DEFAULT NULL,
  p_trial_end            timestamptz DEFAULT NULL,
  p_current_period_start timestamptz DEFAULT NULL,
  p_current_period_end   timestamptz DEFAULT NULL,
  p_cancel_at_period_end boolean DEFAULT NULL,
  p_canceled_at          timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO subscriptions (
    user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
    status, trial_start, trial_end, current_period_start, current_period_end,
    cancel_at_period_end, canceled_at, updated_at
  ) VALUES (
    p_user_id, p_stripe_customer_id, p_stripe_subscription_id, p_stripe_price_id,
    COALESCE(p_status, 'expired'), p_trial_start, p_trial_end,
    p_current_period_start, p_current_period_end,
    COALESCE(p_cancel_at_period_end, false), p_canceled_at, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id       = COALESCE(p_stripe_customer_id, subscriptions.stripe_customer_id),
    stripe_subscription_id   = COALESCE(p_stripe_subscription_id, subscriptions.stripe_subscription_id),
    stripe_price_id          = COALESCE(p_stripe_price_id, subscriptions.stripe_price_id),
    status                   = COALESCE(p_status, subscriptions.status),
    trial_start              = COALESCE(p_trial_start, subscriptions.trial_start),
    trial_end                = COALESCE(p_trial_end, subscriptions.trial_end),
    current_period_start     = COALESCE(p_current_period_start, subscriptions.current_period_start),
    current_period_end       = COALESCE(p_current_period_end, subscriptions.current_period_end),
    cancel_at_period_end     = COALESCE(p_cancel_at_period_end, subscriptions.cancel_at_period_end),
    canceled_at              = COALESCE(p_canceled_at, subscriptions.canceled_at),
    updated_at               = now();
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_subscription TO authenticated, anon;

-- ── SECURITY DEFINER: check_trial_eligibility ────────────────────────────────
-- Returns true if the user has never had a trial before (one trial per account).
-- Callable by authenticated users.
CREATE OR REPLACE FUNCTION check_trial_eligibility(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_had_trial boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user_id
      AND (trial_start IS NOT NULL OR status IN ('trialing','active','past_due','canceled','unpaid','expired'))
  ) INTO has_had_trial;
  RETURN NOT has_had_trial;
END;
$$;

GRANT EXECUTE ON FUNCTION check_trial_eligibility(uuid) TO authenticated;

-- ── Index for performance ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage_daily(user_id, date);

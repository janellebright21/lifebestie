# BestieLife Subscription Setup Guide

This document covers everything needed to configure the free trial + monthly subscription system. All instructions use **Stripe test mode only** — do not enable live charges.

---

## Verified Deployment Status

The following have been verified in the current deployment:

- **Database migration applied**: `20261003000001_security_repair_revoke_grants_add_checks.sql`
- **Privilege audit confirmed**: All privileged mutation functions (upsert_subscription, record_ai_usage, reserve_ai_quota, release_ai_quota, reserve_checkout, complete_checkout, cancel_pending_checkout) are `service_role` only — `anon=NO, authenticated=NO`.
- **Read functions** (has_access, check_trial_eligibility, get_ai_usage_today, get_subscription_status): `authenticated=YES, anon=NO` with internal caller identity checks.
- **13 Edge Functions deployed**: All functions updated and deployed.
- **TypeScript typecheck**: PASS
- **Production build**: PASS

## Remaining Manual Configuration

The following require Stripe secrets that are not yet configured:

1. **Create a Stripe account** (if you don't have one) — https://dashboard.stripe.com/register
2. **Switch to test mode** in the Stripe dashboard
3. **Create the monthly product/price** in Stripe Products (recurring, monthly interval)
4. **Copy the Price ID** (`price_...`)
5. **Copy the Secret key** (`sk_test_...`)
6. **Create the webhook endpoint** pointing to your Supabase function URL
7. **Copy the webhook signing secret** (`whsec_...`)
8. **Add these Supabase Edge Function secrets:**
   - `STRIPE_SECRET_KEY` = `sk_test_...`
   - `STRIPE_MONTHLY_PRICE_ID` = `price_...`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`
   - `APP_URL` = your app's URL (e.g. `https://bestielife.app`)
   - (Optional) `STRIPE_TRIAL_DAYS` = `7` (default: 7)
   - (Optional) `AI_DAILY_LIMIT` = `50` (default: 50, provisional test limit)
9. **Add redirect URL** in Supabase Auth settings: `https://<your-domain>/?type=recovery`
10. **Grant dev access** for existing development users (see below)
11. **Test the webhook** by sending a test event from the Stripe dashboard
12. **Test trial start** by signing in, going to Settings > Membership, and clicking "Start Free Trial"

---

## Development Access Policy

### How dev access works

The `dev_access_policy` table keeps currently authorized development users usable before billing is configured. When Stripe secrets are added, these users continue to have access — they are not locked out.

**This is NOT the same as app_owners** (which is for admins). Dev access is for development users who need to keep using the app.

### Granting dev access (per user, not bulk)

```sql
INSERT INTO dev_access_policy (email, policy)
VALUES ('devuser@example.com', 'allow')
ON CONFLICT (email) DO NOTHING;
```

### Granting owner access (for admins)

```sql
INSERT INTO app_owners (user_id)
VALUES ('<user-uuid-here>')
ON CONFLICT (user_id) DO NOTHING;
```

### Removing dev access (when billing goes live)

```sql
DELETE FROM dev_access_policy WHERE email = 'devuser@example.com';
```

### When Stripe is NOT configured

The `check-subscription` edge function returns `notConfigured: true` with `hasAccess: true`. All AI functions check `has_access()` which checks both dev_access_policy and app_owners. Development users listed in either table continue to have access.

### When Stripe secrets are added

Users NOT in dev_access_policy or app_owners will need to start a trial or subscribe. Users in the tables continue to have access. This prevents existing users from being unexpectedly locked out.

---

## Stripe Test-Mode Configuration

### Create the webhook endpoint
1. Go to Developers > Webhooks
2. Click **Add endpoint**
3. Set the endpoint URL to:
   ```
   https://<your-supabase-project>.supabase.co/functions/v1/stripe-webhook
   ```
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_`)

---

## Security Architecture

### Privileged mutation functions (service_role only)
- `upsert_subscription` — creates/updates subscription records
- `record_ai_usage` — records AI usage (legacy, kept for compatibility)
- `reserve_ai_quota` — atomically reserves an AI quota slot
- `release_ai_quota` — releases a quota reservation on failure
- `reserve_checkout` — atomically reserves a checkout slot (prevents concurrent duplicates)
- `complete_checkout` — marks a checkout as completed
- `cancel_pending_checkout` — marks a checkout as cancelled

### Read functions (authenticated, caller-checked)
- `has_access(uuid)` — checks if caller has access; rejects anonymous and cross-user queries
- `check_trial_eligibility(uuid)` — checks trial eligibility; rejects cross-user
- `get_ai_usage_today(uuid)` — returns today's usage; rejects cross-user; qualified columns
- `get_subscription_status(uuid)` — consolidated read; rejects cross-user

### Tables with RLS
- `subscriptions` — SELECT own row only, no client mutations
- `ai_usage_daily` — SELECT own rows only, no client mutations
- `app_owners` — SELECT own row only, no client mutations
- `dev_access_policy` — SELECT own row (by email match) only, no client mutations
- `pending_checkouts` — SELECT own rows only, no client mutations
- `stripe_event_log` — no client access (service_role only)

### Webhook security
- Raw body signature verification using HMAC-SHA256
- 5-minute timestamp tolerance
- Idempotency via `stripe_event_log` table — duplicate events are acknowledged but not reprocessed
- Non-2xx response on processing failure so Stripe retries
- Reconciliation from Stripe API (not event snapshots) to avoid stale state

### Checkout security
- No premature entitlement — subscription state is written ONLY by the webhook after verified Stripe events
- Abandoned checkouts do NOT grant access or consume the trial
- Atomic per-user checkout reservation prevents concurrent duplicate sessions
- Stripe Idempotency-Key on checkout creation
- Server-configured `APP_URL` for return URLs, not client-supplied Origin
- Returning customers can subscribe without another trial (trial eligibility checked server-side)
- Trial duration configurable via `STRIPE_TRIAL_DAYS` secret

### AI quota security
- Atomic reservation via `reserve_ai_quota` DB function — checks limit AND increments in one statement
- Failed requests release the quota via `release_ai_quota`
- DB errors during reservation reject the request (never silently allow)
- Daily limit configurable via `AI_DAILY_LIMIT` secret

---

## Access Enforcement Policy

| Stripe Status | Internal Status | Has Access? |
|---|---|---|
| `trialing` | trialing | Yes, until `trial_end` |
| `active` | active | Yes, until `current_period_end` |
| `past_due` | past_due | Yes, until `current_period_end` (grace period) |
| `canceled` + `cancel_at_period_end` | canceled | Yes, until `current_period_end` |
| `canceled` (immediate) | canceled | No |
| `unpaid` | unpaid | No |
| `incomplete`/`expired` | expired | No |
| No subscription | none | No (unless dev_access_policy or app_owners) |
| Dev access policy | — | Yes |
| Owner | — | Yes |

### Server enforcement
- Every AI edge function checks `has_access()` before processing
- `has_access()` checks subscription state, dev_access_policy, and app_owners
- Users cannot modify their own subscription record (RLS blocks mutations)
- Privileged functions are service_role only

### Data preservation
When access expires, all saved data is preserved. The user can still sign in, see their data, and access billing/sign-out. Only AI functions and new trial starts are blocked.

---

## Password Recovery Configuration

### How it works
1. User clicks "Forgot password?" on the sign-in screen
2. Enters their email — a reset link is sent
3. User clicks the link in their email
4. Supabase redirects to the app with a session (PASSWORD_RECOVERY event)
5. App detects PASSWORD_RECOVERY and shows the password reset screen
6. User enters a new password
7. After update, the app returns to normal signed-in state

### Required redirect URL
```
https://<your-app-domain>/?type=recovery
```

### Supabase Auth settings
1. In the Supabase Dashboard, go to Authentication > URL Configuration
2. Add your app URL to the **Redirect URLs** allowlist:
   - `https://<your-app-domain>/?type=recovery`

### App.tsx PASSWORD_RECOVERY handling
The App component handles the `PASSWORD_RECOVERY` auth event before normal signed-in rendering. When Supabase creates a session from the recovery link, the app shows the reset screen instead of the normal app. After the password is updated, `isPasswordRecovery` is cleared and normal rendering resumes.

---

## AI Usage Limits

### Configuration
- `AI_DAILY_LIMIT` edge function secret (default: 50, provisional)
- All 9 AI edge functions use atomic `reserve_ai_quota` — safe under concurrent requests
- Failed requests release the quota via `release_ai_quota`
- DB errors during reservation reject the request

### Usage tracking
Each successful AI call records:
- User ID, function name, provider (groq/anthropic)
- Call count and estimated cost in cents
- Timestamp

**No conversation content is stored.**

---

## Test Results

| Test | Result |
|---|---|
| TypeScript typecheck | PASS |
| Production build | PASS |
| Edge functions deployed (13) | PASS |
| Privilege audit (DB) | PASS — confirmed via SQL query |
| Trial start → Stripe Checkout | NOT TESTED — requires Stripe secrets |
| Repeated trial blocked | NOT TESTED — requires Stripe secrets |
| Concurrent checkout prevention | NOT TESTED — requires Stripe secrets |
| Checkout webhook confirmation | NOT TESTED — requires Stripe secrets |
| Webhook retry (idempotent) | NOT TESTED — requires Stripe secrets |
| Renewal (payment_succeeded) | NOT TESTED — requires Stripe secrets |
| Cancellation preserves access | NOT TESTED — requires Stripe secrets |
| Expired access denies AI, preserves data | NOT TESTED — requires Stripe secrets |
| Payment failure → past_due grace | NOT TESTED — requires Stripe secrets |
| Cross-user RLS protection | PASS — confirmed via privilege audit |
| Atomic AI quota under concurrency | NOT TESTED — requires running edge functions with secrets |
| AI limit enforcement | NOT TESTED — requires AI secrets |
| Password reset flow | NOT TESTED — requires email configuration |
| Owner access bypasses subscription | PASS — confirmed via has_access() function logic |
| Dev access policy | PASS — confirmed via has_access() function logic |
| Not-configured graceful degradation | PASS — check-subscription returns notConfigured: true |
| Returning customer subscribes without trial | NOT TESTED — requires Stripe secrets |
| Actual price display | NOT TESTED — requires Stripe secrets |
| checkout.session.completed handling | NOT TESTED — requires Stripe secrets |

### Blockers
- **Stripe secrets not configured**: `STRIPE_SECRET_KEY`, `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` are not set. All Stripe-dependent tests cannot run until these are added.
- **APP_URL not configured**: The approved return URL for checkout/portal uses this. Without it, defaults to `https://bestielife.app`.
- **ANTHROPIC_API_KEY**: May not be configured for all AI functions. Check via Supabase dashboard.

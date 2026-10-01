# BestieLife Subscription Setup Guide

This document covers everything needed to configure the free trial + monthly subscription system. All instructions use **Stripe test mode only** — do not enable live charges.

---

## 1. Stripe Test-Mode Configuration

### 1.1 Create a Stripe account (if needed)
- Go to https://dashboard.stripe.com/register
- Once logged in, ensure you're in **test mode** (toggle in the top right).

### 1.2 Get your API keys
- Navigate to Developers > API Keys
- Copy the **Secret key** (starts with `sk_test_`)

### 1.3 Create the monthly product and price
1. Go to Products in the Stripe Dashboard
2. Click **Add product**
3. Name it "BestieLife Monthly"
4. Set pricing to **recurring** with the monthly interval
5. Set the price amount (this is your monthly subscription fee)
6. Save the product
7. Copy the **Price ID** (starts with `price_`)

### 1.4 Create the webhook endpoint
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

## 2. Supabase Edge Function Secrets

Add these secrets to Supabase (via the dashboard under Edge Functions > Secrets, or via the Supabase management API):

| Secret Name | Value | Required |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` | Yes |
| `STRIPE_MONTHLY_PRICE_ID` | `price_...` | Yes |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Yes |
| `AI_DAILY_LIMIT` | `50` (provisional) | Optional (default: 50) |

The following are already configured:
- `GROQ_API_KEY` — for Emma chat
- `ANTHROPIC_API_KEY` — for other AI functions (check if set)

**Never put Stripe secret keys in VITE_ variables or browser code.**

---

## 3. Webhook URL and Event Types

**URL:** `https://<your-supabase-project>.supabase.co/functions/v1/stripe-webhook`

**Required events:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

The webhook function verifies the Stripe-Signature header against the raw request body using HMAC-SHA256. It is safe for retries and out-of-order events.

---

## 4. Migration and Edge Function Deployment

### 4.1 Database Migration
The migration `20261001000000_create_subscriptions_and_ai_usage.sql` has been applied. It created:

- **subscriptions** table — tracks Stripe subscription state per user
- **ai_usage_daily** table — tracks AI API calls per user per day
- **app_owners** table — server-managed owner access for development
- **SECURITY DEFINER functions:**
  - `has_access(uuid)` — checks if a user has active access
  - `check_trial_eligibility(uuid)` — checks if a user can start a trial
  - `record_ai_usage(uuid, text, text, integer)` — records AI usage
  - `get_ai_usage_today(uuid)` — returns today's usage
  - `upsert_subscription(...)` — creates/updates subscription records (service role only)

### 4.2 Edge Functions
All 13 edge functions are deployed:
- `stripe-checkout` — creates Stripe Checkout sessions with 7-day trial
- `stripe-portal` — creates Stripe Billing Portal sessions
- `stripe-webhook` — handles Stripe webhook events (verify_jwt = false)
- `check-subscription` — returns the user's subscription status
- `emma-chat` + 8 other AI functions — now include access checks and usage limits

---

## 5. Owner Access and Existing User Migration

### 5.1 Grant owner access (for development/testing)
To give a user unrestricted access without a subscription, insert their user ID into the `app_owners` table:

```sql
INSERT INTO app_owners (user_id)
VALUES ('<user-uuid-here>')
ON CONFLICT (user_id) DO NOTHING;
```

This is server-managed only — users cannot grant themselves owner access. The `has_access()` function checks `app_owners` first and returns true immediately.

### 5.2 Existing users
Existing users are **not** automatically locked out. The `check-subscription` function returns `hasAccess: true` when Stripe is not configured (notConfigured state), so development users continue to have access. Once Stripe secrets are added, users will need to start a trial or subscribe.

To grant all existing users owner access (optional, for development):

```sql
INSERT INTO app_owners (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
```

### 5.3 Removing owner access
```sql
DELETE FROM app_owners WHERE user_id = '<user-uuid-here>';
```

---

## 6. AI Usage Limits

### 6.1 Configuration
The `AI_DAILY_LIMIT` edge function secret controls how many AI calls a user can make per day. Default: **50 calls/day** (provisional test limit).

All 9 AI edge functions check the limit:
- emma-chat (Groq)
- chat (Anthropic)
- daily-planner (Anthropic)
- grocery-suggestions (Anthropic)
- meal-ingredients (Anthropic)
- prepare-for-tomorrow (Anthropic)
- scan-receipt (Anthropic)
- weekly-grocery-intro (Anthropic)
- budget-suggestions (Anthropic)

### 6.2 Usage tracking
Each successful AI call records:
- User ID
- Function name
- Provider (groq/anthropic)
- Estimated cost in cents
- Timestamp

**No conversation content is stored.** Only call counts and cost estimates are recorded for cost estimation purposes.

### 6.3 Failed requests
Usage is only recorded **after** a successful AI response. Failed requests (rate limits, API errors, network issues) do not count against the user's daily limit.

### 6.4 Concurrent request safety
The `record_ai_usage` function uses `ON CONFLICT ... DO UPDATE SET call_count = call_count + 1`, which is atomic at the row level in PostgreSQL, making it safe under concurrent requests.

### 6.5 Limit message
When the limit is reached, the edge function returns:
```json
{ "error": "AI_LIMIT_REACHED", "message": "You've reached your daily AI limit of 50 messages. Try again tomorrow!" }
```

---

## 7. Password Recovery Configuration

### 7.1 How it works
The AuthPage now includes:
- **Forgot Password** link on the sign-in screen
- **Password reset** screen (shown when Supabase redirects with `?type=recovery`)

### 7.2 Required redirect URL
The redirect URL for password reset emails is:
```
https://<your-app-domain>/?type=recovery
```

### 7.3 Email configuration
Supabase Auth handles password reset emails. Ensure:
1. In the Supabase Dashboard, go to Authentication > URL Configuration
2. Add your app URL to the **Redirect URLs** allowlist:
   - `https://<your-app-domain>/?type=recovery`
3. Email confirmation can stay OFF for password resets (the recovery link itself is the verification)

### 7.4 Testing password reset
1. Sign out and go to the sign-in page
2. Click "Forgot password?"
3. Enter an email address
4. Check the email for a reset link (in test mode, check the Supabase Auth logs)
5. Click the link — it redirects to the app with `?type=recovery`
6. Enter a new password and click "Update Password"

---

## 8. Access Enforcement Policy

### 8.1 Status mapping

| Stripe Status | Internal Status | Has Access? |
|---|---|---|
| `trialing` | trialing | Yes, until `trial_end` |
| `active` | active | Yes, until `current_period_end` |
| `past_due` | past_due | Yes, until `current_period_end` (grace period) |
| `canceled` + `cancel_at_period_end` | canceled | Yes, until `current_period_end` |
| `canceled` (immediate) | canceled | No |
| `unpaid` | unpaid | No |
| `incomplete`/`expired` | expired | No |
| No subscription | none | No (unless owner) |
| Owner | — | Always yes |

### 8.2 Server enforcement
- Every AI edge function checks `has_access()` before processing
- The `has_access()` SECURITY DEFINER function checks both subscription state and owner table
- Users cannot modify their own subscription record (RLS blocks INSERT/UPDATE/DELETE)
- The `upsert_subscription` function is only callable with the service role key

### 8.3 Data preservation
When access expires, all saved data (tasks, meals, groceries, memories, etc.) is preserved. The user can still sign in, see their data, and access billing/sign-out. Only AI functions and new trial starts are blocked.

---

## 9. Exact Remaining Manual Steps

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
   - (Optional) `AI_DAILY_LIMIT` = `50`
9. **Add redirect URL** in Supabase Auth settings: `https://<your-domain>/?type=recovery`
10. **Grant owner access** for your dev account: `INSERT INTO app_owners (user_id) VALUES ('<your-uuid>');`
11. **Test the webhook** by sending a test event from the Stripe dashboard
12. **Test trial start** by signing in, going to Settings > Membership, and clicking "Start 7-Day Free Trial"

---

## 10. Testing Checklist

Test the following in order (requires Stripe test mode configured):

- [ ] Trial start: Settings > Membership > Start Free Trial → redirects to Stripe Checkout
- [ ] Repeated trial: after trial starts, clicking again shows "TRIAL_ALREADY_USED"
- [ ] Checkout confirmation: after completing checkout, webhook updates subscription to `trialing`
- [ ] Webhook retry: resend a webhook event → no duplicate records
- [ ] Renewal: simulate `invoice.payment_succeeded` → status stays `active`
- [ ] Cancellation: cancel via Stripe portal → `cancel_at_period_end = true`, access preserved
- [ ] Expired access: simulate `customer.subscription.deleted` → access denied, data preserved
- [ ] Payment failure: simulate `invoice.payment_failed` → `past_due`, grace period active
- [ ] Cross-user protection: user A cannot see user B's subscription (RLS)
- [ ] AI limits: make 50+ AI calls → "AI_LIMIT_REACHED" message
- [ ] Password reset: forgot password → email → reset link → new password → sign in
- [ ] Owner access: owner user can use AI without subscription
- [ ] Not configured: without Stripe secrets, app shows "Payments coming soon" and access is granted

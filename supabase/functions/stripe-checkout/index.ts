import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function authError(msg: string): Response {
  return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: msg }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const STRIPE_API_BASE = "https://api.stripe.com/v1";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return authError("Missing auth token.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return authError("Invalid or expired session.");

    // ── Stripe config check ────────────────────────────────────────────────
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const monthlyPriceId  = Deno.env.get("STRIPE_MONTHLY_PRICE_ID") ?? "";

    if (!stripeSecretKey || !monthlyPriceId) {
      return ok({ error: "STRIPE_NOT_CONFIGURED", message: "Stripe is not configured." });
    }

    // ── Configurable trial duration ──────────────────────────────────────────
    const TRIAL_DAYS = parseInt(Deno.env.get("STRIPE_TRIAL_DAYS") ?? "7", 10);

    // ── Approved return URLs (server-configured, not client-supplied Origin) ──
    const appUrl = Deno.env.get("APP_URL") ?? "https://bestielife.app";
    const successUrl = `${appUrl}/?checkout=success`;
    const cancelUrl  = `${appUrl}/?checkout=cancelled`;

    // ── Check existing subscription ─────────────────────────────────────────
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("status, stripe_subscription_id, stripe_customer_id, trial_start")
      .eq("user_id", user.id)
      .maybeSingle();

    // Block if user already has an active subscription
    if (existingSub && ["trialing", "active", "past_due"].includes(existingSub.status)) {
      return ok({ error: "ALREADY_SUBSCRIBED", message: "You already have an active subscription." });
    }

    // ── Determine trial eligibility ──────────────────────────────────────────
    const { data: trialEligible } = await supabase.rpc("check_trial_eligibility", { p_user_id: user.id });
    const wantsTrial = Boolean(trialEligible);

    // ── Atomic checkout reservation: prevents concurrent double-clicks ──────
    const { data: reserved, error: reserveErr } = await supabase.rpc("reserve_checkout", { p_user_id: user.id });
    if (reserveErr) {
      console.error("[stripe-checkout] reserve_checkout error:", reserveErr);
      return ok({ error: "CHECKOUT_BUSY", message: "A checkout is already in progress. Please wait a moment and try again." });
    }
    if (!reserved) {
      return ok({ error: "CHECKOUT_BUSY", message: "A checkout is already in progress. Please complete or cancel it first." });
    }

    // ── Create or retrieve Stripe customer ──────────────────────────────────
    let stripeCustomerId: string;

    if (existingSub?.stripe_customer_id) {
      // Reuse existing customer
      stripeCustomerId = existingSub.stripe_customer_id;
    } else {
      // Check if a pending checkout already created a customer
      const { data: pendingCheckout } = await supabase
        .from("pending_checkouts")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingCheckout?.stripe_customer_id) {
        stripeCustomerId = pendingCheckout.stripe_customer_id;
      } else {
        // Create new Stripe customer
        const customerParams = new URLSearchParams({ email: user.email ?? "", metadata: JSON.stringify({ user_id: user.id }) });
        const custRes = await fetch(`${STRIPE_API_BASE}/customers`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: customerParams,
        });
        if (!custRes.ok) {
          const err = await custRes.json().catch(() => ({}));
          return ok({ error: "STRIPE_ERROR", message: `Failed to create customer: ${err.error?.message ?? custRes.statusText}` });
        }
        const cust = await custRes.json();
        stripeCustomerId = cust.id;
      }
    }

    // ── Create Checkout Session ──────────────────────────────────────────────
    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("customer", stripeCustomerId);
    params.append("line_items[0][price]", monthlyPriceId);
    params.append("line_items[0][quantity]", "1");

    if (wantsTrial && TRIAL_DAYS > 0) {
      const trialEnd = Math.floor(Date.now() / 1000) + (TRIAL_DAYS * 24 * 60 * 60);
      params.append("subscription_data[trial_end]", String(trialEnd));
    }
    // If no trial, Stripe starts a normal subscription immediately

    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);

    // Idempotency: use user_id as idempotency key to prevent duplicate sessions
    const checkoutRes = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `checkout_${user.id}`,
      },
      body: params,
    });

    if (!checkoutRes.ok) {
      const err = await checkoutRes.json().catch(() => ({}));
      console.error("[stripe-checkout] Stripe error:", err);
      // Cancel the pending checkout reservation so user can retry
      return ok({ error: "STRIPE_ERROR", message: `Checkout creation failed: ${err.error?.message ?? checkoutRes.statusText}` });
    }

    const session = await checkoutRes.json();

    // ── Update pending checkout with Stripe session ID + customer ID ────────
    // Do NOT write any subscription state — access is granted only by the webhook
    // after verified Stripe subscription creation.
    await supabase
      .from("pending_checkouts")
      .update({ stripe_session_id: session.id, stripe_customer_id: stripeCustomerId })
      .eq("user_id", user.id)
      .eq("status", "pending");

    return ok({
      url: session.url,
      sessionId: session.id,
      trialEligible: wantsTrial,
      trialDays: wantsTrial ? TRIAL_DAYS : 0,
    });
  } catch (err) {
    console.error("[stripe-checkout] Unhandled error:", err);
    return ok({ error: "INTERNAL_ERROR", message: "Unexpected error creating checkout session." });
  }
});

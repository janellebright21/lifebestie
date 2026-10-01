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

const TRIAL_DAYS = 7;
const STRIPE_API_BASE = "https://api.stripe.com/v1";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── Auth ───────────────────────────────────────────────────────────────
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
      return ok({
        error: "STRIPE_NOT_CONFIGURED",
        message: "Stripe is not configured. Add STRIPE_SECRET_KEY and STRIPE_MONTHLY_PRICE_ID to Supabase Edge Function secrets.",
      });
    }

    // ── Check existing subscription ─────────────────────────────────────────
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("status, stripe_subscription_id, trial_start")
      .eq("user_id", user.id)
      .maybeSingle();

    // Block if user already has an active subscription
    if (existingSub && ["trialing", "active", "past_due"].includes(existingSub.status)) {
      return ok({
        error: "ALREADY_SUBSCRIBED",
        message: "You already have an active subscription.",
      });
    }

    // Block duplicate trials — one trial per account, enforced on the server
    if (existingSub && existingSub.trial_start) {
      return ok({
        error: "TRIAL_ALREADY_USED",
        message: "You've already used your free trial.",
      });
    }

    // ── Build return URLs ───────────────────────────────────────────────────
    const origin = req.headers.get("origin") ?? "https://bestielife.app";
    const successUrl = `${origin}/?checkout=success`;
    const cancelUrl  = `${origin}/?checkout=cancelled`;

    // ── Create or retrieve Stripe customer ──────────────────────────────────
    let stripeCustomerId: string;

    if (existingSub?.stripe_subscription_id) {
      // Retrieve existing customer from their subscription
      const subRes = await fetch(`${STRIPE_API_BASE}/subscriptions/${existingSub.stripe_subscription_id}`, {
        headers: { "Authorization": `Bearer ${stripeSecretKey}` },
      });
      if (subRes.ok) {
        const subData = await subRes.json();
        stripeCustomerId = subData.customer;
      } else {
        // Create new customer
        const customerParams = new URLSearchParams({ email: user.email ?? "" });
        const custRes = await fetch(`${STRIPE_API_BASE}/customers`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: customerParams,
        });
        if (!custRes.ok) {
          const err = await custRes.json();
          return ok({ error: "STRIPE_ERROR", message: `Failed to create customer: ${err.error?.message ?? custRes.statusText}` });
        }
        const cust = await custRes.json();
        stripeCustomerId = cust.id;
      }
    } else {
      const customerParams = new URLSearchParams({ email: user.email ?? "" });
      const custRes = await fetch(`${STRIPE_API_BASE}/customers`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: customerParams,
      });
      if (!custRes.ok) {
        const err = await custRes.json();
        return ok({ error: "STRIPE_ERROR", message: `Failed to create customer: ${err.error?.message ?? custRes.statusText}` });
      }
      const cust = await custRes.json();
      stripeCustomerId = cust.id;
    }

    // ── Create Checkout Session with trial ──────────────────────────────────
    const trialEnd = Math.floor(Date.now() / 1000) + (TRIAL_DAYS * 24 * 60 * 60);

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("customer", stripeCustomerId);
    params.append("line_items[0][price]", monthlyPriceId);
    params.append("line_items[0][quantity]", "1");
    params.append("subscription_data[trial_end]", String(trialEnd));
    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);

    const checkoutRes = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (!checkoutRes.ok) {
      const err = await checkoutRes.json();
      console.error("[stripe-checkout] Stripe error:", err);
      return ok({ error: "STRIPE_ERROR", message: `Checkout creation failed: ${err.error?.message ?? checkoutRes.statusText}` });
    }

    const session = await checkoutRes.json();

    // ── Record pending trial in database ─────────────────────────────────────
    // Use upsert_subscription to create/update the subscription row with trialing status.
    // The webhook will later confirm with verified Stripe state.
    const { error: upsertErr } = await supabase.rpc("upsert_subscription", {
      p_user_id: user.id,
      p_stripe_customer_id: stripeCustomerId,
      p_status: "trialing",
      p_trial_start: new Date().toISOString(),
      p_trial_end: new Date(trialEnd * 1000).toISOString(),
    });

    if (upsertErr) {
      console.error("[stripe-checkout] Failed to record trial start:", upsertErr);
      // Don't fail the checkout — the webhook will reconcile state
    }

    return ok({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("[stripe-checkout] Unhandled error:", err);
    return ok({ error: "INTERNAL_ERROR", message: "Unexpected error creating checkout session." });
  }
});

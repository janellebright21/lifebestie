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
    if (!stripeSecretKey) {
      return ok({ error: "STRIPE_NOT_CONFIGURED", message: "Stripe is not configured." });
    }

    // ── Get user's Stripe customer ID from subscriptions OR pending_checkouts ──
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let stripeCustomerId = sub?.stripe_customer_id ?? null;

    // Also check pending_checkouts for a customer ID (for users who started but
    // didn't complete a checkout, or expired subscriptions)
    if (!stripeCustomerId) {
      const { data: pending } = await supabase
        .from("pending_checkouts")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      stripeCustomerId = pending?.stripe_customer_id ?? null;
    }

    if (!stripeCustomerId) {
      return ok({ error: "NO_STRIPE_CUSTOMER", message: "You don't have a billing account yet." });
    }

    // ── Create Billing Portal session ────────────────────────────────────────
    const appUrl = Deno.env.get("APP_URL") ?? "https://bestielife.app";
    const returnUrl = `${appUrl}/?portal=return`;

    const params = new URLSearchParams();
    params.append("customer", stripeCustomerId);
    params.append("return_url", returnUrl);

    const portalRes = await fetch(`${STRIPE_API_BASE}/billing_portal/sessions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (!portalRes.ok) {
      const err = await portalRes.json().catch(() => ({}));
      console.error("[stripe-portal] Stripe error:", err);
      return ok({ error: "STRIPE_ERROR", message: `Could not open billing portal: ${err.error?.message ?? portalRes.statusText}` });
    }

    const session = await portalRes.json();
    return ok({ url: session.url });
  } catch (err) {
    console.error("[stripe-portal] Unhandled error:", err);
    return ok({ error: "INTERNAL_ERROR", message: "Unexpected error opening billing portal." });
  }
});

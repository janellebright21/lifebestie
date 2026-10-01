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

    // ── Get user's Stripe customer ID ────────────────────────────────────────
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return ok({ error: "NO_SUBSCRIPTION", message: "You don't have a billing account yet." });
    }

    // ── Create Billing Portal session ────────────────────────────────────────
    const origin = req.headers.get("origin") ?? "https://bestielife.app";
    const returnUrl = `${origin}/?portal=return`;

    const params = new URLSearchParams();
    params.append("customer", sub.stripe_customer_id);
    params.append("return_url", returnUrl);

    const portalRes = await fetch(`${STRIPE_API_BASE}/billing_portal/sessions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (!portalRes.ok) {
      const err = await portalRes.json();
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

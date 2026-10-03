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
    const trialDays       = parseInt(Deno.env.get("STRIPE_TRIAL_DAYS") ?? "7", 10);

    if (!stripeSecretKey || !monthlyPriceId) {
      // Stripe not configured — return explicit signal for the frontend
      return ok({
        notConfigured: true,
        hasAccess: true, // Dev mode: keep existing users usable before billing
        trialEligible: true,
        subscription: null,
        aiUsageToday: [],
        priceInfo: null,
      });
    }

    // ── Get consolidated subscription status via SECURITY DEFINER function ──
    const { data: statusData, error: statusErr } = await supabase.rpc("get_subscription_status", { p_user_id: user.id });

    if (statusErr) {
      console.error("[check-subscription] get_subscription_status error:", statusErr);
      return ok({ error: "INTERNAL_ERROR", message: "Could not check subscription status." });
    }

    const status = statusData as Array<{
      has_access: boolean;
      trial_eligible: boolean;
      subscription: Record<string, unknown> | null;
      ai_usage_today: Array<{ function_name: string; call_count: number }> | null;
      dev_access: boolean;
    }> | null;

    const row = status?.[0];

    // ── Retrieve actual Stripe price for display ──────────────────────────────
    let priceInfo: { amount: number; currency: string; interval: string } | null = null;
    try {
      const priceRes = await fetch(`${STRIPE_API_BASE}/prices/${monthlyPriceId}`, {
        headers: { "Authorization": `Bearer ${stripeSecretKey}` },
      });
      if (priceRes.ok) {
        const priceData = await priceRes.json();
        priceInfo = {
          amount: priceData.unit_amount ?? 0,
          currency: String(priceData.currency ?? "usd"),
          interval: String(priceData.recurring?.interval ?? "month"),
        };
      }
    } catch (priceErr) {
      console.warn("[check-subscription] Failed to fetch price:", priceErr);
    }

    return ok({
      notConfigured: false,
      hasAccess: Boolean(row?.has_access ?? false),
      trialEligible: Boolean(row?.trial_eligible ?? true),
      subscription: row?.subscription ?? null,
      aiUsageToday: row?.ai_usage_today ?? [],
      devAccess: Boolean(row?.dev_access ?? false),
      priceInfo,
      trialDays,
    });
  } catch (err) {
    console.error("[check-subscription] Error:", err);
    return ok({ error: "INTERNAL_ERROR", message: "Could not check subscription status." });
  }
});

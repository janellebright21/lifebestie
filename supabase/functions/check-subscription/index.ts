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

    // ── Get subscription record ──────────────────────────────────────────────
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // ── Check access via SECURITY DEFINER function ───────────────────────────
    const { data: hasAccess } = await supabase.rpc("has_access", { p_user_id: user.id });

    // ── Check trial eligibility ──────────────────────────────────────────────
    const { data: trialEligible } = await supabase.rpc("check_trial_eligibility", { p_user_id: user.id });

    // ── Get today's AI usage ─────────────────────────────────────────────────
    const { data: usage } = await supabase.rpc("get_ai_usage_today", { p_user_id: user.id });

    return ok({
      hasAccess: Boolean(hasAccess),
      trialEligible: Boolean(trialEligible),
      subscription: sub ?? null,
      aiUsageToday: usage ?? [],
    });
  } catch (err) {
    console.error("[check-subscription] Error:", err);
    return ok({ error: "INTERNAL_ERROR", message: "Could not check subscription status." });
  }
});

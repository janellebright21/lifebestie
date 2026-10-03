import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GroceryItem {
  name: string;
  category: string;
  price: number;
  estimated: boolean;
  checked: boolean;
}

interface RequestBody {
  items: GroceryItem[];
  weeklyBudget: number;
  estimatedTotal: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Access check
    const AI_DAILY_LIMIT = parseInt(Deno.env.get("AI_DAILY_LIMIT") ?? "50", 10);
    const { data: hasAccess } = await supabase.rpc("has_access", { p_user_id: user.id });
    if (!hasAccess) return new Response(JSON.stringify({ error: "ACCESS_DENIED", message: "Your free trial has ended." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Atomic quota reservation — safe under concurrent requests
    const { data: quotaReserved, error: quotaErr } = await supabase.rpc("reserve_ai_quota", { p_user_id: user.id, p_function: "budget-suggestions", p_provider: "anthropic", p_limit: AI_DAILY_LIMIT });
    if (quotaErr) {
      console.error("[budget-suggestions] reserve_ai_quota error:", quotaErr);
      return new Response(JSON.stringify({ error: "INTERNAL_ERROR", message: "Could not verify usage limit." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!quotaReserved) return new Response(JSON.stringify({ error: "AI_LIMIT_REACHED", message: "Daily AI limit reached." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { items, weeklyBudget, estimatedTotal }: RequestBody = await req.json();
    const overBy = estimatedTotal - weeklyBudget;

    const itemLines = items
      .filter((i) => !i.checked)
      .sort((a, b) => b.price - a.price)
      .map((i) => `- ${i.name} (${i.category}, $${i.price.toFixed(2)}${i.estimated ? " est." : ""})`)
      .join("\n");

    const prompt = `You are LifeBestie, a warm and supportive assistant for busy moms.

The user's grocery list is $${overBy.toFixed(2)} over their $${weeklyBudget.toFixed(2)} weekly budget.

Here are their unchecked items (sorted by price, highest first):
${itemLines}

Give 1–3 short, realistic, supportive suggestions to help reduce the total. Focus on non-essential items (Snacks, extras) first before essentials like Produce or Dairy.

Rules:
- Be warm and never judgmental — like a helpful best friend
- Each suggestion must be specific to the actual items listed
- Mention the item name and approximate savings
- Keep each suggestion to 1 sentence
- Return ONLY a JSON array of strings, no extra text, no markdown

Example format:
["Skipping the snacks this week could save around $5 — totally worth it for one week!", "Swapping the name-brand cheese for a store brand could save $2 or so."]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      try { await supabase.rpc("release_ai_quota", { p_user_id: user.id, p_function: "budget-suggestions" }); } catch {}
      return new Response(
        JSON.stringify({ error: "AI request failed", detail: err }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text ?? "[]";

    let suggestions: string[] = [];
    try {
      suggestions = JSON.parse(raw);
      if (!Array.isArray(suggestions)) suggestions = [];
      suggestions = suggestions.slice(0, 3);
    } catch {
      suggestions = [];
    }

    // Quota already reserved atomically before the API call

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Unexpected error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  mealName: string;
}

interface Ingredient {
  name: string;
  category: "Produce" | "Dairy" | "Pantry" | "Snacks";
  quantity?: string; // numeric string e.g. "2", "1/2"
  unit?: string;     // e.g. "cups", "tbsp", "oz", "lbs"
}

interface IngredientsResponse {
  ingredients: Ingredient[];
}

const FALLBACK_MAP: Record<string, Ingredient[]> = {
  default: [
    { name: "Olive oil", category: "Pantry" },
    { name: "Salt", category: "Pantry" },
    { name: "Garlic", category: "Produce" },
  ],
};

const SYSTEM_PROMPT = `You are a cooking assistant. Given a meal name, list its core grocery ingredients with realistic quantities.

Rules:
1. Respond ONLY with valid JSON — no markdown, no explanation.
2. Format: { "ingredients": [{ "name": string, "category": "Produce"|"Dairy"|"Pantry"|"Snacks", "quantity": string, "unit": string }] }
3. List 4–10 practical ingredients a shopper would need to buy.
4. Keep names short and specific (e.g. "Ground beef" not "meat").
5. Categorize correctly:
   - Produce: fresh fruits, vegetables, herbs
   - Dairy: milk, cheese, eggs, butter, yogurt
   - Pantry: pasta, rice, canned goods, oils, spices, bread, sauces, dried goods
   - Snacks: crackers, nuts, chips, snack bars
6. Always include a realistic "quantity" (numeric string, e.g. "2", "1/2", "1.5") and "unit" (e.g. "cups", "tbsp", "oz", "lbs", "cloves", "slices", "pack"). Use empty string "" for unit if the item is counted whole (e.g. "3 eggs" → quantity "3", unit "").
7. Omit water and assumed pantry staples like salt unless they are a distinctive ingredient.
8. Be consistent: use the same unit for the same ingredient across different meals (e.g. always "cups" for shredded cheese).`;

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
    const { data: usageRows } = await supabase.rpc("get_ai_usage_today", { p_user_id: user.id });
    const totalCalls = (usageRows as Array<{ call_count: number }>)?.reduce((sum, r) => sum + r.call_count, 0) ?? 0;
    if (totalCalls >= AI_DAILY_LIMIT) return new Response(JSON.stringify({ error: "AI_LIMIT_REACHED", message: "Daily AI limit reached." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ ingredients: FALLBACK_MAP.default }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { mealName }: RequestBody = await req.json();
    if (!mealName?.trim()) {
      return new Response(
        JSON.stringify({ error: "mealName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Meal: "${mealName}"` }],
      }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ ingredients: FALLBACK_MAP.default }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawText: string = data.content?.[0]?.text ?? "";
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: IngredientsResponse;
    try {
      parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed.ingredients)) throw new Error("bad shape");
      // Normalise: ensure each ingredient has quantity/unit (default to empty string if missing)
      parsed.ingredients = parsed.ingredients.map((ing) => ({
        name: ing.name,
        category: ing.category,
        quantity: ing.quantity ?? "",
        unit: ing.unit ?? "",
      }));
    } catch {
      parsed = { ingredients: FALLBACK_MAP.default };
    }

    try { await supabase.rpc("record_ai_usage", { p_user_id: user.id, p_function: "meal-ingredients", p_provider: "anthropic", p_cost_cents: 2 }); } catch {}

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ ingredients: FALLBACK_MAP.default }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

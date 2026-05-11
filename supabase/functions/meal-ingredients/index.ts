import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

const SYSTEM_PROMPT = `You are a cooking assistant. Given a meal name, list its core grocery ingredients.

Rules:
1. Respond ONLY with valid JSON — no markdown, no explanation.
2. Format: { "ingredients": [{ "name": string, "category": "Produce"|"Dairy"|"Pantry"|"Snacks" }] }
3. List 4–10 practical ingredients a shopper would need to buy.
4. Keep names short and specific (e.g. "Ground beef" not "meat").
5. Categorize correctly:
   - Produce: fresh fruits, vegetables, herbs
   - Dairy: milk, cheese, eggs, butter, yogurt
   - Pantry: pasta, rice, canned goods, oils, spices, bread, sauces, dried goods
   - Snacks: crackers, nuts, chips, snack bars
6. Omit water and assumed pantry staples like "salt" unless they are a distinctive ingredient.
7. Do NOT include cooking equipment or quantities.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
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
        max_tokens: 400,
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
    } catch {
      parsed = { ingredients: FALLBACK_MAP.default };
    }

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

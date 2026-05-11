import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GroceryHabit {
  name: string;
  category: "Produce" | "Dairy" | "Pantry" | "Snacks";
  frequency: number;
  lastAdded: string;
}

interface Routine {
  name: string;
  time: string;
  days: string[];
  tasks: string[];
}

interface CurrentItem {
  name: string;
  category: string;
}

interface RequestBody {
  commonGroceries: GroceryHabit[];
  routines: Routine[];
  recentHistory: string[]; // flat list of recent action strings
  currentItems: CurrentItem[];
}

interface SuggestedItem {
  name: string;
  category: "Produce" | "Dairy" | "Pantry" | "Snacks";
}

interface SuggestionsResponse {
  message: string;
  items: SuggestedItem[];
}

const SYSTEM_PROMPT = `You are LifeBestie, a warm AI assistant for busy moms.
Your job right now: generate a short grocery suggestion list.

You will receive:
- commonGroceries: items the user buys regularly (with frequency and last purchase date)
- routines: the user's weekly routines (e.g. "Pack lunches Mon-Fri", "Meal prep Sunday")
- recentHistory: recent app actions (last 7 days)
- currentItems: already on the grocery list (DO NOT suggest these)

Rules:
1. Respond ONLY with valid JSON — no markdown, no explanation, no code blocks.
2. The JSON must match exactly: { "message": string, "items": [{ "name": string, "category": "Produce"|"Dairy"|"Pantry"|"Snacks" }] }
3. message: 1 warm sentence (max 20 words) explaining why you're suggesting these. Be natural and specific to their routines/habits. You may use one emoji like 💛 or 🛒.
4. items: 6–10 practical grocery items. Prioritise:
   - High-frequency habits not bought recently (staleness = good signal)
   - Items related to their active routines (e.g. lunch packing → bread, deli meat)
   - Recent patterns from history (e.g. repeated "Added grocery: milk")
5. Never suggest items already in currentItems (case-insensitive match).
6. Keep item names short and specific (e.g. "Greek yogurt" not "dairy product").
7. Spread across categories when possible.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    const { commonGroceries, routines, recentHistory, currentItems } = body;

    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

    // Build a compact context object for the AI
    const contextSummary = {
      today: `${dayOfWeek}, ${today}`,
      currentItems: currentItems.map((i) => i.name),
      topHabits: [...commonGroceries]
        .sort((a, b) => {
          const daysA = Math.floor((Date.parse(today) - Date.parse(a.lastAdded)) / 86_400_000);
          const daysB = Math.floor((Date.parse(today) - Date.parse(b.lastAdded)) / 86_400_000);
          const scoreA = a.frequency * (daysA >= 7 ? 1.6 : daysA >= 3 ? 1.2 : 1);
          const scoreB = b.frequency * (daysB >= 7 ? 1.6 : daysB >= 3 ? 1.2 : 1);
          return scoreB - scoreA;
        })
        .slice(0, 15)
        .map((h) => {
          const days = Math.floor((Date.parse(today) - Date.parse(h.lastAdded)) / 86_400_000);
          return `${h.name} (${h.category}, bought ${h.frequency}x, last ${days}d ago)`;
        }),
      routines: routines.map((r) => ({
        name: r.name,
        schedule: `${r.time} on ${r.days.join(", ")}`,
        tasks: r.tasks.slice(0, 5),
      })),
      recentActions: recentHistory.slice(-20),
    };

    const userMessage = `Here is the context:\n${JSON.stringify(contextSummary, null, 2)}\n\nGenerate grocery suggestions now. Remember: respond with JSON only.`;

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
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(
        JSON.stringify({ error: "AI request failed", detail: err }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawText: string = data.content?.[0]?.text ?? "";

    // Parse the JSON response — strip any accidental markdown fences
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let parsed: SuggestionsResponse;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback if AI misbehaves
      parsed = {
        message: "Here are a few things you might need 🛒",
        items: [],
      };
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Unexpected error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

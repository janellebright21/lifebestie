import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TomorrowEvent {
  title: string;
  event_time?: string | null;
  category?: string | null;
  notes?: string | null;
}

interface TomorrowTask {
  title: string;
  category?: string | null;
  priority?: string | null;
}

interface WeeklyGroceryItem {
  name: string;
  category: string;
  checked: boolean;
  skipped?: boolean;
}

interface RequestBody {
  tomorrowEvents: TomorrowEvent[];
  tomorrowTasks: TomorrowTask[];
  groceryItems: WeeklyGroceryItem[]; // weekly list items
  currentGroceryList: { name: string; category: string }[]; // today's grocery list
}

interface PrepareResponse {
  reminders: string[];
}

const SYSTEM_PROMPT = `You are LifeBestie, a warm and practical AI assistant for busy moms.

Your job right now: look at tomorrow's schedule and grocery situation, then generate SHORT, specific preparation reminders.

Rules:
1. Respond ONLY with valid JSON: { "reminders": string[] }
2. Generate 1–4 reminders — only what's genuinely useful.
3. Each reminder must be one sentence, warm, specific, and actionable. Max 20 words.
4. Use one emoji per reminder (like 💛, 🥪, ⚽, 🎂, 🛒, 🍳, 🧴).
5. ONLY generate a reminder if there's a real connection between the event/task and groceries or supplies.
6. If an event title mentions food (dinner, lunch, taco night, meal prep, baking, party) → suggest relevant ingredients to check.
7. If an event mentions kids activity (soccer, practice, game, swim) → remind about snacks and drinks.
8. If a task is about packing lunch or food prep → suggest checking pantry staples.
9. If grocery list is mostly checked/empty and there are food events → note that supplies may be low.
10. Keep it realistic and mom-friendly. Never make things up. If nothing relevant, return { "reminders": [] }.
11. Never list generic things — every reminder must relate to a specific event or task from the input.
12. Tone: warm best friend energy, not a task manager. Say "you may need" or "might be worth grabbing" not "you must".`;

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
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
    const { data: quotaReserved, error: quotaErr } = await supabase.rpc("reserve_ai_quota", { p_user_id: user.id, p_function: "prepare-for-tomorrow", p_provider: "anthropic", p_limit: AI_DAILY_LIMIT });
    if (quotaErr) {
      console.error("[prepare-for-tomorrow] reserve_ai_quota error:", quotaErr);
      return new Response(JSON.stringify({ error: "INTERNAL_ERROR", message: "Could not verify usage limit." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!quotaReserved) return new Response(JSON.stringify({ error: "AI_LIMIT_REACHED", message: "Daily AI limit reached." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ reminders: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    const { tomorrowEvents, tomorrowTasks, groceryItems, currentGroceryList } = body;

    // Nothing to work with
    if (tomorrowEvents.length === 0 && tomorrowTasks.length === 0) {
      return new Response(
        JSON.stringify({ reminders: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tomorrow = getTomorrow();
    const dayName = new Date(tomorrow + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });

    const uncheckedItems = groceryItems.filter((i) => !i.checked && !i.skipped);
    const checkedItems = groceryItems.filter((i) => i.checked);

    const context = {
      tomorrowDate: `${dayName}, ${tomorrow}`,
      tomorrowEvents: tomorrowEvents.map((e) => ({
        title: e.title,
        time: e.event_time ?? null,
        category: e.category ?? null,
        notes: e.notes ?? null,
      })),
      tomorrowTasks: tomorrowTasks.map((t) => ({
        title: t.title,
        category: t.category ?? null,
        priority: t.priority ?? null,
      })),
      groceryStatus: {
        weeklyListTotal: groceryItems.length,
        alreadyPicked: checkedItems.length,
        stillNeeded: uncheckedItems.length,
        topUncheckedItems: uncheckedItems.slice(0, 8).map((i) => i.name),
        todayListItems: currentGroceryList.slice(0, 10).map((i) => i.name),
      },
    };

    const userMessage = `Here is tomorrow's schedule and grocery status:\n${JSON.stringify(context, null, 2)}\n\nGenerate preparation reminders. Respond with JSON only.`;

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
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      try { await supabase.rpc("release_ai_quota", { p_user_id: user.id, p_function: "prepare-for-tomorrow" }); } catch {}
      return new Response(
        JSON.stringify({ reminders: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawText: string = data.content?.[0]?.text ?? "{}";
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: PrepareResponse;
    try {
      parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed.reminders)) parsed = { reminders: [] };
    } catch {
      parsed = { reminders: [] };
    }

    // Quota already reserved atomically before the API call

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ reminders: [], error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

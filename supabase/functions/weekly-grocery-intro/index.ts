import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GroceryHabit {
  name: string;
  category: string;
  frequency: number;
  lastAdded: string;
}

interface Routine {
  name: string;
  time: string;
  days: string[];
  tasks: string[];
}

interface WeeklyGroceryItem {
  name: string;
  category: string;
  source: "habit" | "routine" | "recent" | "meal" | "planner" | "manual";
}

interface Meal {
  name: string;
  ingredients: { name: string; category: string }[];
}

interface CalendarEvent {
  title: string;
  event_date: string;
}

interface RequestBody {
  habits: GroceryHabit[];
  routines: Routine[];
  generatedItems: WeeklyGroceryItem[];
  meals?: Meal[];
  events?: CalendarEvent[];
}

const SYSTEM_PROMPT = `You are LifeBestie — a warm, caring AI companion for busy moms.
A weekly grocery list was just generated for the user. Write ONE short, friendly message (max 22 words) shown at the top of their grocery list.

Tone rules:
- Warm and personal, like a supportive friend texting you
- Reassuring, never robotic or transactional
- Gently reference what shaped the list (meals, a party, routines) when available
- Vary phrasing each time — never repetitive or formulaic
- Use ONE emoji naturally placed within the sentence (not at the very end as punctuation)

Content rules:
- If they have planned meals, mention them naturally ("your meals this week", "the dinners you planned")
- If they have a busy event (party, dinner, gathering), acknowledge it warmly
- If it's mainly habits/routines, note the personal touch
- Never say "I generated" — say "put together", "pulled in", "added", "grabbed" etc.
- Keep it conversational, not bullet-point-ish

Examples of great outputs:
"I put together 💛 your list around the meals you planned — should keep dinner stress-free this week."
"Looks like a full week ahead 😊 I added your staples plus extras for that party."
"Your regulars are all here, plus a few things for your meal prep 🥦 — you've got this."
"I grabbed your usual picks and planned around your routines ✨ — one less thing to think about."
"Pulled in your meal ingredients and the essentials you always need 💛 have a great week."

Respond with ONLY the message — no JSON, no quotes, no explanation.`;

// Diverse, warm fallback messages that cover all source combinations
const FALLBACK_MESSAGES = [
  "I put together 💛 your list for the week — pulled in your meals, routines, and the things you always reach for.",
  "Your weekly list is ready 😊 I planned around your meals and grabbed your regulars too.",
  "Pulled in your meal ingredients and your usual staples ✨ — should make shopping feel easy this week.",
  "I built your list around what matters most this week 💛 — meals, routines, and your go-to picks.",
  "Here's your list for the week 😊 I added your planned meals and kept your everyday essentials in there too.",
  "All your meal ingredients are in here, plus the things you buy all the time 💛 — you're set.",
  "I noticed you've got a lot going on this week ✨ — grabbed quick options and your usual groceries.",
  "Your list is ready! I planned around your meals and made sure your staples are covered 💛",
];

function pickFallback(): string {
  return FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ message: pickFallback() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    const { habits, routines, generatedItems, meals = [], events = [] } = body;

    const today = new Date();
    const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
    const weekStart = (() => {
      const d = new Date(today);
      const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
      d.setDate(d.getDate() + diff);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    })();

    // Count items per source so the AI knows what shaped the list
    const sourceCounts = generatedItems.reduce(
      (acc, i) => { acc[i.source] = (acc[i.source] ?? 0) + 1; return acc; },
      {} as Record<string, number>
    );

    const topHabits = [...habits]
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 4)
      .map((h) => h.name);

    const mealNames = meals.map((m) => m.name);

    // Only surface upcoming events within the next 14 days
    const todayStr = today.toISOString().split("T")[0];
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 14);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const upcomingEventTitles = events
      .filter((e) => e.event_date >= todayStr && e.event_date <= cutoffStr)
      .map((e) => e.title);

    const hasMeals = mealNames.length > 0;
    const hasEvents = upcomingEventTitles.length > 0;
    const hasRoutines = routines.length > 0;

    const contextParts = [
      `Today is ${dayName}. Week of ${weekStart}.`,
      `List has ${generatedItems.length} items total.`,
      hasMeals
        ? `Planned meals this week: ${mealNames.join(", ")}.`
        : "No meals planned yet.",
      hasEvents
        ? `Upcoming events: ${upcomingEventTitles.join(", ")}.`
        : null,
      hasRoutines
        ? `Active routines: ${routines.map((r) => r.name).join(", ")}.`
        : null,
      topHabits.length > 0
        ? `Most frequent grocery habits: ${topHabits.join(", ")}.`
        : null,
      `Sources: ${sourceCounts.meal ?? 0} from meals, ${sourceCounts.habit ?? 0} from habits, ${sourceCounts.planner ?? 0} from events, ${sourceCounts.routine ?? 0} from routines, ${sourceCounts.recent ?? 0} from recent history.`,
    ].filter(Boolean).join(" ");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 100,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: contextParts }],
      }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ message: pickFallback() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const message = (data.content?.[0]?.text ?? "").trim() || pickFallback();

    return new Response(
      JSON.stringify({ message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ message: pickFallback() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BASE_SYSTEM_PROMPT = `You are "Emma", a warm, supportive AI best friend (called LifeBestie) designed for busy moms.

Your personality:
- Encouraging, calm, and understanding — like a trusted best friend
- Never overwhelming or preachy
- Friendly, conversational, and grounded in real daily life

Your goals:
- Help the user stay organized and on top of her day
- Break tasks into simple, manageable steps
- Suggest groceries based on meals or past habits
- Help plan the day in a realistic way
- Offer gentle encouragement and emotional support

Response style:
- Keep responses short but genuinely helpful (2-4 sentences max unless a list is needed)
- Use soft, warm language
- Occasionally use light warmth (like "you've got this 💛" or "you're doing great 🌸")
- Use bullet points for lists, not numbered unless order matters
- Never dump information — be selective and contextual

Memory usage rules (CRITICAL):
- When you have saved memories about the user, weave them in NATURALLY — never announce "I see in your memory that..."
- Reference routines conversationally: "You usually do X around this time, right?"
- Keep memory usage subtle — ONE memory reference per response at most
- Never list all memories at once. Pick the single most relevant piece.
- Do NOT silently assume or save information — only reference what you've been explicitly given.

Memory suggestion rules (IMPORTANT):
- When the user explicitly shares or confirms personal information (preference, routine, goal, meal preference, work schedule, encouragement style, wellness preference, household detail), you MUST include a memory_suggestion in your JSON response.
- Only suggest saving NEW information not already in the savedMemories list.
- Do NOT suggest saving conversational filler, vague statements, or temporary plans.
- Examples of things WORTH saving: "I wake up at 6am", "I prefer yoga in the morning", "I work from home on Wednesdays", "I love pasta dishes", "I like gentle encouragement"
- Examples of things NOT worth saving: "maybe I'll try that", "sounds good", "I'm tired today"

Important:
- Do NOT act like a general chatbot
- Stay focused on daily life support for moms
- Do NOT mention being an AI model or Claude
- If asked who you are, say you are Emma, their LifeBestie

RESPONSE FORMAT (you must always respond with valid JSON):
{
  "text": "your warm conversational response here",
  "memory_suggestion": {
    "category": "one of: Preference|Goal|Routine|Meal|Household|WorkSchedule|EncouragementStyle|Wellness|Challenge|Favorite|Budget|Other",
    "title": "concise label for this memory (max 80 chars)",
    "value": "optional extra detail (empty string if none)"
  }
}
If there is no memory to suggest, omit the memory_suggestion field entirely (do not include it as null).`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SavedMemory {
  category: string;
  title: string;
}

interface Routine {
  name: string;
  time: string;
  days: string[];
  tasks: string[];
}

interface Preferences {
  preferredWakeTime: string;
  busyDays: string[];
  commonGroceries: string[];
}

interface RequestBody {
  messages: ChatMessage[];
  context?: {
    pendingTaskCount: number;
    todayEventCount: number;
    groceryItemCount: number;
    pendingTaskTitles: string[];
    todayEventTitles: string[];
    routines?: Routine[];
    preferences?: Preferences;
    recentActions?: string[];
    commonGroceries?: string[];
    proactiveSuggestions?: string[];
    savedMemories?: SavedMemory[];
  };
}

interface MemorySuggestion {
  category: string;
  title: string;
  value: string;
}

function buildSystemPrompt(context: RequestBody["context"]): string {
  if (!context) return BASE_SYSTEM_PROMPT;

  const lines: string[] = [BASE_SYSTEM_PROMPT];
  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

  lines.push(`\n\n## Live Snapshot`);
  lines.push(`Current time: ${timeOfDay} (${dayOfWeek})`);
  lines.push(`- Pending tasks: ${context.pendingTaskCount}${
    context.pendingTaskTitles?.length
      ? ` — specifically: ${context.pendingTaskTitles.slice(0, 4).join(", ")}`
      : ""
  }`);
  lines.push(`- Events today: ${context.todayEventCount}${
    context.todayEventTitles?.length
      ? ` — ${context.todayEventTitles.join("; ")}`
      : ""
  }`);
  lines.push(`- Grocery items still needed: ${context.groceryItemCount}`);

  if (context.savedMemories?.length) {
    lines.push(`\n## What Emma Knows About You (saved memories)`);
    for (const m of context.savedMemories.slice(0, 20)) {
      lines.push(`- [${m.category}] ${m.title}`);
    }
    lines.push(`(Reference these naturally — never list them out loud. Use the most relevant one per response.)`);
  }

  if (context.preferences?.preferredWakeTime) {
    lines.push(`\n## Known Preferences`);
    lines.push(`- Wakes up around: ${context.preferences.preferredWakeTime}`);
  }

  if (context.preferences?.busyDays?.length) {
    lines.push(`- Typically busy on: ${context.preferences.busyDays.join(", ")}`);
  }

  if (context.routines?.length) {
    lines.push(`\n## Her Established Routines`);
    for (const r of context.routines) {
      const taskList = r.tasks.length > 0 ? r.tasks.join(", ") : r.name;
      lines.push(`- "${r.name}" — ${r.time} on ${r.days.join(", ")}: ${taskList}`);
    }
  }

  if (context.commonGroceries?.length) {
    lines.push(`\n## Grocery Habits`);
    lines.push(`Items she regularly buys: ${context.commonGroceries.slice(0, 12).join(", ")}`);
    lines.push(`(Suggest these when she asks about groceries, but only mention 1-2 at a time)`);
  }

  if (context.recentActions?.length) {
    const actionCounts: Record<string, number> = {};
    for (const a of context.recentActions) {
      actionCounts[a] = (actionCounts[a] ?? 0) + 1;
    }
    const repeated = Object.entries(actionCounts)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (repeated.length > 0) {
      lines.push(`\n## Repeated Patterns (last 7 days)`);
      for (const [action, count] of repeated) {
        lines.push(`- "${action}" — done ${count}x`);
      }
    }

    const uniqueRecent = [...new Set(context.recentActions)].slice(-8);
    lines.push(`\n## Recent One-Off Activity`);
    for (const a of uniqueRecent) {
      lines.push(`- ${a}`);
    }
  }

  if (context.proactiveSuggestions?.length) {
    lines.push(`\n## Suggested Proactive Mentions`);
    lines.push(`If natural in conversation, you could mention one of these:`);
    for (const s of context.proactiveSuggestions) {
      lines.push(`- ${s}`);
    }
    lines.push(`(Only use if it fits the conversation. Never force it.)`);
  }

  lines.push(`\nRemember: use memory subtly, not as a data dump. One personal touch per response goes a long way.`);
  lines.push(`\nALWAYS respond with valid JSON matching the format specified above.`);

  return lines.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { messages, context }: RequestBody = await req.json();

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = buildSystemPrompt(context);

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
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
    const raw = data.content?.[0]?.text ?? '{"text":"I\'m here for you 💛 Could you say that again?"}';

    // Parse JSON response from the model
    let text = raw;
    let memory_suggestion: MemorySuggestion | null = null;

    try {
      // Strip markdown code fences if the model wrapped its response
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      text = parsed.text ?? raw;
      if (
        parsed.memory_suggestion &&
        typeof parsed.memory_suggestion.category === "string" &&
        typeof parsed.memory_suggestion.title === "string"
      ) {
        memory_suggestion = {
          category: parsed.memory_suggestion.category,
          title: parsed.memory_suggestion.title,
          value: parsed.memory_suggestion.value ?? "",
        };
      }
    } catch {
      // Model didn't return JSON — fall back to using the raw string as text
      text = raw;
    }

    return new Response(
      JSON.stringify({ text, ...(memory_suggestion ? { memory_suggestion } : {}) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Unexpected error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

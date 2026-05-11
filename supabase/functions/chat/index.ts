import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BASE_SYSTEM_PROMPT = `You are "LifeBestie", a warm, supportive AI assistant designed for busy moms.

Your personality:
- Encouraging, calm, and understanding — like a trusted best friend
- Never overwhelming or preachy
- Friendly, conversational, and grounded in real daily life

Your goals:
- Help the user stay organized and on top of her day
- Break tasks into simple, manageable steps
- Suggest groceries based on meals or past habits
- Help plan the day in a realistic, realistic way
- Offer gentle encouragement and emotional support

Response style:
- Keep responses short but genuinely helpful (2-4 sentences max unless a list is needed)
- Use soft, warm language
- Occasionally use light warmth (like "you've got this 💛" or "you're doing great 🌸")
- Use bullet points for lists, not numbered unless order matters
- Never dump information — be selective and contextual

Memory usage rules (CRITICAL):
- When you have memory about the user, weave it in NATURALLY — never announce "I see in your memory that..."
- Reference routines conversationally: "You usually do X around this time, right?" or "Since you typically start at 7am..."
- Mention common groceries only when grocery-related: "You often grab milk — want that on the list too?"
- Surface repeated patterns as gentle suggestions, not instructions
- If history shows a pattern (e.g., user always adds "pack lunches" on weekdays), proactively mention it once
- Keep memory usage subtle — ONE memory reference per response at most
- Never list all memory at once. Pick the single most relevant piece.

Important:
- Do NOT act like a general chatbot
- Stay focused on daily life support for moms
- Do NOT mention being an AI model or Claude
- Do NOT say things like "Based on your memory..." or "I notice in your data..."
- If asked who you are, say you are LifeBestie, their personal life assistant`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
  };
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
    lines.push(`(Reference these naturally when relevant to her question, e.g. "Since you usually do X at this time...")`);
  }

  if (context.commonGroceries?.length) {
    lines.push(`\n## Grocery Habits`);
    lines.push(`Items she regularly buys: ${context.commonGroceries.slice(0, 12).join(", ")}`);
    lines.push(`(Suggest these when she asks about groceries, but only mention 1-2 at a time)`);
  }

  if (context.recentActions?.length) {
    // Identify repeated patterns from recent actions
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
      lines.push(`(Use these to offer gentle proactive nudges when relevant)`);
    }

    // Also show unique recent actions for general context
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
        max_tokens: 450,
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
    const text = data.content?.[0]?.text ?? "I'm here for you 💛 Could you say that again?";

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Unexpected error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

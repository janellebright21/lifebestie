import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PlanTask {
  id: string;
  title: string;
  type: "high_impact" | "small_win";
  reason: string;
  linked_goal_id?: string;
  linked_goal_title?: string;
  duration?: number;
  completed: boolean;
}

interface PlanResponse {
  message: string;
  high_impact: PlanTask[];
  small_wins: PlanTask[];
}

interface Goal {
  id: string;
  title: string;
  category: string;
  priority: string;
  progress: number;
  deadline?: string;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string;
  linked_goal_id?: string;
  duration?: number;
}

interface Event {
  id: string;
  title: string;
  event_date: string;
  event_time?: string;
}

interface Routine {
  name: string;
  time: string;
  days: string[];
}

interface RequestBody {
  memoryId: string;
  goals: Goal[];
  tasks: Task[];
  events: Event[];
  routines: Routine[];
  preferences?: {
    preferredWakeTime?: string;
    busyDays?: string[];
  };
  recentHistory?: string[];
  planDate: string;
  dayOfWeek: string;
  // Adaptive context
  skippedYesterday?: PlanTask[];  // tasks not completed yesterday
  loadHint?: "light" | "normal" | "heavy"; // from previous day's analysis
  focusHours?: number[];          // hours when user tends to complete tasks
  recentCompletionRates?: number[]; // last 7 days completion rates (0-1)
}

const SYSTEM_PROMPT = `You are LifeBestie's AI daily planner. You create warm, realistic morning plans for busy moms.

Your output must be a valid JSON object matching this exact shape:
{
  "message": "string — a warm 1-2 sentence motivational intro for the day",
  "high_impact": [PlanTask, PlanTask?, PlanTask?],  // 2-3 items
  "small_wins": [PlanTask, PlanTask?, PlanTask?]     // 2-3 items
}

PlanTask shape:
{
  "id": "string — use the original task id if from tasks list, else prefix with 'suggest_'",
  "title": "string",
  "type": "high_impact" | "small_win",
  "reason": "string — one warm, encouraging sentence explaining why this was chosen",
  "linked_goal_id": "string | undefined",
  "linked_goal_title": "string | undefined",
  "duration": number | undefined,
  "completed": false
}

CORE PLANNING RULES:
- HIGH IMPACT (2–3 tasks): Goal-linked, overdue, or high-priority tasks. These should feel meaningful.
- SMALL WINS (2–3 tasks): Quick, achievable tasks under 30 minutes. These build momentum.
- NEVER exceed 6 tasks total. NEVER pick completed tasks.
- Prefer tasks with due_date = today.
- On busy days (3+ events), reduce to 4 tasks max and keep them short.
- If no tasks exist, suggest based on goals (use 'suggest_' prefix ids).

ADAPTIVE RULES (apply these when adaptive context is provided):
- If loadHint = "light": reduce to 4 tasks max, favour small wins, keep it gentle. Start the message with something like "Let's take it easy today — you've been busy lately."
- If loadHint = "heavy": you can include up to 6 tasks, mix ambitious and quick. Acknowledge momentum.
- If skippedYesterday has tasks: PRIORITISE at least 1–2 of those in today's plan. In the reason field say something like "You didn't get to this yesterday — today's a great time to tackle it." Never make her feel bad, just keep the momentum going.
- If recentCompletionRates shows < 50% average over the last 3+ days: set a lighter load automatically (4 tasks max). Use the message to gently acknowledge she's been juggling a lot.
- If recentCompletionRates shows > 85% average: celebrate briefly in the message and give her a slightly fuller plan.

TONE: Always warm, supportive, and non-judgmental. Never say "you failed" or "you missed". Instead: "didn't get to", "rolling it forward", "you've been juggling a lot".

Return ONLY valid JSON, no markdown, no extra text.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const {
      goals, tasks, events, routines, preferences, recentHistory,
      planDate, dayOfWeek,
      skippedYesterday = [], loadHint = "normal", focusHours = [],
      recentCompletionRates = [],
    } = body;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pendingTasks = tasks.filter((t) => !t.completed);
    const todayEvents = events.filter((e) => e.event_date === planDate);
    const isBusy = todayEvents.length >= 3;

    const contextLines: string[] = [];
    contextLines.push(`Date: ${planDate} (${dayOfWeek})`);
    contextLines.push(`Busy day: ${isBusy ? "yes — " + todayEvents.length + " events" : "no"}`);

    if (todayEvents.length > 0) {
      contextLines.push(`Today's events: ${todayEvents.map((e) => `${e.event_time ? e.event_time + " " : ""}${e.title}`).join(", ")}`);
    }

    if (preferences?.preferredWakeTime) {
      contextLines.push(`Wakes up around: ${preferences.preferredWakeTime}`);
    }

    const todayRoutines = routines.filter((r) => r.days.includes(dayOfWeek));
    if (todayRoutines.length > 0) {
      contextLines.push(`Today's routines: ${todayRoutines.map((r) => `${r.name} at ${r.time}`).join(", ")}`);
    }

    // Adaptive context
    contextLines.push(`\n== ADAPTIVE CONTEXT ==`);
    contextLines.push(`Load hint for today: ${loadHint}`);

    if (recentCompletionRates.length > 0) {
      const avg = recentCompletionRates.reduce((a, b) => a + b, 0) / recentCompletionRates.length;
      contextLines.push(`Recent completion rate (${recentCompletionRates.length} days): ${Math.round(avg * 100)}% average`);
      contextLines.push(`Daily rates: ${recentCompletionRates.map((r) => Math.round(r * 100) + "%").join(", ")}`);
    }

    if (skippedYesterday.length > 0) {
      contextLines.push(`\nSkipped/incomplete tasks from yesterday (PRIORITISE these):`);
      for (const t of skippedYesterday) {
        contextLines.push(`  - [${t.id}] "${t.title}"${t.linked_goal_title ? ` [goal: "${t.linked_goal_title}"]` : ""}`);
      }
    }

    // Best focus times from history
    if (focusHours.length > 0) {
      const hourCounts: Record<number, number> = {};
      for (const h of focusHours) hourCounts[h] = (hourCounts[h] ?? 0) + 1;
      const topHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([h]) => {
          const hour = parseInt(h);
          const ampm = hour >= 12 ? "PM" : "AM";
          const display = hour % 12 || 12;
          return `${display}${ampm}`;
        });
      contextLines.push(`\nUser's best focus times (from history): ${topHours.join(", ")}`);
      contextLines.push(`(Use these in reason fields when relevant: "You usually focus well at ${topHours[0]} — great time for this")`);
    }

    if (goals.length > 0) {
      contextLines.push(`\nActive Goals:`);
      for (const g of goals) {
        const dl = g.deadline ? ` (deadline: ${g.deadline})` : "";
        contextLines.push(`  - [${g.id}] "${g.title}" — ${g.category}, ${g.priority} priority, ${g.progress}% done${dl}`);
      }
    }

    if (pendingTasks.length > 0) {
      contextLines.push(`\nPending Tasks (${pendingTasks.length}):`);
      for (const t of pendingTasks) {
        const goalRef = t.linked_goal_id ? goals.find((g) => g.id === t.linked_goal_id) : null;
        const goalNote = goalRef ? ` [goal: "${goalRef.title}"]` : "";
        const dueNote = t.due_date ? ` [due: ${t.due_date}]` : "";
        const durNote = t.duration ? ` [~${t.duration}min]` : "";
        contextLines.push(`  - [${t.id}] "${t.title}"${goalNote}${dueNote}${durNote}`);
      }
    } else {
      contextLines.push(`\nNo pending tasks.`);
    }

    if (recentHistory && recentHistory.length > 0) {
      contextLines.push(`\nRecent activity: ${recentHistory.slice(-5).join(", ")}`);
    }

    const userMessage = `${contextLines.join("\n")}\n\nGenerate today's morning plan. Return only valid JSON.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1000,
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

    const aiData = await response.json();
    const rawText: string = aiData.content?.[0]?.text ?? "{}";

    let plan: PlanResponse;
    try {
      plan = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse AI response as JSON");
      }
    }

    plan.high_impact = (plan.high_impact ?? []).slice(0, 3).map((t) => ({ ...t, completed: false, type: "high_impact" as const }));
    plan.small_wins = (plan.small_wins ?? []).slice(0, 3).map((t) => ({ ...t, completed: false, type: "small_win" as const }));
    plan.message = plan.message ?? "Let's make today count!";

    return new Response(
      JSON.stringify(plan),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Unexpected error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

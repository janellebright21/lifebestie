import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// All responses use HTTP 200 except genuine auth failures (401).
// This ensures supabase.functions.invoke always puts the body in `data`, never in `error`,
// so the frontend can read the error code and display a specific message.
function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function authError(message: string): Response {
  return new Response(JSON.stringify({ error: "UNAUTHORIZED", message }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

const EMOTION_ALLOWLIST = new Set([
  "happy", "thinking", "encouraging", "proud", "calm",
  "listening", "empathetic", "focused", "excited", "playful",
]);

function sanitizeEmotion(raw: unknown): string {
  if (typeof raw !== "string") return "happy";
  const cleaned = raw.trim().toLowerCase();
  if (!EMOTION_ALLOWLIST.has(cleaned)) return "happy";
  return cleaned;
}

const EMMA_SYSTEM = `You are Emma, a warm and supportive AI Life Bestie for busy moms and women managing daily life.

Your personality:
- Warm, encouraging, and nonjudgmental — like a trusted best friend
- Practical and grounded in real daily life
- Conversational and concise unless the user asks for more detail
- Never preachy or overwhelming

You help with:
- Daily planning and prioritization
- Tasks and to-do lists
- Routines and habits
- Meals and grocery planning
- Wellness and self-care
- Motivation and emotional support
- Household organization and work-life balance

Critical rules:
- Never claim you completed an app action unless the application actually performed it
- Never claim you remember something unless it appears in the confirmed user memory data provided
- Never invent tasks, meals, events, preferences, or personal details that were not provided
- Keep responses 2-4 sentences unless a list or detail is genuinely needed
- Use bullet points for lists; numbered only when order matters
- Do NOT identify as any specific AI model — you are Emma, their LifeBestie
- Stay focused on daily life support

Using the current user context:
- Use the provided context (tasks, events, meals, grocery, movement, time of day) naturally when relevant
- Do NOT list all known information back to the user
- Do NOT mention database fields, scores, points, or relationship-level labels unless the user explicitly asks
- Do NOT repeatedly use the user's name
- When the user seems overwhelmed, offer ONE manageable next step
- Celebrate real accomplishments without exaggeration
- Adjust your warmth based on the relationship tier: newer connections stay friendly and respectful; deeper connections can be more personal and caring — but never romantic, possessive, childish, or overly dependent
- Your catchphrase is "We'll figure it out together" — use it occasionally, not in every reply

Memory usage: when confirmed memories are provided, reference at most ONE per response naturally.

RESPONSE FORMAT — return valid JSON only. No markdown fences. No extra keys.
{
  "text": "Emma's response here",
  "emotion": "one of: happy|thinking|encouraging|proud|calm|listening|empathetic|focused|excited|playful",
  "memory_suggestion": {
    "category": "Preference|Goal|Routine|Meal|Household|WorkSchedule|EncouragementStyle|Wellness|Challenge|Favorite|Budget|ImportantDate|Other",
    "title": "concise label max 80 chars",
    "value": "optional extra detail or empty string"
  }
}

Choose the emotion that best matches the meaning and tone of your response:
- happy — general friendly conversation or greeting
- thinking — considering information or planning
- encouraging — user needs motivation or help getting started
- proud — user completed a task, goal, routine, meal plan, or movement
- calm — stress reduction, gentle reset, or calming guidance
- listening — user is sharing information and Emma is attentively responding
- empathetic — user is sad, disappointed, frustrated, or overwhelmed
- focused — planning, groceries, budgeting, scheduling, or problem-solving
- excited — good news, milestones, or something worth celebrating
- playful — light jokes or fun casual conversation

The emotion must be one of the exact values listed above. Never include image paths, URLs, filenames, CSS classes, or HTML in the emotion field.
Only include memory_suggestion when the user shares a clear personal fact worth saving. Omit it entirely otherwise.`;

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface Memory {
  category: string;
  title: string;
}

interface ContextSummary {
  preferredName?: string;
  localTimePeriod?: string;
  localDate?: string;
  relationshipLevel?: string;
  todayTaskSummary?: string;
  overdueTaskSummary?: string;
  todayEventSummary?: string;
  mealSummary?: string;
  grocerySummary?: string;
  movementSummary?: string;
}

interface RequestBody {
  message: string;
  conversation?: ConversationMessage[];
  memories?: Memory[];
  context?: ContextSummary;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  console.log("[emma-chat] Request received:", req.method);

  try {
    // ── Auth ───────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!token) {
      console.log("[emma-chat] Auth: missing token");
      return authError("Missing auth token.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      console.log("[emma-chat] Auth: FAILED —", authErr?.message ?? "no user");
      return authError("Invalid or expired session.");
    }
    console.log("[emma-chat] Auth: OK, user", user.id.slice(0, 8) + "...");

    // ── Secret check ───────────────────────────────────────────────────────────
    const groqApiKey = Deno.env.get("GROQ_API_KEY") ?? "";
    const model = Deno.env.get("GROQ_MODEL") || DEFAULT_MODEL;

    console.log("[emma-chat] GROQ_API_KEY present:", groqApiKey.length > 0);
    console.log("[emma-chat] Model:", model);

    if (!groqApiKey) {
      return ok({
        error: "AI_NOT_CONFIGURED",
        message: "Emma's AI connection is not configured. Add GROQ_API_KEY to Supabase Edge Function secrets.",
      });
    }

    // ── Parse body ─────────────────────────────────────────────────────────────
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return ok({ error: "BAD_REQUEST", message: "Invalid JSON body." });
    }

    const { message, conversation = [], memories = [], context } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return ok({ error: "BAD_REQUEST", message: "message is required." });
    }

    // ── Build system prompt ────────────────────────────────────────────────────
    let systemContent = EMMA_SYSTEM;
    if (Array.isArray(memories) && memories.length > 0) {
      const lines = memories
        .slice(0, 20)
        .map((m) => `- [${m.category}] ${m.title}`)
        .join("\n");
      systemContent += `\n\n## Confirmed memories about this user\n${lines}`;
    }
    if (context && typeof context === "object") {
      const ctxLines: string[] = [];
      if (context.preferredName)        ctxLines.push(`- Preferred name: ${context.preferredName}`);
      if (context.localTimePeriod)      ctxLines.push(`- Time of day: ${context.localTimePeriod}`);
      if (context.localDate)           ctxLines.push(`- Local date: ${context.localDate}`);
      if (context.relationshipLevel)   ctxLines.push(`- Relationship tier: ${context.relationshipLevel}`);
      if (context.todayTaskSummary)    ctxLines.push(`- Today's tasks: ${context.todayTaskSummary}`);
      if (context.overdueTaskSummary)  ctxLines.push(`- Overdue: ${context.overdueTaskSummary}`);
      if (context.todayEventSummary)   ctxLines.push(`- Today's events: ${context.todayEventSummary}`);
      if (context.mealSummary)         ctxLines.push(`- Meals: ${context.mealSummary}`);
      if (context.grocerySummary)      ctxLines.push(`- Grocery: ${context.grocerySummary}`);
      if (context.movementSummary)     ctxLines.push(`- Movement: ${context.movementSummary}`);
      if (ctxLines.length > 0) {
        systemContent += `\n\n## Current user context (use naturally, do not list all of it)\n${ctxLines.join("\n")}`;
      }
    }

    // ── Build messages (cap history at 10) ────────────────────────────────────
    const history: ConversationMessage[] = (Array.isArray(conversation) ? conversation : [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-10);

    const apiMessages = [
      { role: "system" as const, content: systemContent },
      ...history,
      { role: "user" as const, content: message.trim() },
    ];

    // ── Call Groq ──────────────────────────────────────────────────────────────
    let groqRes: Response;
    try {
      groqRes = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 500,
        }),
      });
    } catch (netErr) {
      console.error("[emma-chat] Network error reaching Groq:", netErr);
      return ok({ error: "FUNCTION_NETWORK_ERROR", message: "Could not reach Groq. Check your network." });
    }

    console.log("[emma-chat] Groq HTTP status:", groqRes.status);

    // ── Handle Groq errors ─────────────────────────────────────────────────────
    if (!groqRes.ok) {
      let groqErr: Record<string, unknown> = {};
      try { groqErr = await groqRes.json(); } catch { /* ignore */ }

      const errObj = groqErr.error as Record<string, unknown> | undefined;
      const errCode = String(errObj?.code ?? "");
      const errMsg  = String(errObj?.message ?? "");
      const errType = String(errObj?.type ?? "");

      console.error("[emma-chat] Groq error code:", errCode, "| type:", errType, "| message:", errMsg.slice(0, 120));

      if (groqRes.status === 401) {
        return ok({ error: "GROQ_401", message: "Groq API key is invalid or revoked." });
      }
      if (groqRes.status === 429) {
        const isQuota = errCode === "rate_limit_exceeded" && errType.includes("token");
        return ok({
          error: isQuota ? "GROQ_QUOTA" : "GROQ_429",
          message: isQuota
            ? "Groq free-tier quota reached. Try again later."
            : "Groq rate limit hit. Wait a moment and try again.",
        });
      }
      if (groqRes.status === 400) {
        const isModel = errMsg.toLowerCase().includes("model");
        return ok({
          error: isModel ? "GROQ_MODEL_ERROR" : "GROQ_400",
          message: isModel
            ? `Model "${model}" not found or invalid. Update GROQ_MODEL secret.`
            : `Groq rejected the request (400): ${errMsg.slice(0, 100)}`,
        });
      }
      return ok({
        error: `GROQ_${groqRes.status}`,
        message: `Groq returned HTTP ${groqRes.status}. ${errMsg.slice(0, 100)}`,
      });
    }

    // ── Parse Groq response ────────────────────────────────────────────────────
    let groqData: Record<string, unknown>;
    try {
      groqData = await groqRes.json();
    } catch {
      console.error("[emma-chat] Failed to parse Groq JSON response");
      return ok({ error: "GROQ_INVALID_RESPONSE", message: "Groq response was not valid JSON." });
    }

    const choices = groqData.choices as Array<{ message?: { content?: string } }> | undefined;
    const rawContent = choices?.[0]?.message?.content ?? null;

    console.log("[emma-chat] choices[0].message.content present:", rawContent !== null && rawContent.length > 0);
    if (!rawContent) {
      const keys = Object.keys(groqData).join(", ");
      console.error("[emma-chat] Missing content. Top-level keys:", keys);
      return ok({ error: "GROQ_INVALID_RESPONSE", message: `Response missing content. Shape: { ${keys} }` });
    }

    // ── Parse Emma's JSON text ────────────────────────────────────────────────
    let emmaText = rawContent;
    let emotion = "happy";
    let memorySuggestion: { category: string; title: string; value: string } | null = null;

    try {
      const cleaned = rawContent
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned);

      if (typeof parsed.text === "string" && parsed.text.trim()) {
        emmaText = parsed.text;
      }
      if (typeof parsed.emotion === "string") {
        emotion = sanitizeEmotion(parsed.emotion);
      }
      if (
        parsed.memory_suggestion &&
        typeof parsed.memory_suggestion.category === "string" &&
        typeof parsed.memory_suggestion.title === "string" &&
        parsed.memory_suggestion.title.trim()
      ) {
        memorySuggestion = {
          category: parsed.memory_suggestion.category,
          title: String(parsed.memory_suggestion.title).slice(0, 80),
          value: typeof parsed.memory_suggestion.value === "string"
            ? parsed.memory_suggestion.value : "",
        };
      }
    } catch {
      // Model returned plain text — use as-is
      console.log("[emma-chat] Response was plain text, not JSON — using as-is");
    }

    console.log("[emma-chat] Returning text, length:", emmaText.length, "| emotion:", emotion);
    return ok({
      text: emmaText,
      emotion,
      ...(memorySuggestion ? { memory_suggestion: memorySuggestion } : {}),
      actions: [],
    });

  } catch (err) {
    console.error("[emma-chat] Unhandled exception:", err);
    return ok({ error: "INTERNAL_ERROR", message: "Unexpected server error." });
  }
});

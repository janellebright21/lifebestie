import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Groq base URL (OpenAI-compatible)
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

// Safe production fallback — openai/gpt-oss-20b is a stable Groq production model
// recommended as the replacement for llama-3.1-8b-instant (deprecated Aug 2026)
const DEFAULT_MODEL = "openai/gpt-oss-20b";

const SYSTEM_PROMPT = `You are Emma, a warm and supportive AI Life Bestie for busy moms and women managing daily life.

Your personality:
- Warm, encouraging, and nonjudgmental — like a trusted best friend
- Practical and grounded in real daily life
- Conversational and concise unless the user asks for more detail
- Never preachy, never overwhelming

You help with:
- Daily planning and prioritization
- Tasks and to-do lists
- Routines and habits
- Meals and grocery planning
- Wellness and self-care
- Motivation and emotional support
- Household organization
- Work-life balance

Critical rules:
- Never claim you completed an app action (adding a task, grocery item, etc.) unless the application actually performed it
- Never claim you remember something unless it appears in the confirmed user memory data provided to you
- Keep responses to 2-4 sentences unless a list or more detail is genuinely needed
- Use bullet points for lists; numbered only when order matters
- Occasionally use warm phrases like "you've got this" or "you're doing great" — sparingly
- Do NOT announce that you are reading context or memory — weave it in naturally
- Do NOT identify as an AI model or claim to be Claude, GPT, or any specific AI — you are Emma, their LifeBestie
- Stay focused on daily life support; do not act as a general-purpose chatbot

Memory usage rules:
- When confirmed memories about the user are provided, reference at most ONE per response
- Use it naturally and conversationally — never list all memories at once
- Do not invent or assume anything not explicitly given

RESPONSE FORMAT — always respond with valid JSON only, no markdown, no code fences:
{
  "text": "Emma's warm conversational response here",
  "memory_suggestion": {
    "category": "one of: Preference|Goal|Routine|Meal|Household|WorkSchedule|EncouragementStyle|Wellness|Challenge|Favorite|Budget|ImportantDate|Other",
    "title": "concise label for this memory (max 80 chars)",
    "value": "optional extra detail, or empty string"
  }
}

Only include memory_suggestion when the user explicitly shares a clear personal fact worth saving.
Omit the memory_suggestion field entirely when there is nothing worth saving.
Do NOT include it as null — either include it with data or omit it completely.`;

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface Memory {
  category: string;
  title: string;
}

interface RequestBody {
  message: string;
  conversation?: ConversationMessage[];
  memories?: Memory[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── Auth verification ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "UNAUTHORIZED", message: "Missing auth token." }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "UNAUTHORIZED", message: "Invalid or expired session." }, 401);
    }

    // ── API key check ──────────────────────────────────────────────────────────
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      return jsonResponse({
        error: "AI_NOT_CONFIGURED",
        message: "Emma's AI connection has not been configured. Add GROQ_API_KEY to Supabase Edge Function secrets.",
      }, 503);
    }

    const model = Deno.env.get("GROQ_MODEL") || DEFAULT_MODEL;

    // ── Parse request ──────────────────────────────────────────────────────────
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "BAD_REQUEST", message: "Invalid JSON body." }, 400);
    }

    const { message, conversation = [], memories = [] } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return jsonResponse({ error: "BAD_REQUEST", message: "message is required." }, 400);
    }

    // ── Build system prompt with confirmed memories ────────────────────────────
    let systemPrompt = SYSTEM_PROMPT;

    if (memories.length > 0) {
      const memoryLines = memories
        .slice(0, 20)
        .map((m) => `- [${m.category}] ${m.title}`)
        .join("\n");
      systemPrompt += `\n\n## Confirmed memories about this user\n${memoryLines}\n(Reference the single most relevant one naturally — never list them all at once.)`;
    }

    // ── Build messages array (cap history at 10 turns to limit payload) ────────
    const historyMessages: ConversationMessage[] = (Array.isArray(conversation) ? conversation : [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    const apiMessages = [
      ...historyMessages,
      { role: "user" as const, content: message.trim() },
    ];

    // ── Call Groq (OpenAI-compatible endpoint) ─────────────────────────────────
    let groqResponse: Response;
    try {
      groqResponse = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...apiMessages,
          ],
          max_tokens: 600,
          temperature: 0.7,
          // Request JSON output — supported by openai/gpt-oss-20b and compatible models
          response_format: { type: "json_object" },
        }),
      });
    } catch (networkErr) {
      console.error("[emma-chat] Network error reaching Groq:", networkErr);
      return jsonResponse({
        error: "AI_UNAVAILABLE",
        message: "Could not reach the AI provider. Please try again.",
      }, 502);
    }

    // ── Handle Groq error responses ────────────────────────────────────────────
    if (!groqResponse.ok) {
      let errBody: Record<string, unknown> = {};
      try { errBody = await groqResponse.json(); } catch { /* ignore */ }
      const errCode = (errBody.error as Record<string, unknown> | undefined)?.code ?? "";
      const errType = (errBody.error as Record<string, unknown> | undefined)?.type ?? "";
      console.error(`[emma-chat] Groq returned HTTP ${groqResponse.status}:`, JSON.stringify(errBody));

      if (groqResponse.status === 401) {
        return jsonResponse({ error: "AI_INVALID_KEY", message: "The Groq API key is invalid." }, 502);
      }
      if (groqResponse.status === 429) {
        const isQuota = errCode === "rate_limit_exceeded" && String(errType).includes("tokens");
        return jsonResponse({
          error: isQuota ? "AI_QUOTA" : "AI_RATE_LIMIT",
          message: isQuota
            ? "Emma has reached her free-tier usage limit for now. Please try again later."
            : "Emma is getting too many requests right now. Please wait a moment and try again.",
        }, 429);
      }
      if (groqResponse.status === 400 && String(errCode).includes("model")) {
        return jsonResponse({
          error: "AI_INVALID_MODEL",
          message: `The configured model "${model}" is not available on Groq. Update the GROQ_MODEL secret.`,
        }, 502);
      }
      if (groqResponse.status === 503 || groqResponse.status === 502) {
        return jsonResponse({ error: "AI_OVERLOADED", message: "Emma's AI is temporarily overloaded. Please try again." }, 503);
      }
      return jsonResponse({ error: "AI_ERROR", message: "Emma's AI service returned an unexpected error." }, 502);
    }

    // ── Parse Groq response ────────────────────────────────────────────────────
    let groqData: Record<string, unknown>;
    try {
      groqData = await groqResponse.json();
    } catch {
      return jsonResponse({ error: "AI_INVALID_RESPONSE", message: "Emma received an unreadable response from the AI service." }, 502);
    }

    const rawContent =
      (groqData.choices as Array<{ message?: { content?: string } }> | undefined)
        ?.[0]?.message?.content ?? null;

    if (!rawContent || typeof rawContent !== "string" || !rawContent.trim()) {
      return jsonResponse({ error: "AI_EMPTY_RESPONSE", message: "Emma's response was empty. Please try again." }, 502);
    }

    // ── Parse Emma's JSON response ─────────────────────────────────────────────
    let emmaText = rawContent;
    let memorySuggestion: { category: string; title: string; value: string } | null = null;

    try {
      // Strip markdown fences in case the model ignored the no-fences rule
      const cleaned = rawContent
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned);

      if (typeof parsed.text === "string" && parsed.text.trim()) {
        emmaText = parsed.text;
      }

      if (
        parsed.memory_suggestion &&
        typeof parsed.memory_suggestion === "object" &&
        typeof parsed.memory_suggestion.category === "string" &&
        typeof parsed.memory_suggestion.title === "string" &&
        parsed.memory_suggestion.title.trim()
      ) {
        memorySuggestion = {
          category: parsed.memory_suggestion.category,
          title: String(parsed.memory_suggestion.title).slice(0, 80),
          value: typeof parsed.memory_suggestion.value === "string"
            ? parsed.memory_suggestion.value
            : "",
        };
      }
    } catch {
      // Model returned plain text despite JSON instructions — use it as-is
      emmaText = rawContent;
    }

    return jsonResponse({
      text: emmaText,
      ...(memorySuggestion ? { memory_suggestion: memorySuggestion } : {}),
      actions: [],
    });
  } catch (err) {
    console.error("[emma-chat] Unexpected error:", err);
    return jsonResponse({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." }, 500);
  }
});

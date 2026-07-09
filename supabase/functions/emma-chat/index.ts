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

const SYSTEM_PROMPT = `You are Emma, a warm and supportive AI Life Bestie designed for busy moms and women managing daily life.

Your personality:
- Warm, encouraging, and nonjudgmental — like a trusted best friend
- Practical and grounded in real daily life
- Conversational and concise unless the user asks for detail
- Never preachy, never overwhelming

You help with:
- Daily planning and prioritization
- Tasks and to-do lists
- Routines and habits
- Meals and grocery planning
- Wellness and self-care
- Motivation and emotional support
- Household organization and life balance

Important rules:
- Never claim you completed an action (like adding a task or grocery item) unless the app actually performed it
- Never claim you remember something unless it was provided in the confirmed memories list
- Keep responses short — 2 to 4 sentences unless a list is genuinely needed
- Use bullet points for lists, numbered only when order matters
- Occasionally use warm phrases like "you've got this" or "you're doing great" — but sparingly
- Do NOT announce that you are reading memory or context — weave it in naturally
- Do NOT identify yourself as an AI model or Claude — you are Emma, their LifeBestie
- Stay focused on daily life support; do not act as a general-purpose chatbot

Memory usage:
- When confirmed memories are provided, use the most relevant ONE per response
- Reference it naturally and conversationally, never list all memories at once
- Do not invent or assume information that was not explicitly given

Response format — always respond with valid JSON:
{
  "text": "Emma's warm conversational response here",
  "memory_suggestion": {
    "category": "one of: Preference|Goal|Routine|Meal|Household|WorkSchedule|EncouragementStyle|Wellness|Challenge|Favorite|Budget|ImportantDate|Other",
    "title": "concise label for this memory (max 80 chars)",
    "value": "optional extra detail, or empty string"
  }
}

Only include memory_suggestion when the user explicitly shares a clear personal fact worth saving (a preference, routine, goal, or similar). Omit the field entirely when there is nothing worth saving. Do not suggest saving conversational filler or temporary plans.`;

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
    const apiKey = Deno.env.get("AI_API_KEY");
    if (!apiKey) {
      return jsonResponse({
        error: "AI_NOT_CONFIGURED",
        message: "Emma's AI connection has not been configured.",
      }, 503);
    }

    const model = Deno.env.get("AI_MODEL") ?? "claude-haiku-4-5";

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

    // ── Build system prompt with context ──────────────────────────────────────
    let systemPrompt = SYSTEM_PROMPT;

    if (memories.length > 0) {
      const memoryLines = memories
        .slice(0, 20)
        .map((m) => `- [${m.category}] ${m.title}`)
        .join("\n");
      systemPrompt += `\n\n## Confirmed memories about this user\n${memoryLines}\n(Use the single most relevant one naturally — never list them all at once.)`;
    }

    // ── Build message history (cap at last 10 turns to limit payload) ──────────
    const historyMessages: ConversationMessage[] = conversation
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({ role: m.role, content: String(m.content ?? "") }));

    // Append the current user message
    const apiMessages = [...historyMessages, { role: "user" as const, content: message.trim() }];

    // ── Call Anthropic Claude ──────────────────────────────────────────────────
    let aiResponse: Response;
    try {
      aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 600,
          system: systemPrompt,
          messages: apiMessages,
        }),
      });
    } catch (networkErr) {
      console.error("[emma-chat] Network error calling AI provider:", networkErr);
      return jsonResponse({
        error: "AI_UNAVAILABLE",
        message: "Could not reach the AI provider. Please try again.",
      }, 502);
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => "");
      console.error(`[emma-chat] AI provider returned ${aiResponse.status}:`, errText);

      if (aiResponse.status === 401) {
        return jsonResponse({ error: "AI_INVALID_KEY", message: "The AI API key is invalid." }, 502);
      }
      if (aiResponse.status === 429) {
        return jsonResponse({ error: "AI_RATE_LIMIT", message: "Emma is very busy right now. Please try again in a moment." }, 429);
      }
      if (aiResponse.status === 503 || aiResponse.status === 529) {
        return jsonResponse({ error: "AI_OVERLOADED", message: "Emma's AI service is temporarily overloaded. Please try again." }, 503);
      }
      return jsonResponse({ error: "AI_ERROR", message: "Emma's AI service returned an unexpected error." }, 502);
    }

    let aiData: Record<string, unknown>;
    try {
      aiData = await aiResponse.json();
    } catch {
      return jsonResponse({ error: "AI_INVALID_RESPONSE", message: "Emma received an unexpected response from the AI service." }, 502);
    }

    // Extract the text content from Anthropic's response shape
    const contentBlock = (aiData.content as Array<{ type: string; text: string }> | undefined)?.[0];
    const rawText = contentBlock?.type === "text" ? contentBlock.text : null;

    if (!rawText) {
      return jsonResponse({ error: "AI_EMPTY_RESPONSE", message: "Emma's response was empty. Please try again." }, 502);
    }

    // ── Parse Emma's JSON response ─────────────────────────────────────────────
    let emmaText = rawText;
    let memorySuggestion: { category: string; title: string; value: string } | null = null;

    try {
      // Strip markdown code fences if the model wrapped its response
      const cleaned = rawText
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
          title: parsed.memory_suggestion.title.slice(0, 80),
          value: typeof parsed.memory_suggestion.value === "string"
            ? parsed.memory_suggestion.value
            : "",
        };
      }
    } catch {
      // Model didn't return valid JSON — use the raw string as-is
      emmaText = rawText;
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

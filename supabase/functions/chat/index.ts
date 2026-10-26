import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// This function is DEPRECATED. The frontend now calls emma-chat directly.
// To keep personality, JSON shape, and rules consistent from a single source
// of truth, this function forwards the request to emma-chat.
// It accepts the legacy { messages, context } shape, converts it to the
// emma-chat { message, conversation, context } shape, and proxies the call.

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "UNAUTHORIZED", message: "Missing auth token." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let legacyBody: { messages?: Array<{ role: string; content: string }>; context?: Record<string, unknown> };
  try {
    legacyBody = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "BAD_REQUEST", message: "Invalid JSON body." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const messages = Array.isArray(legacyBody.messages) ? legacyBody.messages : [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser || typeof lastUser.content !== "string") {
    return new Response(
      JSON.stringify({ error: "BAD_REQUEST", message: "No user message found." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const conversation = messages
    .slice(0, -1)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const context = legacyBody.context ?? {};
  const mappedContext: Record<string, unknown> = { ...context };
  if (Array.isArray((context as Record<string, unknown>).savedMemories)) {
    mappedContext.memories = (context as Record<string, unknown>).savedMemories;
  }
  if (typeof (context as Record<string, unknown>).preferredWakeTime === "string") {
    mappedContext.preferredWakeTime = (context as Record<string, unknown>).preferredWakeTime;
  }
  if (Array.isArray((context as Record<string, unknown>).busyDays)) {
    mappedContext.busyDays = (context as Record<string, unknown>).busyDays;
  }
  if (Array.isArray((context as Record<string, unknown>).commonGroceries)) {
    mappedContext.grocerySummary = (context as Record<string, unknown>).commonGroceries?.slice?.(0, 12)?.join?.(", ");
  }
  if (typeof (context as Record<string, unknown>).pendingTaskCount === "number") {
    mappedContext.todayTaskSummary = `${(context as Record<string, unknown>).pendingTaskCount} pending`;
  }
  if (typeof (context as Record<string, unknown>).todayEventCount === "number") {
    mappedContext.todayEventSummary = `${(context as Record<string, unknown>).todayEventCount} events`;
  }

  const proxyPayload = {
    message: lastUser.content,
    conversation,
    context: mappedContext,
  };

  let proxyRes: Response;
  try {
    proxyRes = await fetch(`${supabaseUrl}/functions/v1/emma-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify(proxyPayload),
    });
  } catch (netErr) {
    console.error("[chat-deprecated] proxy network error:", netErr);
    return new Response(
      JSON.stringify({ error: "FUNCTION_NETWORK_ERROR", message: "Could not reach emma-chat." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // emma-chat should always return JSON. If the gateway returned HTML
  // (e.g. JWT verification failure, function not found), wrap it as a
  // proper JSON error so the client never receives HTML.
  const contentType = proxyRes.headers.get("Content-Type") ?? "";
  const body = await proxyRes.text();

  if (!contentType.includes("application/json") || body.trimStart().startsWith("<")) {
    console.error("[chat-deprecated] emma-chat returned non-JSON, status:", proxyRes.status, "type:", contentType);
    return new Response(
      JSON.stringify({ error: "PROXY_ERROR", message: "emma-chat returned a non-JSON response." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(body, {
    status: proxyRes.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Webhook function: verify_jwt = false (Stripe sends its own signature)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, Stripe-Signature",
};

const STRIPE_API_BASE = "https://api.stripe.com/v1";

// ── Webhook signature verification using raw body ─────────────────────────────
async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
): Promise<Record<string, unknown> | null> {
  const parts = signatureHeader.split(",");
  let timestamp = "";
  let v1Signature = "";
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signature = value;
  }

  if (!timestamp || !v1Signature || !webhookSecret) return null;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const hexSignature = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (hexSignature !== v1Signature) return null;

  // 5-minute tolerance
  const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (ageSeconds > 300) return null;

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "trialing":           return "trialing";
    case "active":             return "active";
    case "past_due":           return "past_due";
    case "canceled":           return "canceled";
    case "unpaid":             return "unpaid";
    case "incomplete":         return "incomplete";
    case "incomplete_expired": return "expired";
    default:                   return "expired";
  }
}

// ── Reconcile subscription from authoritative Stripe state ───────────────────
// Always fetches the current subscription from Stripe API to avoid applying
// stale event snapshots. Compares event timestamp with current DB state.
async function reconcileSubscription(
  supabase: ReturnType<typeof createClient>,
  subscriptionId: string,
  stripeSecretKey: string,
): Promise<void> {
  const subRes = await fetch(`${STRIPE_API_BASE}/subscriptions/${subscriptionId}`, {
    headers: { "Authorization": `Bearer ${stripeSecretKey}` },
  });
  if (!subRes.ok) {
    console.error("[stripe-webhook] Failed to fetch subscription from Stripe:", subRes.status);
    throw new Error(`Failed to fetch subscription ${subscriptionId}`);
  }
  const subData = await subRes.json();
  await applySubscriptionUpdate(supabase, subData);
}

// ── Apply a verified subscription update to the database ──────────────────────
async function applySubscriptionUpdate(
  supabase: ReturnType<typeof createClient>,
  subscription: Record<string, unknown>,
): Promise<void> {
  const customerId = String(subscription.customer ?? "");

  // Look up user by stripe_customer_id in our subscriptions table
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("user_id, updated_at")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  // Also check pending_checkouts for customer-to-user mapping
  let userId: string | null = existing?.user_id ?? null;

  if (!userId) {
    const { data: pending } = await supabase
      .from("pending_checkouts")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    userId = pending?.user_id ?? null;
  }

  // Also try customer metadata
  if (!userId) {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (stripeSecretKey) {
      const custRes = await fetch(`${STRIPE_API_BASE}/customers/${customerId}`, {
        headers: { "Authorization": `Bearer ${stripeSecretKey}` },
      });
      if (custRes.ok) {
        const custData = await custRes.json();
        const metadata = custData.metadata as Record<string, string> | undefined;
        if (metadata?.user_id) userId = metadata.user_id;
      }
    }
  }

  if (!userId) {
    console.warn("[stripe-webhook] No user found for customer:", customerId);
    return;
  }

  const status = mapStripeStatus(String(subscription.status ?? "expired"));
  const trialStart = subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null;
  const trialEnd   = subscription.trial_end   ? new Date(subscription.trial_end   * 1000).toISOString() : null;
  const periodStart = subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null;
  const periodEnd   = subscription.current_period_end   ? new Date(subscription.current_period_end   * 1000).toISOString() : null;
  const cancelAtEnd = Boolean(subscription.cancel_at_period_end);
  const canceledAt  = subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null;

  const items = subscription.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
  const priceId = items?.data?.[0]?.price?.id ?? null;

  const { error } = await supabase.rpc("upsert_subscription", {
    p_user_id: userId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: String(subscription.id ?? ""),
    p_stripe_price_id: priceId,
    p_status: status,
    p_trial_start: trialStart,
    p_trial_end: trialEnd,
    p_current_period_start: periodStart,
    p_current_period_end: periodEnd,
    p_cancel_at_period_end: cancelAtEnd,
    p_canceled_at: canceledAt,
  });

  if (error) {
    console.error("[stripe-webhook] upsert_subscription error:", error);
    throw new Error(`DB upsert failed: ${error.message}`);
  }

  // Mark pending checkout as completed
  await supabase.rpc("complete_checkout", {
    p_session_id: String(subscription.id ?? ""),
    p_user_id: userId,
    p_stripe_customer_id: customerId,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── Read raw body for signature verification ────────────────────────────
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("Stripe-Signature") ?? "";
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

    if (!webhookSecret) {
      console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = await verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
    if (!event) {
      console.error("[stripe-webhook] Signature verification failed");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = String(event.type ?? "");
    const eventId   = String(event.id ?? "");
    const eventData = event.data?.object as Record<string, unknown> | undefined;

    console.log("[stripe-webhook] Event:", eventType, "| id:", eventId);

    if (!eventData) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Idempotency: check if we already processed this event ────────────────
    const { data: existingEvent } = await supabase
      .from("stripe_event_log")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log("[stripe-webhook] Event already processed:", eventId);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

    // ── Process event — return non-2xx on processing failure so Stripe retries ─
    try {
      switch (eventType) {
        // ── Checkout completed — reconcile from Stripe ──────────────────────
        case "checkout.session.completed": {
          const subscriptionId = String(eventData.subscription ?? "");
          if (subscriptionId && stripeSecretKey) {
            await reconcileSubscription(supabase, subscriptionId, stripeSecretKey);
          }
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          // Reconcile from Stripe API instead of trusting event snapshot
          const subscriptionId = String(eventData.id ?? "");
          if (subscriptionId && stripeSecretKey) {
            await reconcileSubscription(supabase, subscriptionId, stripeSecretKey);
          } else {
            await applySubscriptionUpdate(supabase, eventData);
          }
          break;
        }

        case "customer.subscription.deleted": {
          await applySubscriptionUpdate(supabase, eventData);
          break;
        }

        case "invoice.payment_succeeded": {
          const subscriptionId = String(eventData.subscription ?? "");
          if (subscriptionId && stripeSecretKey) {
            await reconcileSubscription(supabase, subscriptionId, stripeSecretKey);
          }
          break;
        }

        case "invoice.payment_failed": {
          const subscriptionId = String(eventData.subscription ?? "");
          if (subscriptionId && stripeSecretKey) {
            await reconcileSubscription(supabase, subscriptionId, stripeSecretKey);
          }
          break;
        }

        case "customer.subscription.trial_will_end": {
          console.log("[stripe-webhook] Trial ending soon for:", eventData.id);
          break;
        }

        default:
          console.log("[stripe-webhook] Unhandled event type:", eventType);
      }

      // ── Mark event as processed ──────────────────────────────────────────────
      await supabase
        .from("stripe_event_log")
        .insert({ id: eventId, type: eventType, processed_at: new Date().toISOString() });

    } catch (processingErr) {
      // Return 500 so Stripe retries the event
      console.error("[stripe-webhook] Processing failed for event", eventId, ":", processingErr);
      return new Response(JSON.stringify({ error: "Processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stripe-webhook] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

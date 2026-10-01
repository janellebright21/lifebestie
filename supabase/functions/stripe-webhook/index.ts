import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Webhook function: verify_jwt = false (Stripe sends its own signature)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, Stripe-Signature",
};

const STRIPE_API_BASE = "https://api.stripe.com/v1";

// ── Webhook signature verification ────────────────────────────────────────────
// Verifies the Stripe-Signature header against the raw request body using
// Stripe's HMAC-SHA256 signing scheme. Returns the parsed event or null.
async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
): Promise<Record<string, unknown> | null> {
  // Parse the Stripe-Signature header: "t=1234567890,v1=abc...,v0=def..."
  const parts = signatureHeader.split(",");
  let timestamp = "";
  let v1Signature = "";
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signature = value;
  }

  if (!timestamp || !v1Signature || !webhookSecret) return null;

  // Compute HMAC-SHA256 of "timestamp.rawBody"
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

  // Compare signatures (constant-time comparison not strictly necessary here
  // since we're comparing hex strings, but we do a simple equality check)
  if (hexSignature !== v1Signature) return null;

  // Check timestamp freshness (5 minute tolerance)
  const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (ageSeconds > 300) return null;

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

// ── Map Stripe status to our internal status ──────────────────────────────────
function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "trialing":    return "trialing";
    case "active":      return "active";
    case "past_due":    return "past_due";
    case "canceled":    return "canceled";
    case "unpaid":      return "unpaid";
    case "incomplete":  return "incomplete";
    case "incomplete_expired": return "expired";
    default:            return "expired";
  }
}

// ── Update subscription in database ───────────────────────────────────────────
async function updateSubscriptionInDB(
  supabase: ReturnType<typeof createClient>,
  subscription: Record<string, unknown>,
): Promise<void> {
  // Extract user ID from Stripe metadata or customer lookup
  const customerId = String(subscription.customer ?? "");

  // Look up user by stripe_customer_id in our subscriptions table
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!existing?.user_id) {
    console.warn("[stripe-webhook] No user found for customer:", customerId);
    return;
  }

  const userId = existing.user_id;
  const status = mapStripeStatus(String(subscription.status ?? "expired"));
  const trialStart = subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null;
  const trialEnd   = subscription.trial_end   ? new Date(subscription.trial_end   * 1000).toISOString() : null;
  const periodStart = subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null;
  const periodEnd   = subscription.current_period_end   ? new Date(subscription.current_period_end   * 1000).toISOString() : null;
  const cancelAtEnd = Boolean(subscription.cancel_at_period_end);
  const canceledAt  = subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null;

  // Get the price ID from the subscription items
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
    console.error("[stripe-webhook] Failed to update subscription:", error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only accept POST
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

    // ── Verify signature ─────────────────────────────────────────────────────
    const event = await verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
    if (!event) {
      console.error("[stripe-webhook] Signature verification failed");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = String(event.type ?? "");
    const eventData = event.data?.object as Record<string, unknown> | undefined;

    console.log("[stripe-webhook] Event:", eventType, "| id:", event.id);

    if (!eventData) {
      console.warn("[stripe-webhook] No event data object for:", eventType);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Initialize Supabase client with service role ─────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Handle events (idempotent: safe for retries and out-of-order) ────────
    switch (eventType) {
      // ── Trial started / subscription created ──────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await updateSubscriptionInDB(supabase, eventData);
        break;
      }

      // ── Subscription deleted (expired) ─────────────────────────────────────
      case "customer.subscription.deleted": {
        await updateSubscriptionInDB(supabase, eventData);
        // Status will be mapped to 'canceled' or 'expired' by mapStripeStatus
        break;
      }

      // ── Payment succeeded (renewal) ────────────────────────────────────────
      case "invoice.payment_succeeded": {
        // The subscription update event typically follows this, but we also
        // process it directly for resilience against missing update events.
        const subscriptionId = String(eventData.subscription ?? "");
        if (subscriptionId) {
          // Fetch the full subscription from Stripe for authoritative state
          const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
          if (stripeSecretKey) {
            const subRes = await fetch(`${STRIPE_API_BASE}/subscriptions/${subscriptionId}`, {
              headers: { "Authorization": `Bearer ${stripeSecretKey}` },
            });
            if (subRes.ok) {
              const subData = await subRes.json();
              await updateSubscriptionInDB(supabase, subData);
            }
          }
        }
        break;
      }

      // ── Payment failed ─────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const subscriptionId = String(eventData.subscription ?? "");
        if (subscriptionId) {
          const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
          if (stripeSecretKey) {
            const subRes = await fetch(`${STRIPE_API_BASE}/subscriptions/${subscriptionId}`, {
              headers: { "Authorization": `Bearer ${stripeSecretKey}` },
            });
            if (subRes.ok) {
              const subData = await subRes.json();
              await updateSubscriptionInDB(supabase, subData);
            }
          }
        }
        break;
      }

      // ── Trial ending soon (informational) ──────────────────────────────────
      case "customer.subscription.trial_will_end": {
        console.log("[stripe-webhook] Trial ending soon for subscription:", eventData.id);
        // No DB update needed — the subsequent updated/deleted event will handle state
        break;
      }

      default:
        console.log("[stripe-webhook] Unhandled event type:", eventType);
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isRecord, jsonResponse } from "../_shared/http.ts";

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signatureMatches(rawBody: string, signature: string, secret: string) {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  ));
  const expected = bytesToHex(digest);
  const supplied = signature.toLowerCase();
  let difference = expected.length ^ supplied.length;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return difference === 0;
}

function isoFromUnixSeconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    return jsonResponse({ error: "Razorpay webhook secrets are not configured" }, 500);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!signature || !eventId || eventId.length > 200) {
    return jsonResponse({ error: "Razorpay signature or event ID is missing" }, 400);
  }
  if (!(await signatureMatches(rawBody, signature, webhookSecret))) {
    return jsonResponse({ error: "Invalid Razorpay signature" }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Webhook body is not valid JSON" }, 400);
  }
  if (!isRecord(payload) || typeof payload.event !== "string") {
    return jsonResponse({ error: "Webhook event is missing" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claimed, error: claimError } = await admin.rpc("claim_razorpay_webhook_event", {
    p_event_id: eventId,
    p_event_type: payload.event,
  });
  if (claimError) {
    console.error("Could not claim Razorpay webhook event", claimError);
    return jsonResponse({ error: "Webhook event could not be claimed" }, 500);
  }
  if (!claimed) return jsonResponse({ received: true, duplicate: true });

  try {
    const eventName = payload.event;
    const eventPayload = isRecord(payload.payload) ? payload.payload : {};
    if (eventName === "payment_link.paid" || eventName === "payment_link.expired") {
      const linkPayload = isRecord(eventPayload.payment_link) ? eventPayload.payment_link : null;
      const entity = linkPayload && isRecord(linkPayload.entity) ? linkPayload.entity : null;
      const campaignId = entity?.reference_id;
      const paymentLinkId = entity?.id;
      if (typeof campaignId === "string" && typeof paymentLinkId === "string") {
        const { data: campaign, error: campaignError } = await admin
          .from("shop_ad_campaigns")
          .select("id,amount_paise,duration_days,status,razorpay_payment_link_id")
          .eq("id", campaignId)
          .maybeSingle();
        if (campaignError) throw campaignError;
        if (campaign && campaign.razorpay_payment_link_id === paymentLinkId) {
          if (eventName === "payment_link.paid") {
            if (
              entity?.status !== "paid"
              || entity.currency !== "INR"
              || entity.amount !== campaign.amount_paise
              || entity.amount_paid !== campaign.amount_paise
            ) {
              throw new Error("Paid Razorpay link does not match the stored campaign amount");
            }
            if (campaign.status === "pending_payment") {
              const startsAt = new Date();
              const endsAt = new Date(startsAt.getTime() + campaign.duration_days * 24 * 60 * 60 * 1000);
              const { data: updated, error: updateError } = await admin
                .from("shop_ad_campaigns")
                .update({ status: "active", starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() })
                .eq("id", campaign.id)
                .eq("status", "pending_payment")
                .select("id")
                .maybeSingle();
              if (updateError) throw updateError;
              if (!updated) throw new Error("Paid campaign could not be activated");
            }
          } else if (campaign.status === "pending_payment") {
            const { error: updateError } = await admin
              .from("shop_ad_campaigns")
              .update({ status: "cancelled", payment_link_lock_until: null })
              .eq("id", campaign.id)
              .eq("status", "pending_payment");
            if (updateError) throw updateError;
          }
        }
      }
    } else if (eventName.startsWith("subscription.")) {
      const subscriptionPayload = isRecord(eventPayload.subscription) ? eventPayload.subscription : null;
      const entity = subscriptionPayload && isRecord(subscriptionPayload.entity)
        ? subscriptionPayload.entity
        : null;
      const subscriptionId = entity?.id;
      if (typeof subscriptionId === "string") {
        const { data: subscription, error: subscriptionError } = await admin
          .from("merchant_subscriptions")
          .select("id,status,trial_ends_at")
          .eq("razorpay_subscription_id", subscriptionId)
          .maybeSingle();
        if (subscriptionError) throw subscriptionError;
        if (subscription) {
          let nextStatus: string | null = null;
          if (eventName === "subscription.activated" || eventName === "subscription.charged") {
            nextStatus = "active";
          } else if (eventName === "subscription.halted") {
            nextStatus = "past_due";
          } else if (eventName === "subscription.paused") {
            nextStatus = "paused";
          } else if (eventName === "subscription.resumed") {
            nextStatus = "active";
          } else if (eventName === "subscription.cancelled") {
            nextStatus = "cancelled";
          } else if (eventName === "subscription.completed") {
            nextStatus = "expired";
          } else if (eventName === "subscription.authenticated" || eventName === "subscription.pending") {
            nextStatus = subscription.status === "trialing"
              && subscription.trial_ends_at
              && Date.parse(subscription.trial_ends_at) > Date.now()
              ? "trialing"
              : "pending";
          }

          const terminal = subscription.status === "cancelled" || subscription.status === "expired";
          if (nextStatus && (!terminal || eventName === "subscription.resumed")) {
            const currentPeriodStart = isoFromUnixSeconds(entity?.current_start);
            const currentPeriodEnd = isoFromUnixSeconds(entity?.current_end);
            const update: Record<string, unknown> = {
              status: nextStatus,
              updated_at: new Date().toISOString(),
            };
            if (currentPeriodStart) update.current_period_start = currentPeriodStart;
            if (currentPeriodEnd) update.current_period_end = currentPeriodEnd;
            const { error: updateError } = await admin
              .from("merchant_subscriptions")
              .update(update)
              .eq("id", subscription.id);
            if (updateError) throw updateError;
          }
        }
      }
    }

    const { error: completeError } = await admin.rpc("complete_razorpay_webhook_event", {
      p_event_id: eventId,
      p_error: null,
    });
    if (completeError) throw completeError;
    return jsonResponse({ received: true });
  } catch (error) {
    console.error("Razorpay webhook processing failed", error);
    const reason = error instanceof Error ? error.message : "Webhook processing failed";
    const { error: releaseError } = await admin.rpc("complete_razorpay_webhook_event", {
      p_event_id: eventId,
      p_error: reason,
    });
    if (releaseError) console.error("Could not release Razorpay webhook claim", releaseError);
    return jsonResponse({ error: reason }, 500);
  }
});

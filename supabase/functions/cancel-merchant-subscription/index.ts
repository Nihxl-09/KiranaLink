import { corsHeaders, getAuthenticatedContext, jsonResponse } from "../_shared/http.ts";
import { razorpayRequest } from "../_shared/razorpay.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const context = await getAuthenticatedContext(request);
    if ("error" in context) return context.error;
    const { user, admin } = context;
    const { data: subscription, error: subscriptionError } = await admin
      .from("merchant_subscriptions")
      .select("id,status,razorpay_subscription_id,cancel_at_period_end,current_period_end,trial_ends_at")
      .eq("merchant_id", user.id)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (!subscription || !subscription.razorpay_subscription_id) {
      return jsonResponse({ error: "There is no Razorpay subscription to cancel" }, 409);
    }
    if (!["active", "trialing", "pending"].includes(subscription.status)) {
      return jsonResponse({ error: "This subscription cannot be cancelled in its current state" }, 409);
    }
    if (subscription.cancel_at_period_end) {
      return jsonResponse({
        cancellationRequested: true,
        effectiveAt: subscription.current_period_end ?? subscription.trial_ends_at,
      });
    }

    await razorpayRequest(
      `/subscriptions/${subscription.razorpay_subscription_id}/cancel`,
      { cancel_at_cycle_end: true },
    );
    const { error: updateError } = await admin
      .from("merchant_subscriptions")
      .update({
        cancel_at_period_end: true,
        cancel_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id)
      .select("id")
      .single();
    if (updateError) throw updateError;

    return jsonResponse({
      cancellationRequested: true,
      effectiveAt: subscription.current_period_end ?? subscription.trial_ends_at,
    });
  } catch (error) {
    console.error("Merchant subscription cancellation failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Subscription cancellation failed" },
      500,
    );
  }
});

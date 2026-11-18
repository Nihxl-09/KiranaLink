import { corsHeaders, getAuthenticatedContext, isRecord, jsonResponse } from "../_shared/http.ts";
import { razorpayRequest } from "../_shared/razorpay.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let releaseCheckoutClaim: (() => Promise<void>) | null = null;
  try {
    const context = await getAuthenticatedContext(request);
    if ("error" in context) return context.error;
    const { user, admin } = context;
    const body: unknown = await request.json();
    const planKey = isRecord(body) ? body.planKey : null;
    if (planKey !== "basic" && planKey !== "advanced") {
      return jsonResponse({ error: "Choose the Basic or Advanced plan" }, 400);
    }

    const { data: shop, error: shopError } = await admin
      .from("shops")
      .select("id")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop) return jsonResponse({ error: "Publish your shop before selecting a paid plan" }, 409);

    const { data: plan, error: planError } = await admin
      .from("merchant_plan_catalog")
      .select("plan_key,display_name,monthly_price_paise,razorpay_plan_id")
      .eq("plan_key", planKey)
      .single();
    if (planError) throw planError;

    const { data: claim, error: claimError } = await admin.rpc("claim_merchant_subscription_checkout", {
      p_merchant_id: user.id,
      p_plan_key: planKey,
    });
    if (claimError) throw claimError;
    if (!isRecord(claim)) throw new Error("Subscription checkout could not be prepared");
    if (claim.action === "active") {
      return jsonResponse({ active: true, planKey: claim.plan_key });
    }
    if (claim.action === "reuse" && typeof claim.checkout_url === "string") {
      return jsonResponse({ checkoutUrl: claim.checkout_url, planKey });
    }
    if (claim.action !== "create" || typeof claim.subscription_id !== "string") {
      throw new Error("Subscription checkout returned an unexpected response");
    }
    releaseCheckoutClaim = async () => {
      const { error } = await admin
        .from("merchant_subscriptions")
        .update({ checkout_lock_until: null })
        .eq("id", claim.subscription_id)
        .is("razorpay_subscription_id", null);
      if (error) throw error;
    };

    let razorpayPlanId = plan.razorpay_plan_id;
    if (!razorpayPlanId) {
      const createdPlan = await razorpayRequest("/plans", {
        period: "monthly",
        interval: 1,
        item: {
          name: `KiranaLink ${plan.display_name}`,
          description: `Monthly ${plan.display_name} merchant subscription`,
          amount: plan.monthly_price_paise,
          currency: "INR",
        },
      });
      if (typeof createdPlan.id !== "string") throw new Error("Razorpay did not return a plan ID");
      razorpayPlanId = createdPlan.id;
      const { error: planUpdateError } = await admin
        .from("merchant_plan_catalog")
        .update({ razorpay_plan_id: razorpayPlanId })
        .eq("plan_key", planKey);
      if (planUpdateError) throw planUpdateError;
    }

    const subscriptionPayload: Record<string, unknown> = {
      plan_id: razorpayPlanId,
      total_count: 1200,
      quantity: 1,
      customer_notify: true,
      notes: {
        merchant_subscription_id: claim.subscription_id,
        merchant_id: user.id,
        plan_key: planKey,
      },
    };
    if (typeof claim.trial_ends_at === "string" && Date.parse(claim.trial_ends_at) > Date.now()) {
      subscriptionPayload.start_at = Math.floor(Date.parse(claim.trial_ends_at) / 1000);
    }

    const createdSubscription = await razorpayRequest("/subscriptions", subscriptionPayload);
    if (typeof createdSubscription.id !== "string" || typeof createdSubscription.short_url !== "string") {
      throw new Error("Razorpay did not return a subscription checkout URL");
    }
    const { error: saveError } = await admin
      .from("merchant_subscriptions")
      .update({
        plan_key: planKey,
        razorpay_subscription_id: createdSubscription.id,
        checkout_url: createdSubscription.short_url,
        checkout_lock_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claim.subscription_id)
      .select("id")
      .single();
    if (saveError) {
      try {
        await razorpayRequest(`/subscriptions/${createdSubscription.id}/cancel`, {
          cancel_at_cycle_end: false,
        });
      } catch (cancelError) {
        console.error("Could not cancel an unlinked Razorpay subscription", cancelError);
      }
      throw saveError;
    }
    releaseCheckoutClaim = null;

    return jsonResponse({
      checkoutUrl: createdSubscription.short_url,
      planKey,
      trialEndsAt: claim.trial_ends_at ?? null,
    });
  } catch (error) {
    console.error("Merchant subscription checkout failed", error);
    if (releaseCheckoutClaim) {
      try {
        await releaseCheckoutClaim();
      } catch (releaseError) {
        console.error("Could not release subscription checkout claim", releaseError);
      }
    }
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Subscription checkout failed" },
      500,
    );
  }
});

import { corsHeaders, getAuthenticatedContext, isRecord, jsonResponse } from "../_shared/http.ts";
import { razorpayRequest } from "../_shared/razorpay.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let releasePaymentLinkClaim: (() => Promise<void>) | null = null;
  try {
    const context = await getAuthenticatedContext(request);
    if ("error" in context) return context.error;
    const { user, admin } = context;
    const body: unknown = await request.json();
    const campaignId = isRecord(body) ? body.campaignId : null;
    if (typeof campaignId !== "string") {
      return jsonResponse({ error: "Campaign ID is required" }, 400);
    }

    const { data: claim, error: claimError } = await admin.rpc("claim_ad_campaign_payment_link", {
      p_campaign_id: campaignId,
      p_advertiser_id: user.id,
    });
    if (claimError) throw claimError;
    if (!isRecord(claim)) throw new Error("Advertising payment link could not be prepared");
    if (claim.action === "reuse" && typeof claim.payment_url === "string") {
      return jsonResponse({ paymentUrl: claim.payment_url });
    }
    if (
      claim.action !== "create"
      || typeof claim.campaign_id !== "string"
      || typeof claim.amount_paise !== "number"
      || typeof claim.duration_days !== "number"
    ) {
      throw new Error("Advertising payment link returned an unexpected response");
    }
    releasePaymentLinkClaim = async () => {
      const { error } = await admin
        .from("shop_ad_campaigns")
        .update({ payment_link_lock_until: null })
        .eq("id", claim.campaign_id)
        .eq("status", "pending_payment");
      if (error) throw error;
    };

    const expireBy = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const paymentLink = await razorpayRequest("/payment_links", {
      amount: claim.amount_paise,
      currency: "INR",
      accept_partial: false,
      description: `KiranaLink advertisement for ${claim.duration_days} days`,
      reference_id: claim.campaign_id,
      expire_by: expireBy,
      reminder_enable: false,
      notes: {
        campaign_id: claim.campaign_id,
        advertiser_id: user.id,
      },
    });
    if (typeof paymentLink.id !== "string" || typeof paymentLink.short_url !== "string") {
      throw new Error("Razorpay did not return an advertising payment URL");
    }

    const { error: saveError } = await admin
      .from("shop_ad_campaigns")
      .update({
        razorpay_payment_link_id: paymentLink.id,
        payment_url: paymentLink.short_url,
        payment_link_expires_at: new Date(expireBy * 1000).toISOString(),
        payment_link_lock_until: null,
      })
      .eq("id", claim.campaign_id)
      .eq("status", "pending_payment")
      .select("id")
      .single();
    if (saveError) {
      try {
        await razorpayRequest(`/payment_links/${paymentLink.id}/cancel`, {});
      } catch (cancelError) {
        console.error("Could not cancel an unlinked Razorpay payment link", cancelError);
      }
      throw saveError;
    }
    releasePaymentLinkClaim = null;

    return jsonResponse({ paymentUrl: paymentLink.short_url });
  } catch (error) {
    console.error("Ad payment link creation failed", error);
    if (releasePaymentLinkClaim) {
      try {
        await releasePaymentLinkClaim();
      } catch (releaseError) {
        console.error("Could not release ad payment-link claim", releaseError);
      }
    }
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Ad payment link creation failed" },
      500,
    );
  }
});

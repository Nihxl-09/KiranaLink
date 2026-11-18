import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    return Response.json({ error: "Push function secrets are not configured" }, { status: 500 });
  }
  if (request.headers.get("x-push-webhook-secret") !== webhookSecret) {
    return Response.json({ error: "Unauthorized webhook" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const notificationId = payload.record?.id;
    if (typeof notificationId !== "string") {
      return Response.json({ error: "Webhook payload is missing notification ID" }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: notification, error: notificationError } = await admin
      .from("notifications")
      .select("id,user_id,title,body,data,push_sent_at")
      .eq("id", notificationId)
      .maybeSingle();
    if (notificationError) throw notificationError;
    if (!notification) return Response.json({ error: "Notification not found" }, { status: 404 });
    if (notification.push_sent_at) return Response.json({ delivered: true, duplicate: true });

    const { data: claimed, error: claimError } = await admin.rpc("claim_push_notification", {
      p_notification_id: notificationId,
    });
    if (claimError) throw claimError;
    if (!claimed) return Response.json({ delivered: false, duplicate: true });

    const { data: devices, error: devicesError } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", notification.user_id);
    if (devicesError) throw devicesError;

    const pushTokens = devices ?? [];
    if (pushTokens.length > 0) {
      const messages = pushTokens.map(({ token }) => ({
        to: token,
        sound: "default",
        title: notification.title,
        body: notification.body,
        data: notification.data,
        channelId: "default",
      }));
      const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
      if (!expoResponse.ok) {
        throw new Error(`Expo Push API returned HTTP ${expoResponse.status}`);
      }
      const receipt = await expoResponse.json();
      const deliveryErrors = Array.isArray(receipt.data)
        ? receipt.data.filter((ticket: { status?: string }) => ticket.status === "error")
        : [];
      if (deliveryErrors.length > 0) {
        throw new Error(`Expo Push API rejected ${deliveryErrors.length} message(s)`);
      }
    }

    const { error: updateError } = await admin
      .from("notifications")
      .update({ push_sent_at: new Date().toISOString() })
      .eq("id", notificationId)
      .is("push_sent_at", null);
    if (updateError) throw updateError;

    return Response.json({ delivered: true, deviceCount: pushTokens.length });
  } catch (error) {
    console.error("Push dispatch failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Push dispatch failed" },
      { status: 500 },
    );
  }
});

import { isRecord } from "./http.ts";

export async function razorpayRequest(
  path: string,
  payload: Record<string, unknown>,
  method = "POST",
): Promise<Record<string, unknown>> {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) {
    throw new Error("Razorpay test/live API credentials are not configured");
  }

  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
    },
    body: method === "GET" ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  let result: unknown;
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Razorpay returned an unreadable response (HTTP ${response.status})`);
  }
  if (!response.ok) {
    const error = isRecord(result) && isRecord(result.error) ? result.error : null;
    const description = error && typeof error.description === "string" ? error.description : null;
    throw new Error(description ?? `Razorpay request failed (HTTP ${response.status})`);
  }
  if (!isRecord(result)) throw new Error("Razorpay returned an invalid response");
  return result;
}

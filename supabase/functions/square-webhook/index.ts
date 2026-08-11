import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Square signs webhooks as base64(HMAC-SHA256(signature_key, notification_url + raw_body)),
// sent in the x-square-hmacsha256-signature header. notification_url must be
// the exact URL registered for this webhook subscription in the Square
// dashboard (SQUARE_WEBHOOK_NOTIFICATION_URL below) — any mismatch (trailing
// slash, http vs https) breaks verification.
// Docs: https://developer.squareup.com/docs/webhooks/step3validate

async function hmacSha256Base64(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

// Deployed with --no-verify-jwt: Square calls this directly, with no
// Supabase auth header, so signature verification below is what stands in
// for auth.
Deno.serve(async (req) => {
  // Square (and most webhook providers) send a GET/HEAD reachability check
  // when a webhook URL is first added in the dashboard, before any real
  // event is ever sent. Accept those so registration succeeds; real events
  // arrive as POST and go through full signature verification below.
  if (req.method === "GET" || req.method === "HEAD") {
    return new Response("OK", { status: 200 });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const signatureKey = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY");
    const notificationUrl = Deno.env.get("SQUARE_WEBHOOK_NOTIFICATION_URL");
    const receivedSignature = req.headers.get("x-square-hmacsha256-signature");

    if (!signatureKey || !notificationUrl) {
      console.error("Square webhook secrets not configured; rejecting webhook");
      return new Response("Not configured", { status: 500 });
    }
    if (!receivedSignature) {
      return new Response("Unauthorized", { status: 401 });
    }

    const expected = await hmacSha256Base64(signatureKey, notificationUrl + rawBody);
    if (!timingSafeEqual(expected, receivedSignature)) {
      console.error("Square webhook signature mismatch");
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    if (payload.type === "payment.updated") {
      const payment = payload.data?.object?.payment;
      if (payment?.status === "COMPLETED" && payment?.order_id) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase
          .from("enrolled_students")
          .update({ initial_payment_received: true })
          .eq("square_order_id", payment.order_id);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("square-webhook error:", err);
    return new Response("Server error", { status: 500 });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SignWell has no shared-secret webhook header. Instead each event carries
// event.hash = HMAC-SHA256(key = webhook id, message = `${event.type}@${event.time}`),
// hex-encoded. The webhook id comes from the SignWell dashboard/API when the
// webhook subscription is created — see SIGNWELL_WEBHOOK_ID below.
// Docs: https://developers.signwell.com/reference/event-hash-verification

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

// Deployed with --no-verify-jwt: SignWell calls this directly, with no
// Supabase auth header, so signature verification below is what stands in
// for auth.
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const webhookId = Deno.env.get("SIGNWELL_WEBHOOK_ID");
    if (!webhookId) {
      console.error("SIGNWELL_WEBHOOK_ID not set; rejecting webhook");
      return new Response("Not configured", { status: 500 });
    }

    const event = payload?.event;
    if (!event?.type || !event?.time || !event?.hash) {
      return new Response("Bad request", { status: 400 });
    }

    const expected = await hmacSha256Hex(webhookId, `${event.type}@${event.time}`);
    if (!timingSafeEqual(expected, event.hash)) {
      console.error("SignWell webhook signature mismatch");
      return new Response("Unauthorized", { status: 401 });
    }

    if (event.type === "document_completed") {
      const documentId = payload?.data?.object?.id;
      if (documentId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase
          .from("enrolled_students")
          .update({ documents_signed: true })
          .eq("signwell_document_id", documentId);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("signwell-webhook error:", err);
    return new Response("Server error", { status: 500 });
  }
});

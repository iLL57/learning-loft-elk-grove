import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PORTAL_URL = Deno.env.get("PORTAL_URL") || "https://thelearninglofteg.com/portal/";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ── Caller must be a logged-in admin ──
    const authHeader = req.headers.get("Authorization") || "";
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Admins only" }, 403);

    // ── Input ──
    const body = await req.json().catch(() => ({}));
    const action: string = body.action;
    const guardianId: string = body.guardianId;
    if (!["revoke", "reset"].includes(action) || !guardianId) {
      return json({ error: "action (revoke|reset) and guardianId are required" }, 400);
    }

    const { data: guardian, error: gErr } = await admin
      .from("family_guardians")
      .select("id, user_id, email")
      .eq("id", guardianId)
      .single();
    if (gErr || !guardian) return json({ error: "Guardian not found" }, 404);

    // ── Reset: send them a password-reset email ──
    if (action === "reset") {
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { error: resetErr } = await anon.auth.resetPasswordForEmail(guardian.email, {
        redirectTo: PORTAL_URL,
      });
      if (resetErr) return json({ error: resetErr.message || "Could not send the reset email" }, 400);
      return json({ success: true });
    }

    // ── Revoke: remove the family link, and the login too if it's now unused ──
    const { error: delErr } = await admin
      .from("family_guardians")
      .delete()
      .eq("id", guardianId);
    if (delErr) return json({ error: "Could not revoke access" }, 500);

    // Is this account still needed anywhere? (another family, or admin role)
    const [{ count: otherLinks }, { data: stillAdmin }] = await Promise.all([
      admin.from("family_guardians").select("id", { count: "exact", head: true }).eq("user_id", guardian.user_id),
      admin.from("user_roles").select("user_id").eq("user_id", guardian.user_id).maybeSingle(),
    ]);

    let accountDeleted = false;
    if (!otherLinks && !stillAdmin) {
      const { error: userDelErr } = await admin.auth.admin.deleteUser(guardian.user_id);
      if (userDelErr) {
        console.error("Link removed but user delete failed:", userDelErr);
      } else {
        accountDeleted = true;
      }
    }

    return json({ success: true, accountDeleted });
  } catch (err) {
    console.error(err);
    return json({ error: "Server error" }, 500);
  }
});

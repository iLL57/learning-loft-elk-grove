import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PORTAL_URL = "https://thelearninglofteg.com/portal/";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Find an existing auth user by email (inviteUserByEmail fails if the email
// is already registered — e.g. a second guardian who is already a guardian
// of another family, or an email reused from an application test).
async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const match = data.users.find(u => (u.email || "").toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
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
    const familyId: string = body.familyId;
    const email: string = (body.email || "").trim();
    const name: string | null = (body.name || "").trim() || null;
    const relationship: string | null = (body.relationship || "").trim() || null;
    if (!familyId || !email) return json({ error: "familyId and email are required" }, 400);

    const { data: family, error: famError } = await admin
      .from("families")
      .select("id, family_name")
      .eq("id", familyId)
      .single();
    if (famError || !family) return json({ error: "Family not found" }, 404);

    // ── Resolve (or create) the auth user ──
    let userId: string;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: PORTAL_URL,
    });

    if (invited?.user) {
      userId = invited.user.id;
    } else {
      // Most likely: email already registered. Find them and send a
      // password-recovery link instead so they can still set a password.
      const existing = await findUserByEmail(admin, email);
      if (!existing) return json({ error: inviteError?.message || "Could not invite that email" }, 400);
      userId = existing.id;
      await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: PORTAL_URL } });
    }

    // ── Link them to the family ──
    const { error: linkError } = await admin
      .from("family_guardians")
      .upsert(
        {
          family_id: familyId,
          user_id: userId,
          email,
          name,
          relationship,
          invited_at: new Date().toISOString(),
        },
        { onConflict: "family_id,user_id" },
      );
    if (linkError) return json({ error: "Invite sent but linking to the family failed. Try again." }, 500);

    return json({ success: true, userId });
  } catch (err) {
    console.error(err);
    return json({ error: "Server error" }, 500);
  }
});

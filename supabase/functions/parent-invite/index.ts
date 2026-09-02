import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Override with the PORTAL_URL secret for local testing
// (e.g. http://localhost:3001/portal/); unset it before go-live.
const PORTAL_URL = Deno.env.get("PORTAL_URL") || "https://thelearninglofteg.com/portal/";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// We generate the sign-in link ourselves (generateLink never sends email)
// and deliver exactly one branded message via Resend — for both brand-new
// accounts and ones that already exist (e.g. a staff admin enrolling their
// own kids). Avoids Supabase's generic "Accept Invitation" email entirely.
async function sendPortalLinkEmail(to: string, name: string | null, actionLink: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("RESEND_API_KEY not set — cannot email existing user their portal link");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "The Learning Loft <enrollments@thelearninglofteg.com>",
        to,
        subject: "Your Parent Portal Access — The Learning Loft of Elk Grove",
        html: `
          <h2>Welcome to the Parent Portal${name ? ", " + name : ""}!</h2>
          <p>You now have access to The Learning Loft parent portal, where you can view your
          family's documents, calendar, field-trip forms, and staff info.</p>
          <p><a href="${actionLink}">Set your password and sign in</a></p>
          <p>If you already have a password for this email, you can also just sign in directly at
          <a href="${PORTAL_URL}">${PORTAL_URL}</a>.</p>
          <p style="margin-top:1.5rem;">Warmly,<br>The Learning Loft of Elk Grove</p>
        `,
      }),
    });
    if (!res.ok) { console.error("Resend send failed:", await res.text()); return false; }
    return true;
  } catch (err) {
    console.error("Resend request failed:", err);
    return false;
  }
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

    // ── Resolve (or create) the auth user, get a sign-in link ──
    let userId: string;
    let actionLink: string | undefined;
    let emailNote = "";

    // type "invite" creates the user if new; fails if the email already exists.
    const { data: inviteLink, error: inviteErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: PORTAL_URL },
    });

    if (inviteLink?.user) {
      userId = inviteLink.user.id;
      actionLink = inviteLink.properties?.action_link;
    } else {
      // Already registered — issue a recovery link instead.
      const existing = await findUserByEmail(admin, email);
      if (!existing) return json({ error: inviteErr?.message || "Could not invite that email" }, 400);
      userId = existing.id;
      const { data: recoveryLink } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: PORTAL_URL },
      });
      actionLink = recoveryLink?.properties?.action_link;
    }

    if (actionLink) {
      const sent = await sendPortalLinkEmail(email, name, actionLink);
      if (!sent) emailNote = " (linked, but the email failed to send — ask them to use \"Forgot password\" on the portal)";
    } else {
      emailNote = " (could not generate their sign-in link — ask them to use \"Forgot password\" on the portal)";
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

    return json({ success: true, userId, note: emailNote || undefined });
  } catch (err) {
    console.error(err);
    return json({ error: "Server error" }, 500);
  }
});

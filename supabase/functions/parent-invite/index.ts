import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Override with the PORTAL_URL secret for local testing
// (e.g. http://localhost:3001/portal/); unset it before go-live.
const PORTAL_URL = Deno.env.get("PORTAL_URL") || "https://thelearninglofteg.com/portal/";

// Max guardians a parent can have on their own family. Admins bypass this.
const GUARDIAN_CAP = 5;

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Find an existing auth user by email (inviteUserByEmail fails if the email
// is already registered — e.g. a staff admin enrolling their own kids, or a
// second guardian who already has an account from another family).
async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const match = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

// Let the school know when a parent (not an admin) adds a co-guardian.
async function notifyAdminOfGuardianInvite(familyName: string, inviterEmail: string, invitedEmail: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const notifyEmail = Deno.env.get("NOTIFY_EMAIL");
  if (!resendKey || !notifyEmail) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "The Learning Loft <enrollments@thelearninglofteg.com>",
        to: notifyEmail,
        subject: `Parent portal: a guardian was added to the ${familyName} family`,
        html: `
          <p><strong>${esc(inviterEmail)}</strong> invited <strong>${esc(invitedEmail)}</strong>
          to the <strong>${esc(familyName)}</strong> family's parent portal.</p>
          <p>Review it on the Families tab of the admin dashboard.</p>
        `,
      }),
    });
  } catch (err) {
    console.error("Admin notification failed:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ── Caller must be logged in ──
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

    // ── Authorize: an admin, OR a guardian inviting to their OWN family ──
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    let invitedByParent = false;
    if (!isAdmin) {
      const { data: myLink } = await admin
        .from("family_guardians")
        .select("id")
        .eq("user_id", user.id)
        .eq("family_id", familyId)
        .maybeSingle();
      if (!myLink) return json({ error: "You can only invite someone to your own family." }, 403);

      const { count } = await admin
        .from("family_guardians")
        .select("id", { count: "exact", head: true })
        .eq("family_id", familyId);
      if ((count || 0) >= GUARDIAN_CAP) {
        return json({
          error: `This family already has the maximum of ${GUARDIAN_CAP} guardians. Contact the school to add another.`,
        }, 400);
      }
      invitedByParent = true;
    }

    // ── Resolve the auth user and send exactly ONE email ──
    // New account  -> inviteUserByEmail sends Supabase's "invite" email.
    // Existing one -> resetPasswordForEmail sends Supabase's "reset" email.
    let userId: string;
    let emailNote = "";

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: PORTAL_URL,
    });

    if (invited?.user) {
      userId = invited.user.id;
    } else {
      const existing = await findUserByEmail(admin, email);
      if (!existing) return json({ error: inviteErr?.message || "Could not invite that email" }, 400);
      userId = existing.id;
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { error: resetErr } = await anon.auth.resetPasswordForEmail(email, {
        redirectTo: PORTAL_URL,
      });
      if (resetErr) {
        emailNote = " — but the email failed to send; have them use \"Forgot password\" on the portal";
      }
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
          invited_by: user.id,
        },
        { onConflict: "family_id,user_id" },
      );
    if (linkError) return json({ error: "Invite sent but linking to the family failed. Try again." }, 500);

    if (invitedByParent) {
      await notifyAdminOfGuardianInvite(family.family_name, user.email || "a parent", email);
    }

    return json({ success: true, userId, note: emailNote || undefined });
  } catch (err) {
    console.error(err);
    return json({ error: "Server error" }, 500);
  }
});

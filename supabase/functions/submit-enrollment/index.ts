import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { parentFirst, parentLast, email, phone, childName, childAge, howLong, hearAbout, interest, message } = body;

    if (!parentFirst || !parentLast || !email || !childName || !childAge) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into database using service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: dbError } = await supabase
      .from("enrollment_submissions")
      .insert({
        parent_first: parentFirst,
        parent_last: parentLast,
        email,
        phone: phone || null,
        child_name: childName,
        child_age: childAge,
        how_long: howLong || null,
        hear_about: hearAbout || null,
        interest: interest || null,
        message: message || null,
      });

    if (dbError) throw new Error(JSON.stringify(dbError));

    // Send email notification via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const notifyEmail = Deno.env.get("NOTIFY_EMAIL");

    if (resendKey && notifyEmail) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "The Learning Loft <enrollments@thelearninglofteg.com>",
          to: notifyEmail,
          subject: `New Enrollment Inquiry — ${parentFirst} ${parentLast}`,
          html: `
            <h2>New Enrollment Interest Form</h2>
            <p><strong>Parent:</strong> ${parentFirst} ${parentLast}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
            <hr>
            <p><strong>Child(ren):</strong> ${childName}</p>
            <p><strong>Age(s):</strong> ${childAge}</p>
            <p><strong>Homeschooling for:</strong> ${howLong || "Not specified"}</p>
            <hr>
            <p><strong>How they heard about us:</strong> ${hearAbout || "Not specified"}</p>
            <p><strong>Most excited about:</strong> ${interest || "Not specified"}</p>
            <p><strong>Message:</strong> ${message || "None"}</p>
            <hr>
            <p style="color:#888; font-size:12px;">Submitted via the Learning Loft website enrollment form.</p>
          `,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

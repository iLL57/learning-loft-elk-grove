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
    const {
      parentName, email, phone, childName, childAge,
      daysInterest, dayPreference, tuitionExchange, charterProgram,
      hearAbout, message,
    } = body;

    if (!parentName || !email || !childName || !childAge) {
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
        parent_name: parentName,
        email,
        phone: phone || null,
        child_name: childName,
        child_age: childAge,
        days_interest: daysInterest || null,
        day_preference: dayPreference || null,
        tuition_exchange: tuitionExchange || null,
        charter_program: charterProgram || null,
        hear_about: hearAbout || null,
        message: message || null,
      });

    if (dbError) throw new Error(JSON.stringify(dbError));

    // Send email notification via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const notifyEmail = Deno.env.get("NOTIFY_EMAIL");

    if (resendKey && notifyEmail) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "The Learning Loft <enrollments@thelearninglofteg.com>",
            to: notifyEmail,
            subject: `New Pre-Enrollment Interest — ${parentName}`,
            html: `
              <h2>New Pre-Enrollment Interest Form</h2>
              <p><strong>Parent:</strong> ${parentName}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
              <hr>
              <p><strong>Child(ren):</strong> ${childName}</p>
              <p><strong>Age(s):</strong> ${childAge}</p>
              <hr>
              <p><strong>Days interested in:</strong> ${daysInterest || "Not specified"}</p>
              <p><strong>Day preference (if one day/week):</strong> ${dayPreference || "Not specified"}</p>
              <p><strong>Tuition Exchange Program:</strong> ${tuitionExchange || "Not specified"}</p>
              <p><strong>Charter / independent-study program:</strong> ${charterProgram || "Not specified"}</p>
              <hr>
              <p><strong>How they heard about us:</strong> ${hearAbout || "Not specified"}</p>
              <p><strong>Message:</strong> ${message || "None"}</p>
              <hr>
              <p style="color:#888; font-size:12px;">Submitted via the Learning Loft website pre-enrollment interest form.</p>
            `,
          }),
        });
      } catch (emailErr) {
        console.error("Resend notification failed:", emailErr);
      }
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

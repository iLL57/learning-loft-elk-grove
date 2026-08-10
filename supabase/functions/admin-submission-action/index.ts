import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRADE_LABELS: Record<string, string> = {
  TK: "TK", K: "K", "1": "1st", "2": "2nd", "3": "3rd", "4": "4th", "5": "5th", "6": "6th",
};

async function sendEmail(resendKey: string, to: string, subject: string, html: string) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "The Learning Loft <enrollments@thelearninglofteg.com>",
        to,
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error("Resend send failed:", err);
  }
}

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
    // Verify the caller is a logged-in admin
    const authHeader = req.headers.get("Authorization") || "";
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { submissionId, action, confirmedGrades } = await req.json();
    if (!submissionId || !["send_package", "waitlist", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const VALID_GRADES = ["TK", "K", "1", "2", "3", "4", "5", "6"];
    if (action === "send_package") {
      if (!confirmedGrades || typeof confirmedGrades !== "object") {
        return new Response(JSON.stringify({ error: "Missing confirmed grade levels" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      for (const grade of Object.values(confirmedGrades)) {
        if (!VALID_GRADES.includes(grade as string)) {
          return new Response(JSON.stringify({ error: `Invalid grade level: ${grade}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: submission, error: subError } = await supabase
      .from("enrollment_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();
    if (subError || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: students } = await supabase
      .from("submission_students")
      .select("*")
      .eq("submission_id", submissionId);

    const studentList = students || [];
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const studentsListHtml = studentList
      .map(s => `<li>${s.student_name} — ${GRADE_LABELS[s.grade_level] || s.grade_level}</li>`)
      .join("");

    if (action === "send_package") {
      // Create one enrolled_students row per child, awaiting signature + payment.
      // TODO (Phase 2): create a SignWell signing request per student here and
      // store the resulting document/link on each row instead of a placeholder.
      // TODO (Phase 3): create a Square payment link for the initial enrollment
      // fee here instead of a placeholder.
      if (studentList.length) {
        const missingGrade = studentList.find(s => !confirmedGrades[s.id]);
        if (missingGrade) {
          return new Response(JSON.stringify({ error: `Missing confirmed grade for ${missingGrade.student_name}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error: insertError } = await supabase.from("enrolled_students").insert(
          studentList.map(s => ({
            parent_name: submission.parent_name,
            email: submission.email,
            phone: submission.phone,
            student_name: s.student_name,
            student_age: "",
            grade_level: confirmedGrades[s.id],
            payment_status: "pending",
            documents_signed: false,
            initial_payment_received: false,
            submission_id: submission.id,
          }))
        );
        if (insertError) throw new Error(JSON.stringify(insertError));
      }

      await supabase.from("enrollment_submissions").update({ status: "package_sent" }).eq("id", submissionId);

      if (resendKey) {
        await sendEmail(resendKey, submission.email,
          "Your Enrollment Package — The Learning Loft of Elk Grove",
          `
            <h2>Welcome to The Learning Loft, ${submission.parent_name}!</h2>
            <p>We're delighted to move forward with enrollment for:</p>
            <ul>${studentsListHtml}</ul>
            <p>Our team will follow up shortly with a signing link for each child's enrollment paperwork and a link to submit your initial payment. Once both are complete, your child's spot will be confirmed.</p>
            <p>Questions in the meantime? Just reply to this email or reach out at info@thelearninglofteg.com.</p>
            <p style="margin-top:1.5rem;">Warmly,<br>The Learning Loft of Elk Grove</p>
          `
        );
      }
    }

    if (action === "waitlist") {
      await supabase.from("enrollment_submissions").update({ status: "waitlisted" }).eq("id", submissionId);
      if (resendKey) {
        await sendEmail(resendKey, submission.email,
          "You're on Our Waitlist — The Learning Loft of Elk Grove",
          `
            <h2>Thank you for applying, ${submission.parent_name}!</h2>
            <p>We've added the following to our waitlist:</p>
            <ul>${studentsListHtml}</ul>
            <p>We're at capacity right now, but we'll reach out as soon as a spot opens up. Waitlist offers are made in the order applications were received.</p>
            <p>Questions in the meantime? Just reply to this email or reach out at info@thelearninglofteg.com.</p>
            <p style="margin-top:1.5rem;">Warmly,<br>The Learning Loft of Elk Grove</p>
          `
        );
      }
    }

    if (action === "reject") {
      await supabase.from("enrollment_submissions").update({ status: "rejected" }).eq("id", submissionId);
      if (resendKey) {
        await sendEmail(resendKey, submission.email,
          "Regarding Your Application — The Learning Loft of Elk Grove",
          `
            <h2>Thank you for your interest, ${submission.parent_name}.</h2>
            <p>We appreciate you taking the time to apply to The Learning Loft of Elk Grove. We are not enrolling at this time.</p>
            <p>We wish your family all the best, and welcome you to reach out in the future.</p>
            <p style="margin-top:1.5rem;">Warmly,<br>The Learning Loft of Elk Grove</p>
          `
        );
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

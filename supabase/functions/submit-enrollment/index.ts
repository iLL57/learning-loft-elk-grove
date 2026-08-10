import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRADE_LABELS: Record<string, string> = {
  TK: "TK", K: "K", "1": "1st", "2": "2nd", "3": "3rd", "4": "4th", "5": "5th", "6": "6th",
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
      parentName, email, phone, students,
      daysInterest, dayPreference, tuitionExchange, charterProgram,
      hearAbout, message,
    } = body;

    if (!parentName || !email || !Array.isArray(students) || students.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const s of students) {
      if (!s.name || !s.gradeLevel) {
        return new Response(JSON.stringify({ error: "Each student needs a name and grade level" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: submission, error: dbError } = await supabase
      .from("enrollment_submissions")
      .insert({
        parent_name: parentName,
        email,
        phone: phone || null,
        days_interest: daysInterest || null,
        day_preference: dayPreference || null,
        tuition_exchange: tuitionExchange || null,
        charter_program: charterProgram || null,
        hear_about: hearAbout || null,
        message: message || null,
      })
      .select()
      .single();

    if (dbError) throw new Error(JSON.stringify(dbError));

    const { error: studentsError } = await supabase
      .from("submission_students")
      .insert(students.map((s: { name: string; gradeLevel: string }) => ({
        submission_id: submission.id,
        student_name: s.name,
        grade_level: s.gradeLevel,
      })));

    if (studentsError) throw new Error(JSON.stringify(studentsError));

    const studentsListHtml = students
      .map((s: { name: string; gradeLevel: string }) => `<li>${s.name} — ${GRADE_LABELS[s.gradeLevel] || s.gradeLevel}</li>`)
      .join("");

    // Send email notifications via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const notifyEmail = Deno.env.get("NOTIFY_EMAIL");

    if (resendKey) {
      // Notify admin
      if (notifyEmail) {
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
              subject: `New Online Application — ${parentName}`,
              html: `
                <h2>New Online Application</h2>
                <p><strong>Parent:</strong> ${parentName}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
                <hr>
                <p><strong>Student(s):</strong></p>
                <ul>${studentsListHtml}</ul>
                <hr>
                <p><strong>Days interested in:</strong> ${daysInterest || "Not specified"}</p>
                <p><strong>Day preference (if one day/week):</strong> ${dayPreference || "Not specified"}</p>
                <p><strong>Tuition Exchange Program:</strong> ${tuitionExchange || "Not specified"}</p>
                <p><strong>Charter / independent-study program:</strong> ${charterProgram || "Not specified"}</p>
                <hr>
                <p><strong>How they heard about us:</strong> ${hearAbout || "Not specified"}</p>
                <p><strong>Message:</strong> ${message || "None"}</p>
                <hr>
                <p style="color:#888; font-size:12px;">Submitted via the Learning Loft website online application. Review it in the admin portal.</p>
              `,
            }),
          });
        } catch (emailErr) {
          console.error("Resend admin notification failed:", emailErr);
        }
      }

      // Acknowledge the applicant
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "The Learning Loft <enrollments@thelearninglofteg.com>",
            to: email,
            subject: "We received your application — The Learning Loft of Elk Grove",
            html: `
              <h2>Thank you, ${parentName}!</h2>
              <p>We've received your online application for:</p>
              <ul>${studentsListHtml}</ul>
              <p>Our team will review your application and follow up soon with next steps. This email confirms we received it. It does not confirm enrollment.</p>
              <p>Questions in the meantime? Just reply to this email or reach out at info@thelearninglofteg.com.</p>
              <p style="margin-top:1.5rem;">Warmly,<br>The Learning Loft of Elk Grove</p>
            `,
          }),
        });
      } catch (emailErr) {
        console.error("Resend applicant acknowledgment failed:", emailErr);
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRADE_LABELS: Record<string, string> = {
  TK: "TK", K: "K", "1": "1st", "2": "2nd", "3": "3rd", "4": "4th", "5": "5th", "6": "6th",
};

const GRADE_CAPACITY = 10;

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

// One SignWell document per student (parent signs on the child's behalf).
// Uses "documents from template" so field placement lives in the SignWell
// template the owner builds from the 3 enrollment PDFs, not in this code.
async function createSignWellDocument(
  apiKey: string,
  templateId: string,
  testMode: boolean,
  recipientName: string,
  recipientEmail: string,
  templateFields: Record<string, string>,
): Promise<{ id: string; signingUrl: string } | null> {
  try {
    const res = await fetch("https://www.signwell.com/api/v1/document_templates/documents/", {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        template_ids: [templateId],
        test_mode: testMode,
        recipients: [{
          id: "1",
          name: recipientName,
          email: recipientEmail,
          placeholder_name: "Parent/Guardian",
        }],
        template_fields: Object.entries(templateFields).map(([api_id, value]) => ({ api_id, value })),
      }),
    });
    if (!res.ok) {
      console.error("SignWell create document failed:", await res.text());
      return null;
    }
    const doc = await res.json();
    return { id: doc.id, signingUrl: doc.recipients?.[0]?.signing_url || "" };
  } catch (err) {
    console.error("SignWell request failed:", err);
    return null;
  }
}

// One Square quick-pay link per student for the initial enrollment fee.
// Sandbox and production are entirely separate base URLs in Square's API,
// not just different tokens against the same host.
async function createSquarePaymentLink(
  accessToken: string,
  locationId: string,
  feeCents: number,
  idempotencyKey: string,
  studentName: string,
  baseUrl: string,
): Promise<{ id: string; orderId: string; url: string } | null> {
  try {
    const res = await fetch(`${baseUrl}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        quick_pay: {
          name: `The Learning Loft — Initial Enrollment Fee (${studentName})`,
          price_money: { amount: feeCents, currency: "USD" },
          location_id: locationId,
        },
      }),
    });
    if (!res.ok) {
      console.error("Square create payment link failed:", await res.text());
      return null;
    }
    const body = await res.json();
    const link = body.payment_link;
    return { id: link.id, orderId: link.order_id, url: link.url };
  } catch (err) {
    console.error("Square request failed:", err);
    return null;
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
      // SignWell/Square calls below are best-effort: if credentials aren't set
      // yet (Phase 2/3 not wired up) or a call fails, the student row is still
      // created and the applicant gets a placeholder message instead of a link.
      let linkRows: { studentName: string; signingUrl: string; paymentUrl: string }[] = [];

      if (studentList.length) {
        const missingGrade = studentList.find(s => !confirmedGrades[s.id]);
        if (missingGrade) {
          return new Response(JSON.stringify({ error: `Missing confirmed grade for ${missingGrade.student_name}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Enforce the per-grade capacity, counting both already-enrolled
        // students and every student in this same request targeting the
        // same grade (e.g. two siblings both confirmed into "K").
        const { data: existingGradeRows } = await supabase
          .from("enrolled_students")
          .select("grade_level");
        const existingCountByGrade: Record<string, number> = {};
        for (const row of existingGradeRows || []) {
          existingCountByGrade[row.grade_level] = (existingCountByGrade[row.grade_level] || 0) + 1;
        }
        const pendingCountByGrade: Record<string, number> = {};
        for (const s of studentList) {
          const g = confirmedGrades[s.id];
          pendingCountByGrade[g] = (pendingCountByGrade[g] || 0) + 1;
        }
        const fullGrades = Object.entries(pendingCountByGrade)
          .filter(([grade, pendingCount]) => (existingCountByGrade[grade] || 0) + pendingCount > GRADE_CAPACITY)
          .map(([grade]) => GRADE_LABELS[grade] || grade);
        if (fullGrades.length) {
          return new Response(JSON.stringify({
            error: `Grade level${fullGrades.length > 1 ? "s" : ""} at capacity (max ${GRADE_CAPACITY} per grade): ${fullGrades.join(", ")}`
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: inserted, error: insertError } = await supabase.from("enrolled_students").insert(
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
        ).select();
        if (insertError) throw new Error(JSON.stringify(insertError));

        const signwellApiKey = Deno.env.get("SIGNWELL_API_KEY");
        const signwellTemplateId = Deno.env.get("SIGNWELL_TEMPLATE_ID");
        const signwellTestMode = Deno.env.get("SIGNWELL_TEST_MODE") !== "false"; // default true (safe) until owner confirms go-live
        const squareAccessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
        const squareLocationId = Deno.env.get("SQUARE_LOCATION_ID");
        const squareFeeCents = Number(Deno.env.get("SQUARE_INITIAL_FEE_CENTS") || "0");
        const squareBaseUrl = Deno.env.get("SQUARE_ENVIRONMENT") === "sandbox"
          ? "https://connect.squareupsandbox.com"
          : "https://connect.squareup.com";

        for (const row of inserted || []) {
          const updates: Record<string, unknown> = {};
          let signingUrl = "";
          let paymentUrl = "";

          if (signwellApiKey && signwellTemplateId) {
            const doc = await createSignWellDocument(
              signwellApiKey, signwellTemplateId, signwellTestMode,
              submission.parent_name, submission.email,
              {
                student_name: row.student_name,
                student_name_liability: row.student_name,
                parent_name: submission.parent_name,
                parent_phone: submission.phone || "",
                parent_email: submission.email,
                parent_printed_name: submission.parent_name,
                parent_printed_name_liability: submission.parent_name,
              }
            );
            if (doc) {
              updates.signwell_document_id = doc.id;
              updates.signwell_signing_url = doc.signingUrl;
              signingUrl = doc.signingUrl;
            }
          }

          if (squareAccessToken && squareLocationId && squareFeeCents > 0) {
            const link = await createSquarePaymentLink(
              squareAccessToken, squareLocationId, squareFeeCents, row.id, row.student_name, squareBaseUrl
            );
            if (link) {
              updates.square_payment_link_id = link.id;
              updates.square_order_id = link.orderId;
              updates.square_payment_link_url = link.url;
              paymentUrl = link.url;
            }
          }

          if (Object.keys(updates).length) {
            await supabase.from("enrolled_students").update(updates).eq("id", row.id);
          }

          linkRows.push({ studentName: row.student_name, signingUrl, paymentUrl });
        }
      }

      await supabase.from("enrollment_submissions").update({ status: "package_sent" }).eq("id", submissionId);

      if (resendKey) {
        const perStudentHtml = linkRows.length
          ? linkRows.map(l => `
              <li style="margin-bottom:.75rem;">
                <strong>${l.studentName}</strong><br>
                ${l.signingUrl ? `<a href="${l.signingUrl}">Sign enrollment forms</a>` : "Signing link coming shortly by email."}
                ${l.paymentUrl ? ` &middot; <a href="${l.paymentUrl}">Pay initial fee</a>` : ""}
              </li>
            `).join("")
          : studentsListHtml;

        await sendEmail(resendKey, submission.email,
          "Your Enrollment Package — The Learning Loft of Elk Grove",
          `
            <h2>Welcome to The Learning Loft, ${submission.parent_name}!</h2>
            <p>We're delighted to move forward with enrollment for:</p>
            <ul>${perStudentHtml}</ul>
            <p>Each child's enrollment paperwork and initial payment must be completed before their spot is confirmed. If a link above isn't ready yet, our team will follow up shortly by email.</p>
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

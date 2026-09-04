import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Escape submitted text before interpolating into notification-email HTML.
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );

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
    const { firstName, lastName, email, phone, subject, message } = body;

    if (!firstName || !lastName || !email || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: dbError } = await supabase
      .from("contact_submissions")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        subject: subject || null,
        message,
      });

    if (dbError) throw new Error(JSON.stringify(dbError));

    // Send email notifications via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const notifyEmail = Deno.env.get("NOTIFY_EMAIL");
    const fullName = `${firstName} ${lastName}`;
    const fullNameHtml = esc(fullName);

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
              subject: `New Contact Message — ${fullName}`,
              html: `
                <h2>New Contact Message</h2>
                <p><strong>Name:</strong> ${fullNameHtml}</p>
                <p><strong>Email:</strong> ${esc(email)}</p>
                <p><strong>Phone:</strong> ${phone ? esc(phone) : "Not provided"}</p>
                <p><strong>Subject:</strong> ${subject ? esc(subject) : "Not specified"}</p>
                <hr>
                <p><strong>Message:</strong></p>
                <p>${esc(message).replace(/\n/g, "<br>")}</p>
                <hr>
                <p style="color:#888; font-size:12px;">Submitted via the Learning Loft website contact form. Review it in the admin portal.</p>
              `,
            }),
          });
        } catch (emailErr) {
          console.error("Resend admin notification failed:", emailErr);
        }
      }

      // Acknowledge the sender
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
            subject: "We received your message — The Learning Loft of Elk Grove",
            html: `
              <h2>Thank you, ${esc(firstName)}!</h2>
              <p>We've received your message and will be in touch within 2-3 business days.</p>
              <p>Questions in the meantime? Just reply to this email or reach out at info@thelearninglofteg.com.</p>
              <p style="margin-top:1.5rem;">Warmly,<br>The Learning Loft of Elk Grove</p>
            `,
          }),
        });
      } catch (emailErr) {
        console.error("Resend sender acknowledgment failed:", emailErr);
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

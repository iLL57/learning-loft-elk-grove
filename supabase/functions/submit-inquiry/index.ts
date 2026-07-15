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
    const { name, firstName, lastName, email, phone, childAge, subject, message } = body;

    const displayName = name || [firstName, lastName].filter(Boolean).join(" ");

    if (!displayName || !email || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
            subject: `New Website Inquiry — ${displayName}`,
            html: `
              <h2>New General Inquiry</h2>
              <p><strong>Name:</strong> ${displayName}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
              ${childAge ? `<p><strong>Child's age(s):</strong> ${childAge}</p>` : ""}
              ${subject ? `<p><strong>Topic:</strong> ${subject}</p>` : ""}
              <hr>
              <p><strong>Message:</strong> ${message}</p>
              <hr>
              <p style="color:#888; font-size:12px;">Submitted via the Learning Loft website contact form.</p>
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

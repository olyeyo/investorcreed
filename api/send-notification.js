// This file lives in /api, which Vercel automatically runs as a serverless
// function (regardless of the Vite frontend framework) — it never gets
// bundled into the client-side JS, so RESEND_API_KEY (set as a plain Vercel
// env var, NOT prefixed with VITE_) stays server-only and out of the public
// bundle. The browser calls this endpoint; it never talks to Resend directly.

import { Resend } from "resend";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RESEND_API_KEY is not set on the server." });
  }

  const { contactName, action, notes } = req.body || {};
  if (!contactName || !action) {
    return res.status(400).json({ error: "contactName and action are required." });
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: "Outreach Terminal <onboarding@resend.dev>",
      to: "olyeyo3@gmail.com",
      subject: `Outreach update: ${contactName} — ${action}`,
      html: `
        <p><strong>${escapeHtml(contactName)}</strong> was just marked <strong>${escapeHtml(action)}</strong> in your outreach tracker.</p>
        ${notes ? `<p>Notes: ${escapeHtml(notes)}</p>` : ""}
      `,
    });

    if (error) return res.status(502).json({ error: error.message || "Resend rejected the request." });
    return res.status(200).json({ id: data?.id || null });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to send notification email." });
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

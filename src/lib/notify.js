// Fire-and-forget: a failed notification email should never block the
// underlying pipeline action (marking contacted, changing status, etc).
// Errors are returned rather than thrown so callers can surface them softly.
export async function sendContactNotification(contactName, action, notes) {
  try {
    const res = await fetch("/api/send-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactName, action, notes }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || `Notification failed (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || "Notification request failed." };
  }
}

import { env, escapeHtml } from "./util.ts";

export interface Mail {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text version; mail with one is less likely to be marked as spam. */
  text?: string;
  replyTo?: string;
}

/** False when neither Resend nor Mailpit is set up, so sendMail would skip sending. */
export const mailConfigured = () => Boolean(Deno.env.get("RESEND_API_KEY") || Deno.env.get("MAILPIT_URL"));

/**
 * Sends email through Resend in production (RESEND_API_KEY set).
 * In local development it posts to the Mailpit container that `supabase start` runs,
 * so emails show up at http://localhost:54324.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const to = Array.isArray(mail.to) ? mail.to : [mail.to];
  if (to.length === 0) return;

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.mailFrom,
        to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        reply_to: mail.replyTo,
      }),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
    return;
  }

  const mailpit = Deno.env.get("MAILPIT_URL");
  if (mailpit) {
    const [, name = "", email = env.mailFrom] = env.mailFrom.match(/^(.*?)\s*<(.+)>$/) ?? [];
    const res = await fetch(`${mailpit.replace(/\/$/, "")}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: email, Name: name },
        To: to.map((Email) => ({ Email })),
        ReplyTo: mail.replyTo ? [{ Email: mail.replyTo }] : [],
        Subject: mail.subject,
        HTML: mail.html,
        Text: mail.text ?? "",
      }),
    });
    if (!res.ok) throw new Error(`Mailpit error ${res.status}: ${await res.text()}`);
    return;
  }

  console.warn("No RESEND_API_KEY or MAILPIT_URL set; email not sent:", mail.subject, to);
}

/** Simple branded wrapper so every email looks consistent. */
export function layout(title: string, bodyHtml: string, button?: { label: string; url: string }): string {
  const btn = button
    ? `<p style="margin:28px 0"><a href="${escapeHtml(button.url)}" style="background:#333;color:#fff;padding:12px 22px;text-decoration:none;font-weight:bold;letter-spacing:1px;font-size:13px">${escapeHtml(button.label.toUpperCase())}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#333">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff">
      <tr><td style="background:#333;color:#fff;padding:18px 24px;font-size:18px;letter-spacing:1px">FIRST CHOICE HOMES</td></tr>
      <tr><td style="padding:24px">
        <h2 style="margin:0 0 16px;font-weight:normal;color:#687887">${escapeHtml(title)}</h2>
        ${bodyHtml}${btn}
      </td></tr>
      <tr><td style="padding:14px 24px;font-size:12px;color:#888;border-top:1px solid #eee">
        First Choice Homes LLC · 175 N First St Ste A, Kalama, WA · (360) 673-2926
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

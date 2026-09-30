import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { layout, mailConfigured, sendMail } from "./mail.ts";
import { env, escapeHtml } from "./util.ts";

/**
 * Emails someone who already has an account a one-time sign-in button and code.
 *
 * We make the token ourselves instead of using Supabase's own sign-in email because:
 * - Supabase treats invited people who haven't signed in yet as new sign-ups, which are turned
 *   off, so it refused to email them at all.
 * - Its links sign in the moment anything opens them, so email security scanners used them up
 *   and people saw "expired". Ours open the portal, which signs in only when the person presses
 *   a button (see pendingLink in src/lib/supabase.ts). The code works on any device.
 *
 * Never call this for an address without an account: generateLink would create one.
 */
export async function sendSignInEmail(db: SupabaseClient, email: string, invite?: { name: string }): Promise<void> {
  if (!mailConfigured()) throw new Error("Email is not set up: set the RESEND_API_KEY secret");

  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const { hashed_token, email_otp: code } = data.properties;

  // new URL() keeps this right whether SITE_URL is set with or without /app.
  const portal = new URL("/app/", env.siteUrl).href;
  const link = `${portal}?token_hash=${encodeURIComponent(hashed_token)}&type=email`;
  const expiry = "The button and code work once and expire in 1 hour.";

  const codeHtml = `<p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:8px 0 20px">${escapeHtml(code)}</p>`;
  const noteStyle = "font-size:13px;color:#888";

  if (invite) {
    const hi = invite.name ? `Hi ${invite.name},\n\n` : "";
    await sendMail({
      to: email,
      subject: "You're invited to the First Choice Homes client portal",
      html: layout(
        "Welcome to the client portal",
        `${invite.name ? `<p>Hi ${escapeHtml(invite.name)},</p>` : ""}
        <p>You now have access to the First Choice Homes client portal. Press the button to sign in, or enter this code on the sign-in page:</p>
        ${codeHtml}
        <p style="${noteStyle}">${expiry} After that, sign in any time at <a href="${escapeHtml(portal)}">${escapeHtml(portal)}</a> with this email address and we'll send you a new code.</p>`,
        { label: "Open the portal", url: link },
      ),
      text: `${hi}You now have access to the First Choice Homes client portal.\n\nSign in: ${link}\n\nOr enter this code on the sign-in page: ${code}\n\n${expiry} After that, sign in any time at ${portal} with this email address and we'll send you a new code.`,
    });
    return;
  }

  await sendMail({
    to: email,
    subject: `Your First Choice Homes sign-in code: ${code}`,
    html: layout(
      "Sign in to the client portal",
      `<p>Press the button to sign in, or enter this code on the sign-in page:</p>
      ${codeHtml}
      <p style="${noteStyle}">${expiry} If you didn't ask to sign in, you can ignore this email.</p>`,
      { label: "Sign in", url: link },
    ),
    text: `Sign in to the First Choice Homes client portal: ${link}\n\nOr enter this code on the sign-in page: ${code}\n\n${expiry} If you didn't ask to sign in, you can ignore this email.`,
  });
}

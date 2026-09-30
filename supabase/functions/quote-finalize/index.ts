// Step 2 of a quote request (shown to people as a "website inquiry"): after the browser finishes
// uploading, mark the quote as new and email the office (Reply-To = the client) plus a
// confirmation to the client.
import { adminClient, env, escapeHtml, HttpError, json, serve } from "../_shared/util.ts";
import { layout, sendMail } from "../_shared/mail.ts";

const LINK_TTL_SECONDS = 60 * 60 * 24 * 7;

// Locally, SUPABASE_URL is Docker's internal address; emails need the browser-reachable one.
function publicUrl(url: string): string {
  const external = Deno.env.get("PUBLIC_SUPABASE_URL");
  return external ? url.replace(Deno.env.get("SUPABASE_URL")!, external.replace(/\/$/, "")) : url;
}

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const { quoteId } = await req.json().catch(() => ({}));
  if (typeof quoteId !== "string") throw new HttpError(400, "Invalid request");

  const db = adminClient();
  const { data: quote } = await db
    .from("quote_requests")
    .select("*")
    .eq("id", quoteId)
    .eq("status", "draft")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .maybeSingle();
  if (!quote) throw new HttpError(404, "Inquiry not found or already submitted");

  // Keep only files that actually finished uploading.
  const { data: stored } = await db.storage.from("quote-uploads").list(quoteId);
  const storedNames = new Set((stored ?? []).map((o) => `${quoteId}/${o.name}`));
  const paths: string[] = quote.file_paths.filter((p: string) => storedNames.has(p));

  const { error } = await db
    .from("quote_requests")
    .update({ status: "new", file_paths: paths, submitted_at: new Date().toISOString() })
    .eq("id", quoteId);
  if (error) throw error;

  const links: { name: string; url: string }[] = [];
  for (const path of paths) {
    const { data } = await db.storage.from("quote-uploads").createSignedUrl(path, LINK_TTL_SECONDS);
    if (data) links.push({ name: path.split("/").pop()!.replace(/^\d+-/, ""), url: publicUrl(data.signedUrl) });
  }

  const row = (label: string, value: string | null) =>
    value ? `<tr><td style="padding:4px 12px 4px 0;color:#888;vertical-align:top">${label}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>` : "";

  const filesHtml = links.length
    ? `<p><strong>Attachments</strong> (links work for 7 days; always available in the portal):</p><ul>${links
        .map((l) => `<li><a href="${escapeHtml(l.url)}">${escapeHtml(l.name)}</a></li>`)
        .join("")}</ul>`
    : "<p><em>No attachments.</em></p>";

  await sendMail({
    to: env.officeEmail,
    replyTo: quote.email,
    subject: `New website inquiry from ${quote.name || quote.email}`,
    html: layout(
      "New website inquiry",
      `<table style="font-size:14px;margin-bottom:12px">
        ${row("Name", quote.name)}${row("Email", quote.email)}${row("Phone", quote.phone)}${row("Address", quote.address)}
      </table>
      ${quote.message ? `<p style="white-space:pre-wrap;background:#f7f7f7;padding:12px">${escapeHtml(quote.message)}</p>` : ""}
      ${filesHtml}
      <p style="color:#888;font-size:13px">Reply to this email to respond directly to the client.</p>`,
      { label: "Open inquiries", url: `${env.siteUrl}/app/#/admin/quotes` },
    ),
  });

  await sendMail({
    to: quote.email,
    replyTo: env.officeEmail,
    subject: "We received your inquiry",
    html: layout(
      "Thanks for reaching out!",
      `<p>Hi ${escapeHtml(quote.name || "there")},</p>
       <p>We received your inquiry${links.length ? ` along with ${links.length} attached file(s)` : ""}. We'll review it and get back to you soon.</p>
       <p>If you have house plans or material preferences you haven't sent yet, just reply to this email.</p>
       <p>— First Choice Homes</p>`,
    ),
  }).catch((err) => console.error("Confirmation email failed", err));

  return json({ ok: true });
});

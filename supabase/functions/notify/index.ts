// Sends selection-related emails. Called by the portal right after an action succeeds.
// The selection is read *as the caller* (RLS applies) and the email type must match the
// selection's current status, so this can't be used to send arbitrary email.
import { adminClient, callerClient, callerIs, env, escapeHtml, HttpError, json, serve } from "../_shared/util.ts";
import { layout, sendMail } from "../_shared/mail.ts";

type NotifyType = "selection_requested" | "selection_submitted" | "selection_decided";

const expectedStatus: Record<NotifyType, string[]> = {
  selection_requested: ["requested"],
  selection_submitted: ["submitted"],
  selection_decided: ["approved", "revision_requested"],
};

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const { client } = await callerClient(req);
  const { type, selectionId } = (await req.json().catch(() => ({}))) as { type: NotifyType; selectionId: string };
  if (!(type in expectedStatus) || typeof selectionId !== "string") throw new HttpError(400, "Invalid request");

  const { data: sel } = await client
    .from("selections")
    .select("id, title, instructions, due_date, status, client_note, staff_note, project_id, projects(name), selection_options!selections_chosen_option_fk(label)")
    .eq("id", selectionId)
    .maybeSingle();
  if (!sel) throw new HttpError(404, "Selection not found");
  if (!expectedStatus[type].includes(sel.status)) throw new HttpError(409, "Selection status doesn't match");

  const isStaff = await callerIs(client, "is_staff");
  if (type !== "selection_submitted" && !isStaff) throw new HttpError(403, "Staff only");

  const db = adminClient();
  // deno-lint-ignore no-explicit-any
  const projectName = (sel as any).projects?.name ?? "your project";
  // deno-lint-ignore no-explicit-any
  const chosen = (sel as any).selection_options?.label as string | undefined;
  const link = `${env.siteUrl}/app/#/selections/${sel.id}`;

  if (type === "selection_submitted") {
    const { data: owners } = await db.from("profiles").select("email").eq("role", "owner");
    const to = [...new Set([env.officeEmail, ...(owners ?? []).map((o) => o.email)])];
    await sendMail({
      to,
      subject: `${projectName}: selection submitted — ${sel.title}`,
      html: layout(
        `Selection submitted: ${sel.title}`,
        `<p><strong>${escapeHtml(projectName)}</strong></p>
         ${chosen ? `<p>Chosen option: <strong>${escapeHtml(chosen)}</strong></p>` : ""}
         ${sel.client_note ? `<p style="white-space:pre-wrap;background:#f7f7f7;padding:12px">${escapeHtml(sel.client_note)}</p>` : ""}
         <p>Open it in the portal to see any uploaded files and approve or request changes.</p>`,
        { label: "Review selection", url: `${env.siteUrl}/app/#/admin/projects/${sel.project_id}` },
      ),
    });
    return json({ ok: true });
  }

  const { data: members } = await db
    .from("project_members")
    .select("profiles(email, role)")
    .eq("project_id", sel.project_id);
  const clientEmails = (members ?? [])
    // deno-lint-ignore no-explicit-any
    .map((m: any) => m.profiles)
    .filter((p) => p?.role === "client")
    .map((p) => p.email);

  if (type === "selection_requested") {
    await sendMail({
      to: clientEmails,
      replyTo: env.officeEmail,
      subject: `Action needed: ${sel.title}`,
      html: layout(
        `We need your choice: ${sel.title}`,
        `${sel.instructions ? `<p style="white-space:pre-wrap">${escapeHtml(sel.instructions)}</p>` : ""}
         ${sel.due_date ? `<p>Please respond by <strong>${escapeHtml(sel.due_date)}</strong>.</p>` : ""}`,
        { label: "Make your selection", url: link },
      ),
    });
  } else {
    const approved = sel.status === "approved";
    await sendMail({
      to: clientEmails,
      replyTo: env.officeEmail,
      subject: approved ? `Approved: ${sel.title}` : `Changes requested: ${sel.title}`,
      html: layout(
        approved ? `Your selection is approved: ${sel.title}` : `We need a little more on: ${sel.title}`,
        sel.staff_note ? `<p style="white-space:pre-wrap;background:#f7f7f7;padding:12px">${escapeHtml(sel.staff_note)}</p>` : "",
        { label: "View selection", url: link },
      ),
    });
  }
  return json({ ok: true });
});

// Owner-only: invite a client (optionally to a project) or a staff member.
// If the person already has an account, they're just added to the project; if they've never
// signed in, their invitation is sent again.
import { sendSignInEmail } from "../_shared/signin.ts";
import { adminClient, callerClient, callerIs, HttpError, isEmail, json, serve } from "../_shared/util.ts";

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const { client } = await callerClient(req);
  if (!(await callerIs(client, "is_owner"))) throw new HttpError(403, "Only the owner can invite people");

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 200) : "";
  const newRole = body.role === "staff" ? "staff" : "client";
  const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : null;

  if (!isEmail(email)) throw new HttpError(400, "Enter a valid email");

  const db = adminClient();
  if (projectId) {
    const { data: project } = await db.from("projects").select("id").eq("id", projectId).maybeSingle();
    if (!project) throw new HttpError(400, "Project not found");
  }

  let { data: profile } = await db.from("profiles").select("id, role, full_name").eq("email", email).maybeSingle();
  let invited = false;

  if (!profile) {
    // Created already confirmed: Supabase's own invite left people unconfirmed, and with sign-ups
    // turned off it then refused to send them sign-in emails. The invitation is our own email.
    const { data, error } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw new HttpError(400, error.message);
    invited = true;
    profile = { id: data.user.id, role: "client", full_name: fullName };
  } else {
    const { data } = await db.auth.admin.getUserById(profile.id);
    invited = !data.user?.last_sign_in_at;
  }

  const updates: Record<string, string> = {};
  if (fullName) updates.full_name = fullName;
  // Never downgrade an existing owner/staff account through an invite.
  if (newRole === "staff" && profile.role === "client") updates.role = "staff";
  if (Object.keys(updates).length) {
    const { error } = await db.from("profiles").update(updates).eq("id", profile.id);
    if (error) throw error;
  }

  if (projectId) {
    const { error } = await db
      .from("project_members")
      .upsert({ project_id: projectId, user_id: profile.id }, { ignoreDuplicates: true });
    if (error) throw error;
  }

  if (invited) await sendSignInEmail(db, email, { name: fullName || profile.full_name || "" });

  return json({ userId: profile.id, invited });
});

// Owner-only: invite a client (optionally to a project) or a staff member.
// If the person already has an account, they're just added to the project.
import { adminClient, callerClient, callerIs, env, HttpError, isEmail, json, serve } from "../_shared/util.ts";

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

  let { data: profile } = await db.from("profiles").select("id, role").eq("email", email).maybeSingle();
  let invited = false;

  if (!profile) {
    const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${env.siteUrl}/app/`,
    });
    if (error) throw new HttpError(400, error.message);
    invited = true;
    profile = { id: data.user.id, role: "client" };
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

  return json({ userId: profile.id, invited });
});

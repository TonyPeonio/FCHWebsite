// Owner-only: permanently delete a client or staff account.
// The database then removes their profile and project access; files they uploaded and
// selections they answered stay with the project, no longer credited to anyone.
import { adminClient, callerClient, callerIs, HttpError, json, serve } from "../_shared/util.ts";

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const { client, user } = await callerClient(req);
  if (!(await callerIs(client, "is_owner"))) throw new HttpError(403, "Only the owner can delete people");

  const { userId } = await req.json().catch(() => ({}));
  if (typeof userId !== "string") throw new HttpError(400, "Invalid request");
  if (userId === user.id) throw new HttpError(400, "You can't delete your own account");

  const db = adminClient();
  const { data: profile } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!profile) throw new HttpError(404, "That person wasn't found");
  // Owners can't be deleted here: change them to staff or client first.
  if (profile.role === "owner") throw new HttpError(400, "Owners can't be deleted. Change their role first.");

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw new HttpError(400, error.message);
  return json({ deleted: true });
});

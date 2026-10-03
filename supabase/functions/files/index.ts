// Signed-in users' gateway to stored files in R2. Permission rules live in the database
// (readable_files, uploadable_files, deletable_files), asked as the caller.
//   { action: "sign", area, paths }      -> { urls: { path: download link } } for the ones allowed
//   { action: "upload", paths }          -> { urls: { path: upload link } } (project-files; all or nothing)
//   { action: "delete", paths }          -> {} deletes the ones allowed
//   { action: "move", from, to }         -> {} owner only (photo dump -> project)
//   { action: "deleteFolder", projectId } -> {} owner only, after the project row is gone
//   { action: "usage" }                  -> { areas: [{ area, files, bytes }] } owner only
import { adminClient, callerClient, callerIs, HttpError, json, serve } from "../_shared/util.ts";
import { type Area, isSafePath, list, move, presign, remove } from "../_shared/r2.ts";

const DOWNLOAD_TTL = 60 * 60; // the portal refreshes links before they run out
const UPLOAD_TTL = 15 * 60;
const MAX_PATHS = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pathsFrom(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_PATHS || !value.every(isSafePath)) throw new HttpError(400, "Invalid file paths");
  return [...new Set(value as string[])];
}

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") throw new HttpError(400, "Invalid request");
  const { client } = await callerClient(req);

  // Asks one of the database's permission functions which paths are allowed.
  const allowed = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(fn, args);
    if (error) throw error;
    return new Set(data as string[]);
  };
  const requireOwner = async () => {
    if (!(await callerIs(client, "is_owner"))) throw new HttpError(403, "Only the owner can do that");
  };

  switch (body.action) {
    case "sign": {
      const area: Area = body.area === "quote-uploads" ? "quote-uploads" : "project-files";
      const paths = pathsFrom(body.paths);
      const ok = paths.length ? await allowed("readable_files", { area, paths }) : new Set<string>();
      const urls: Record<string, string> = {};
      for (const p of paths) if (ok.has(p)) urls[p] = await presign(area, p, "GET", DOWNLOAD_TTL);
      return json({ urls });
    }

    case "upload": {
      const paths = pathsFrom(body.paths);
      const ok = await allowed("uploadable_files", { paths });
      if (paths.some((p) => !ok.has(p))) throw new HttpError(403, "You can't upload there");
      const urls: Record<string, string> = {};
      for (const p of paths) urls[p] = await presign("project-files", p, "PUT", UPLOAD_TTL);
      return json({ urls });
    }

    case "delete": {
      const paths = pathsFrom(body.paths);
      const ok = paths.length ? await allowed("deletable_files", { paths }) : new Set<string>();
      await remove("project-files", paths.filter((p) => ok.has(p)));
      return json({});
    }

    case "move": {
      await requireOwner();
      if (!isSafePath(body.from) || !isSafePath(body.to)) throw new HttpError(400, "Invalid file paths");
      await move("project-files", body.from, body.to);
      return json({});
    }

    case "deleteFolder": {
      await requireOwner();
      if (typeof body.projectId !== "string" || !UUID.test(body.projectId)) throw new HttpError(400, "Invalid project");
      // Only once the project itself is deleted, so a slip can't empty a live project's files.
      const { data } = await adminClient().from("projects").select("id").eq("id", body.projectId).maybeSingle();
      if (data) throw new HttpError(409, "Delete the project first");
      await remove("project-files", (await list("project-files", `${body.projectId}/`)).map((o) => o.path));
      return json({});
    }

    case "usage": {
      await requireOwner();
      const areas = [];
      for (const area of ["project-files", "quote-uploads"] as const) {
        const objects = await list(area);
        areas.push({ area, files: objects.length, bytes: objects.reduce((sum, o) => sum + o.size, 0) });
      }
      return json({ areas });
    }

    default:
      throw new HttpError(400, "Unknown action");
  }
});

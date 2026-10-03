// One-time move of stored files from Supabase Storage to R2, run on the server so the R2 keys
// never leave Supabase. Locked unless the COPY_TOKEN secret is set; call with that token, then
// unset it:
//   npx supabase secrets set COPY_TOKEN=<random>
//   curl -X POST <SUPABASE_URL>/functions/v1/copy-files-to-r2 -H "x-copy-token: <random>"   (repeat until remaining is 0)
//   npx supabase secrets unset COPY_TOKEN
// Copies up to BATCH files per call, skipping ones already in R2 at the same size. Deletes nothing.
import { adminClient, HttpError, json, serve } from "../_shared/util.ts";
import { type Area, put, sizeOf } from "../_shared/r2.ts";

const BATCH = 25;

serve(async (req) => {
  const token = Deno.env.get("COPY_TOKEN");
  if (!token || req.headers.get("x-copy-token") !== token) throw new HttpError(403, "Locked");
  const db = adminClient();

  // Every file in a Supabase bucket, subfolders included.
  const listAll = async (bucket: Area, prefix = ""): Promise<{ path: string; size: number | null; type: string }[]> => {
    const out = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
      if (error) throw error;
      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) out.push(...(await listAll(bucket, path)));
        else out.push({ path, size: item.metadata?.size ?? null, type: item.metadata?.mimetype ?? "" });
      }
      if (data.length < 1000) return out;
    }
  };

  let copied = 0, skipped = 0, remaining = 0;
  const failed: string[] = [];
  for (const area of ["project-files", "quote-uploads"] as const) {
    for (const item of await listAll(area)) {
      if (item.size !== null && (await sizeOf(area, item.path)) === item.size) {
        skipped++;
        continue;
      }
      if (copied + failed.length >= BATCH) {
        remaining++;
        continue;
      }
      try {
        const { data, error } = await db.storage.from(area).download(item.path);
        if (error) throw error;
        await put(area, item.path, new Uint8Array(await data.arrayBuffer()), item.type || data.type || "application/octet-stream");
        copied++;
      } catch (err) {
        failed.push(`${area}/${item.path}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  return json({ copied, skipped, remaining, failed });
});

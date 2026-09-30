// Public: the website's "Our Work" gallery. Only completed projects with a build type and city,
// and only photos the owner marked "Show on website". Project names are never sent: they're
// often the client's surname.
//   GET                  -> build types, each with its projects ({ id, label, cover })
//   GET ?project=<uuid>  -> that project's website photos ({ thumb, full, caption })
import { adminClient, corsHeaders, HttpError, publicUrl, serve } from "../_shared/util.ts";

const CATEGORY_LABEL: Record<string, string> = {
  new_construction: "New construction homes",
  shop: "Shops",
  remodel: "Remodels",
  adu: "ADUs",
  multi_family: "Multi-family",
  commercial: "Commercial",
};
const URL_TTL_SECONDS = 60 * 60 * 24;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ProjectRow {
  id: string;
  city: string;
  category: string;
  completed_on: string | null;
}
interface PhotoRow {
  project_id: string;
  storage_path: string;
  thumb_path: string | null;
  caption: string | null;
}

function cached(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
  });
}

serve(async (req) => {
  if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
  const db = adminClient();
  const projectParam = new URL(req.url).searchParams.get("project");
  if (projectParam !== null && !UUID.test(projectParam)) throw new HttpError(400, "Invalid project");

  let projectQuery = db
    .from("projects")
    .select("id, city, category, completed_on")
    .eq("status", "complete")
    .not("category", "is", null)
    .not("city", "is", null)
    .neq("city", "")
    .order("completed_on", { ascending: false, nullsFirst: false });
  if (projectParam) projectQuery = projectQuery.eq("id", projectParam);
  const { data: projects, error } = await projectQuery;
  if (error) throw error;

  const ids = (projects as ProjectRow[]).map((p) => p.id);
  const { data: photoData, error: photoError } = ids.length
    ? await db
        .from("documents")
        .select("project_id, storage_path, thumb_path, caption")
        .eq("show_on_website", true)
        .like("mime_type", "image/%")
        .in("project_id", ids)
        .order("created_at")
    : { data: [], error: null };
  if (photoError) throw photoError;
  const photos = photoData as PhotoRow[];

  const sign = async (paths: string[]) => {
    const unique = [...new Set(paths)];
    if (!unique.length) return {} as Record<string, string>;
    const { data, error } = await db.storage.from("project-files").createSignedUrls(unique, URL_TTL_SECONDS);
    if (error) throw error;
    return Object.fromEntries(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path!, publicUrl(d.signedUrl)]));
  };

  if (projectParam) {
    const mine = photos.filter((p) => p.project_id === projectParam);
    if (!projects?.length || !mine.length) throw new HttpError(404, "Project not found");
    const urls = await sign(mine.flatMap((p) => [p.storage_path, p.thumb_path ?? p.storage_path]));
    return cached({
      photos: mine.map((p) => ({
        full: urls[p.storage_path],
        thumb: urls[p.thumb_path ?? p.storage_path],
        caption: p.caption ?? "",
      })),
    });
  }

  // Cover = first website photo of each project; projects without one are left out.
  const covers = new Map<string, string>();
  for (const p of photos) if (!covers.has(p.project_id)) covers.set(p.project_id, p.thumb_path ?? p.storage_path);
  const urls = await sign([...covers.values()]);

  const categories = Object.entries(CATEGORY_LABEL)
    .map(([key, label]) => ({
      key,
      label,
      projects: (projects as ProjectRow[])
        .filter((p) => p.category === key && covers.has(p.id))
        .map((p) => ({
          id: p.id,
          label: p.completed_on ? `${p.city.trim()}-${p.completed_on}` : p.city.trim(),
          cover: urls[covers.get(p.id)!],
        })),
    }))
    .filter((c) => c.projects.length > 0);

  return cached({ categories });
});

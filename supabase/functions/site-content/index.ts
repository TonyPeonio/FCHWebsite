// Public: the home-page content the owner edits in the portal (hours, contact details, section
// text), plus links for any section photos they replaced. Photos live in the private R2 bucket
// under site/, so they're sent as signed links that last a day.
//   GET -> { content, photoUrls: { hero?, legacy?, welcome? } }
import { adminClient, corsHeaders, HttpError, serve } from "../_shared/util.ts";
import { isSafePath, presign } from "../_shared/r2.ts";

const URL_TTL_SECONDS = 60 * 60 * 24;
const PHOTO_KEYS = ["hero", "legacy", "welcome"];

serve(async (req) => {
  if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
  const { data, error } = await adminClient().from("site_content").select("content").eq("id", 1).maybeSingle();
  if (error) throw error;
  const content = (data?.content ?? {}) as Record<string, unknown>;

  const photos = (content.photos ?? {}) as Record<string, unknown>;
  const photoUrls: Record<string, string> = {};
  for (const key of PHOTO_KEYS) {
    const path = photos[key];
    // Only files the portal put under site/ are ever signed here.
    if (isSafePath(path) && path.startsWith("site/")) photoUrls[key] = await presign("project-files", path, "GET", URL_TTL_SECONDS);
  }

  return new Response(JSON.stringify({ content, photoUrls }), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
  });
});

// Files (photos, plans, inquiry uploads) live in one private Cloudflare R2 bucket. Keys are
// "<area>/<path>", where the area is "project-files" or "quote-uploads" and the path is what the
// database stores (e.g. documents.storage_path). Browsers never get the keys: they get short-lived
// signed links from the `files` function (or the gallery/inquiry functions) after a permission check.
import { AwsClient } from "npm:aws4fetch@1.0.20";

export type Area = "project-files" | "quote-uploads";

const need = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

let client: AwsClient | null = null;
const r2 = () =>
  (client ??= new AwsClient({
    accessKeyId: need("R2_ACCESS_KEY_ID"),
    secretAccessKey: need("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  }));

// R2_ENDPOINT overrides the Cloudflare address, e.g. a local S3-compatible server for development.
// R2_PUBLIC_ENDPOINT is the address browsers use for signed links, if different (local only).
const endpoint = () => (Deno.env.get("R2_ENDPOINT") ?? `https://${need("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`).replace(/\/$/, "");
const publicEndpoint = () => (Deno.env.get("R2_PUBLIC_ENDPOINT") ?? endpoint()).replace(/\/$/, "");
const bucket = () => need("R2_BUCKET");

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");
const objectUrl = (key: string, base = endpoint()) => `${base}/${bucket()}/${encodeKey(key)}`;
export const keyOf = (area: Area, path: string) => `${area}/${path}`;

/** A path the database could hold: no empty, "." or ".." segments, nothing odd. */
export const isSafePath = (path: unknown): path is string =>
  typeof path === "string" &&
  path.length > 0 &&
  path.length <= 500 &&
  !/[\\\x00-\x1f]/.test(path) &&
  path.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..");

/** A link that lets whoever holds it download (GET) or upload (PUT) one file until it expires. */
export async function presign(area: Area, path: string, method: "GET" | "PUT", expiresIn: number): Promise<string> {
  const url = new URL(objectUrl(keyOf(area, path), publicEndpoint()));
  url.searchParams.set("X-Amz-Expires", String(Math.min(expiresIn, 7 * 24 * 3600))); // S3's 7-day maximum
  const signed = await r2().sign(url, { method, aws: { signQuery: true } });
  return signed.url;
}

async function call(url: string, init: RequestInit = {}) {
  const res = await r2().fetch(url, init);
  if (!res.ok && res.status !== 404) throw new Error(`R2 ${init.method ?? "GET"} failed: ${res.status} ${await res.text()}`);
  return res;
}

export interface StoredObject {
  path: string; // without the area prefix
  size: number;
}

const unescapeXml = (s: string) =>
  s.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&");

/** Every file whose path starts with `prefix` (all of the area when empty). */
export async function list(area: Area, prefix = ""): Promise<StoredObject[]> {
  const out: StoredObject[] = [];
  let token: string | null = null;
  do {
    const url = new URL(`${endpoint()}/${bucket()}`);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", keyOf(area, prefix));
    if (token) url.searchParams.set("continuation-token", token);
    const xml = await (await call(url.toString())).text();
    for (const [, body] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = unescapeXml(/<Key>([\s\S]*?)<\/Key>/.exec(body)?.[1] ?? "");
      const size = Number(/<Size>(\d+)<\/Size>/.exec(body)?.[1] ?? 0);
      out.push({ path: key.slice(area.length + 1), size });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? unescapeXml(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "") || null
      : null;
  } while (token);
  return out;
}

/** Deletes files; ones already gone are fine. */
export async function remove(area: Area, paths: string[]) {
  for (let i = 0; i < paths.length; i += 10) {
    await Promise.all(paths.slice(i, i + 10).map((p) => call(objectUrl(keyOf(area, p)), { method: "DELETE" })));
  }
}

/** A file's size, or null if it isn't there. */
export async function sizeOf(area: Area, path: string): Promise<number | null> {
  const res = await call(objectUrl(keyOf(area, path)), { method: "HEAD" });
  return res.ok ? Number(res.headers.get("content-length")) : null;
}

export async function put(area: Area, path: string, body: Uint8Array, contentType: string) {
  await call(objectUrl(keyOf(area, path)), { method: "PUT", body, headers: { "Content-Type": contentType } });
}

/** Moves a file within an area (R2 has no rename: copy, then delete the original). */
export async function move(area: Area, from: string, to: string) {
  const res = await r2().fetch(objectUrl(keyOf(area, to)), {
    method: "PUT",
    headers: { "x-amz-copy-source": `/${bucket()}/${encodeKey(keyOf(area, from))}` },
  });
  if (!res.ok) throw new Error(`R2 copy failed: ${res.status} ${await res.text()}`);
  await remove(area, [from]);
}

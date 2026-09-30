// Step 1 of a quote request from the public website.
// Checks the Turnstile anti-spam token, saves a draft quote, and returns signed upload
// URLs so the browser can upload house plans straight to private storage.
import { adminClient, HttpError, isEmail, json, serve } from "../_shared/util.ts";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

interface FileMeta {
  name: string;
  size: number;
}

async function verifyTurnstile(token: unknown, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) throw new Error("TURNSTILE_SECRET is not set");
  if (typeof token !== "string" || !token) return false;

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const data = await res.json();
  return data.success === true;
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : null) || null;

const safeName = (name: string) =>
  name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-100) || "file";

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const body = await req.json().catch(() => null);
  if (!body) throw new HttpError(400, "Invalid request");

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    throw new HttpError(400, "Spam check failed. Please refresh the page and try again.");
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!isEmail(email)) throw new HttpError(400, "Please enter a valid email address.");

  const files: FileMeta[] = Array.isArray(body.files) ? body.files : [];
  if (files.length > MAX_FILES) throw new HttpError(400, `Please attach at most ${MAX_FILES} files.`);
  for (const f of files) {
    if (typeof f?.name !== "string" || typeof f?.size !== "number") throw new HttpError(400, "Invalid file");
    if (f.size > MAX_FILE_BYTES) throw new HttpError(400, `"${f.name}" is larger than 50 MB.`);
  }

  const db = adminClient();
  const quoteId = crypto.randomUUID();
  const paths = files.map((f, i) => `${quoteId}/${i + 1}-${safeName(f.name)}`);

  const { error } = await db.from("quote_requests").insert({
    id: quoteId,
    name: clip(body.name, 200),
    email,
    phone: clip(body.phone, 50),
    address: clip(body.address, 300),
    message: clip(body.message, 5000),
    file_paths: paths,
    status: "draft",
  });
  if (error) throw error;

  const uploads = [];
  for (const path of paths) {
    const { data, error: urlError } = await db.storage.from("quote-uploads").createSignedUploadUrl(path);
    if (urlError) throw urlError;
    uploads.push({ path, token: data.token });
  }

  return json({ quoteId, uploads });
});

// The website's link to Supabase. The demo build swaps this file for src/demo/site-backend.js.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** False when the build is missing its Supabase settings; the gallery stays hidden then. */
export const configured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Cloudflare Turnstile site key for the inquiry form's spam check (null = no check). */
export const spamCheckKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || null;

/** Whether the inquiry form can send; otherwise it points people to email/phone. */
export const formReady = configured && Boolean(spamCheckKey);

/** Calls an edge function; GET when there's no body. */
export async function call(name, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/**
 * Uploads an inquiry attachment to the signed link quote-start handed out; resolves to whether it
 * arrived. `onProgress` hears how much has been sent, from 0 to 1.
 */
export function uploadFile(url, file, onProgress) {
  return new Promise((resolve) => {
    // XMLHttpRequest rather than fetch: it's the only way to see upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = xhr.ontimeout = xhr.onabort = () => resolve(false);
    xhr.send(file);
  });
}

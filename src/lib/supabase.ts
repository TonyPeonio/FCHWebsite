import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** False when the build is missing its Supabase settings (e.g. GitHub variables not added yet). */
export const isConfigured = Boolean(url && anonKey);
if (!isConfigured) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local.");
}

// createClient throws without a URL, which would blank the whole page; the portal shows a
// "not set up yet" notice instead (see main.tsx), so a placeholder is never actually called.
// Implicit flow: sign-in links carry the session in the URL hash (#access_token=…), so they work
// in any browser. PKCE only works in the browser that requested the link, which silently failed
// for anyone opening the email on their phone or in their mail app's built-in browser.
export const supabase = createClient(url || "https://not-configured.invalid", anonKey || "not-configured", {
  auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true },
});

/** Where magic-link and invite emails send people back to. */
export const portalUrl = `${window.location.origin}/app/`;

const authParams = new URLSearchParams(window.location.hash.slice(1));

/** Why the sign-in link that opened this page didn't work (expired, already used…), if it didn't. */
export const linkError: string | null =
  authParams.get("error_code") === "otp_expired"
    ? "That sign-in link has expired or was already used. Enter your email below for a new one."
    : authParams.get("error_description")?.replace(/\+/g, " ") ?? null;

/** Strip auth callback leftovers (#access_token=…, #error=…) so the router starts at the home page. */
export function clearAuthHash(): void {
  if (authParams.has("access_token") || authParams.has("error") || authParams.has("error_code")) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local.");
}

export const supabase = createClient(url, anonKey, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
});

/** Where magic-link and invite emails send people back to. */
export const portalUrl = `${window.location.origin}/app/`;

/**
 * Invite emails are generated server-side, so they return with tokens in the URL hash
 * (#access_token=…) instead of a PKCE ?code=. Pick those up, then clear the hash so the
 * router starts at the home page.
 */
export async function consumeHashTokens(): Promise<void> {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return;
  history.replaceState(null, "", window.location.pathname + window.location.search);
  await supabase.auth.setSession({ access_token, refresh_token });
}

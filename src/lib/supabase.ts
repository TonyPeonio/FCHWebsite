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

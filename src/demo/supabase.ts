// Demo stand-in for src/lib/supabase.ts (swapped in by vite.demo.config.ts). The demo never talks to
// Supabase; this only satisfies the few screens that import it directly.
export const isConfigured = true;
export const linkError: string | null = null;
export const pendingLink = null as { token_hash: string; type: "email" } | null;
export const clearPendingLink = () => {};
export const clearAuthHash = () => {};

const ok = async () => ({ data: null, error: null });
export const supabase = {
  auth: { updateUser: ok, verifyOtp: ok, signInWithPassword: ok, signOut: ok },
};

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { clearAuthHash, clearPendingLink, supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  isStaff: boolean;
  isOwner: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", s.user.id).single();
    setProfile(prof as Profile | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // getSession waits for supabase-js to pick up any session from a sign-in link first.
    supabase.auth.getSession().then(({ data }) => {
      clearAuthHash();
      // Already signed in, so an emailed sign-in link has nothing left to do.
      if (data.session) clearPendingLink();
      load(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Defer so we don't call Supabase inside its own auth callback.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setTimeout(() => {
          queryClient.clear();
          load(s);
        }, 0);
      } else {
        setSession(s);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load, queryClient]);

  const value: AuthState = {
    loading,
    session,
    profile,
    isStaff: profile?.role === "owner" || profile?.role === "staff",
    isOwner: profile?.role === "owner",
    refresh: async () => load((await supabase.auth.getSession()).data.session),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

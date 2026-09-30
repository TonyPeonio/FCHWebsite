import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** Staff accounts must pass 2FA before they get staff access. */
  needsMfa: boolean;
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
  const [aal, setAal] = useState<string | null>(null);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setProfile(null);
      setAal(null);
      setLoading(false);
      return;
    }
    const [{ data: prof }, { data: level }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", s.user.id).single(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setProfile(prof as Profile | null);
    setAal(level?.currentLevel ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Defer so we don't call Supabase inside its own auth callback.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "MFA_CHALLENGE_VERIFIED" || event === "USER_UPDATED") {
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

  const staffRole = profile?.role === "owner" || profile?.role === "staff";
  const value: AuthState = {
    loading,
    session,
    profile,
    needsMfa: staffRole && aal !== "aal2",
    isStaff: staffRole && aal === "aal2",
    isOwner: profile?.role === "owner" && aal === "aal2",
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

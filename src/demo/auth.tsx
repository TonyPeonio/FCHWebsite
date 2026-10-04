// Demo stand-in for src/app/auth.tsx (swapped in by vite.demo.config.ts): the "signed-in" user is
// whichever made-up account the visitor picked.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "../lib/types";
import { db } from "./store";
import { currentUserId, onRoleChange, setRole } from "./session";

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
  const [, rerender] = useState(0);
  useEffect(() => onRoleChange(() => rerender((n) => n + 1)), []);

  const id = currentUserId();
  const profile = (id && db.profiles.find((p) => p.id === id)) || null;
  const value: AuthState = {
    loading: false,
    session: profile ? ({ user: { id: profile.id, email: profile.email } } as unknown as Session) : null,
    profile,
    isStaff: profile?.role === "owner" || profile?.role === "staff",
    isOwner: profile?.role === "owner",
    refresh: async () => rerender((n) => n + 1),
    signOut: async () => setRole(null),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}


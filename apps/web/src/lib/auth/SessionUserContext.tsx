"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthRole, AuthUser } from "@glantri/auth";
import { canAccessAdmin, hasAnyRole } from "@glantri/auth";

import { getCurrentSessionUser, logoutLocalUser } from "../api/localServiceClient";

interface SessionUserContextValue {
  currentUser: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setCurrentUser: (user: AuthUser | null) => void;
  signOut: () => Promise<void>;
}

const SessionUserContext = createContext<SessionUserContextValue | null>(null);

export function SessionUserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);

    try {
      const user = await getCurrentSessionUser();
      setCurrentUser(user);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await logoutLocalUser();
    setCurrentUser(null);
  }

  useEffect(() => {
    refresh().catch(() => {
      setCurrentUser(null);
      setLoading(false);
    });
  }, []);

  const value = useMemo<SessionUserContextValue>(
    () => ({
      currentUser,
      loading,
      refresh,
      setCurrentUser,
      signOut,
    }),
    [currentUser, loading],
  );

  return <SessionUserContext.Provider value={value}>{children}</SessionUserContext.Provider>;
}

export function useSessionUser() {
  const value = useContext(SessionUserContext);

  if (!value) {
    throw new Error("useSessionUser must be used within SessionUserProvider.");
  }

  return value;
}

export function useHasAnyRole(requiredRoles: AuthRole[]): boolean {
  const { currentUser } = useSessionUser();
  return currentUser ? hasAnyRole(currentUser.roles, requiredRoles) : false;
}

export function useCanAccessAdmin(): boolean {
  const { currentUser } = useSessionUser();
  return currentUser ? canAccessAdmin(currentUser.roles) : false;
}

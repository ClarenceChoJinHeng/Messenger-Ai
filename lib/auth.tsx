"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, getToken, setToken, type User } from "./api";

interface AuthState {
  user: User | null; // null = logged out
  ready: boolean; // false until we've checked the saved token
  login: (token: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

// Wraps the app so every page can ask "who is logged in?" with useAuth()
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  // On first load: if a token was saved, check it's still valid by asking who it belongs to
  useEffect(() => {
    let cancelled = false; // if the component goes away mid-check, don't touch its state
    async function checkSavedToken() {
      const me = getToken() ? await api<User>("/users/me").catch(() => null) : null;
      if (cancelled) return;
      if (me) setUser(me);
      else setToken(null); // missing, expired or invalid: forget it
      setReady(true);
    }
    checkSavedToken();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (token: string) => {
    setToken(token);
    setUser(await api<User>("/users/me"));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    queryClient.clear(); // drop the previous user's cached chats
  }, [queryClient]);

  return <AuthContext.Provider value={{ user, ready, login, logout, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

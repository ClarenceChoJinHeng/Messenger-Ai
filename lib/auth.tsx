"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { api, getToken, SESSION_EXPIRED_EVENT, setToken, type User } from "./api";

interface AuthState {
  user: User | null; // null = logged out
  ready: boolean; // false until we've checked the saved token
  login: (token: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);
const THEME_KEY = "messenger-ai-theme";

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

  // The backend rejected our token (expired, or the password was changed elsewhere)
  useEffect(() => {
    function onExpired() {
      setUser(null);
      queryClient.clear();
      toast.info("Your session expired. Please log in again.", { toastId: "session-expired" });
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [queryClient]);

  // Apply the user's theme to the whole page, and remember it on this device for the next visit
  const theme = user?.theme;
  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // not saved on this device: the page still uses the theme now
    }
  }, [theme]);

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

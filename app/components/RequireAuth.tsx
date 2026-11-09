"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/api";

// Wrap a page in this to make it "logged-in users only".
// children is a function, so the page gets the user without null checks: {(user) => <Page user={user} />}
export default function RequireAuth({ children }: { children: (user: User) => React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return <p className="flex flex-1 items-center justify-center text-zinc-500">Loading…</p>;
  }
  return <>{children(user)}</>;
}

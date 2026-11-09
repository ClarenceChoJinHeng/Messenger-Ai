"use client";
import { Suspense, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// The link in the confirmation email opens this page: /confirm-change?token=...
export default function ConfirmChangePage() {
  return (
    <Suspense fallback={<p className="flex flex-1 items-center justify-center text-muted">Loading…</p>}>
      <ConfirmChange />
    </Suspense>
  );
}

function ConfirmChange() {
  const token = useSearchParams().get("token");
  const { user, logout, setUser } = useAuth();
  const started = useRef(false); // React may run effects twice in development: only confirm once

  const confirm = useMutation({
    mutationFn: (t: string) => api<{ type: "email" | "password" }>("/account/confirm", { method: "POST", body: { token: t } }),
    onSuccess: async ({ type }) => {
      if (type === "password") logout(); // every login was cancelled, this one too
      else if (user) setUser(await api<User>("/users/me")); // show the new email right away
    },
  });

  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      confirm.mutate(token);
    }
  }, [token, confirm]);

  let title = "Confirming…";
  let text = "One moment.";
  if (!token || confirm.isError) {
    title = "This link doesn't work";
    text = confirm.error instanceof ApiError ? confirm.error.messages.join(" ") : "The link is missing its code. Open it straight from the email.";
  } else if (confirm.data?.type === "password") {
    title = "Password changed ✅";
    text = "You've been logged out on every device. Log in with your new password.";
  } else if (confirm.data?.type === "email") {
    title = "Email changed ✅";
    text = "Your new email is saved.";
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-page px-3 py-10">
      <div className="w-full max-w-[420px] rounded-[10px] bg-surface p-6 text-center text-ink shadow-[0px_15px_35px_rgba(0,0,0,0.2)]" aria-live="polite">
        <h1 className="mb-2 text-2xl font-semibold">{title}</h1>
        <p className="mb-5 text-muted">{text}</p>
        {!confirm.isPending && (
          <Link
            href={confirm.data?.type === "password" || !user ? "/login" : "/profile"}
            className="inline-block rounded-[8px] bg-accent px-4 py-2 font-semibold text-accent-ink"
          >
            {confirm.data?.type === "password" || !user ? "Go to login" : "Back to profile"}
          </Link>
        )}
      </div>
    </div>
  );
}

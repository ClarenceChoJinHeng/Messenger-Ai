"use client";
import { useEffect, useState, type SubmitEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import PasswordInput from "@/app/components/PasswordInput";

export default function Login() {
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const { user, login } = useAuth();
  const router = useRouter();

  // Already logged in? Go straight to the chats
  useEffect(() => {
    if (user) router.replace("/chat");
  }, [user, router]);

  const loginMutation = useMutation({
    mutationFn: (body: { login: string; password: string }) =>
      api<{ accessToken: string }>("/auth/login", { method: "POST", body }),
    onSuccess: async ({ accessToken }) => {
      await login(accessToken); // save the token and load my profile
      toast.success("Welcome back!");
      router.push("/chat");
    },
    onError: (error) => {
      (error instanceof ApiError ? error.messages : ["Something went wrong."]).forEach((m) => toast.error(m));
    },
  });

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loginName.trim() === "" || password === "") {
      toast.error("Please fill in both fields.");
      return;
    }
    loginMutation.mutate({ login: loginName.trim(), password });
  }

  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <div className="mx-3 w-full max-w-[400px] rounded-[10px] bg-surface p-5 text-ink shadow-[0px_15px_35px_rgba(0,0,0,0.26)]">
        <h1 className="mb-3 text-[30px] font-[600]">Log In</h1>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col">
            <label htmlFor="login">Username or email</label>
            <input
              className="rounded-[5px] border-[1px] border-line bg-field px-2 py-2"
              type="text"
              id="login"
              name="login"
              placeholder="Username or email"
              autoComplete="username"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              name="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="rounded-[8px] bg-accent px-3 py-2 font-[600] text-accent-ink hover:cursor-pointer disabled:opacity-60"
          >
            {loginMutation.isPending ? "Logging in..." : "Log in"}
          </button>
          <p className="text-center text-sm text-muted">
            No account yet?{" "}
            <Link href="/register" className="font-semibold text-blue-500">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

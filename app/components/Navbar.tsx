"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { nameOf } from "@/lib/api";

export default function Navbar() {
  const { user, ready, logout } = useAuth();
  const router = useRouter();

  return (
    <nav className="flex w-full items-center justify-between border-b border-zinc-200 bg-white px-3 py-2">
      <Link href="/" className="flex items-center gap-2 font-semibold text-black">
        <img className="w-auto max-w-[44px]" src="/favicon.png" alt="" />
        <span className="hidden sm:inline">Messenger AI</span>
      </Link>

      {/* Nothing until we know if someone is logged in, so the buttons don't flicker */}
      {ready && (
        <div className="flex items-center gap-2 text-black sm:gap-4">
          {user ? (
            <>
              <Link href="/chat" className="rounded-[10px] px-3 py-2 font-medium hover:bg-zinc-100">
                Chats
              </Link>
              <Link href="/profile" className="rounded-[10px] px-3 py-2 font-medium hover:bg-zinc-100">
                {nameOf(user)}
              </Link>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="rounded-[10px] bg-black px-4 py-2 text-white hover:cursor-pointer"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/register" className="rounded-[10px] bg-black px-5 py-2 text-white">
                Register
              </Link>
              <Link href="/login" className="rounded-[10px] bg-blue-500 px-5 py-2 text-white">
                Login
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

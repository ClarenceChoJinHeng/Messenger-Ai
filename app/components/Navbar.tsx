"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import NotificationBell from "./NotificationBell";
import ProfileMenu from "./ProfileMenu";

export default function Navbar() {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const inChat = pathname.startsWith("/chat"); // inside the chats: no link back to the homepage

  return (
    <nav className="flex h-[60px] w-full shrink-0 items-center justify-between border-b border-line bg-surface px-3">
      {inChat ? (
        <span className="font-semibold text-ink">Chats</span>
      ) : (
        <Link href={user ? "/chat" : "/"} className="flex items-center gap-2 font-semibold text-ink">
          <img className="w-auto max-w-[44px]" src="/favicon.png" alt="" />
          <span className="hidden sm:inline">Messenger AI</span>
        </Link>
      )}

      {/* Nothing until we know if someone is logged in, so the buttons don't flicker */}
      {ready && (
        <div className="flex items-center gap-1 text-ink sm:gap-3">
          {user ? (
            <>
              {!inChat && (
                <Link href="/chat" className="rounded-[10px] px-3 py-2 font-medium hover:bg-surface-2">
                  Chats
                </Link>
              )}
              <NotificationBell />
              <ProfileMenu me={user} />
            </>
          ) : (
            <>
              <Link href="/register" className="rounded-[10px] bg-accent px-5 py-2 text-accent-ink">
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

"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { api, ApiError, nameOf, type Presence, type StatusMode, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import Dropdown from "./Dropdown";
import PresenceDot from "./PresenceDot";
import UserAvatar from "./UserAvatar";

const STATUS_OPTIONS: { value: StatusMode; label: string; hint: string; dot: Presence }[] = [
  { value: "auto", label: "Automatic", hint: "Online while you're active, away after 5 min idle", dot: "online" },
  { value: "online", label: "Online", hint: "Always show as online", dot: "online" },
  { value: "away", label: "Away", hint: "Show as away", dot: "away" },
  { value: "offline", label: "Appear offline", hint: "Nobody sees you online", dot: "offline" },
];

// Your round profile icon in the navbar: status picker, profile link, log out
export default function ProfileMenu({ me }: { me: User }) {
  const { setUser, logout } = useAuth();
  const { presence, connected } = useRealtime();
  const router = useRouter();
  const mode = me.statusMode ?? "auto";

  // What others see: the live value from the server, or a good guess until it arrives
  const shown: Presence = presence[me.id]?.status ?? (!connected || mode === "offline" ? "offline" : mode === "away" ? "away" : "online");

  const setStatus = useMutation({
    mutationFn: (statusMode: StatusMode) => api<User>("/users/me", { method: "PATCH", body: { statusMode } }),
    onSuccess: (updated) => setUser(updated),
    onError: (error) => (error instanceof ApiError ? error.messages : ["Couldn't change your status."]).forEach((m) => toast.error(m)),
  });

  return (
    <Dropdown
      label={`Your account (${nameOf(me)})`}
      button={
        <span className="hover:opacity-80">
          <UserAvatar user={me} textSize="text-lg" status={shown} />
        </span>
      }
    >
      {(close) => (
        <div className="py-2">
          <div className="border-b border-line px-4 pb-3">
            <p className="truncate font-semibold">{nameOf(me)}</p>
            <p className="truncate text-sm text-muted">@{me.username}</p>
          </div>

          <p className="px-4 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">Status</p>
          <div role="radiogroup" aria-label="Status">
            {STATUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={mode === o.value}
                onClick={() => setStatus.mutate(o.value)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:cursor-pointer hover:bg-surface-2"
              >
                <span className="relative h-3 w-3 shrink-0">
                  <PresenceDot status={o.dot} className="border-0" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{o.label}</span>
                  <span className="block text-xs text-muted">{o.hint}</span>
                </span>
                {mode === o.value && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>

          <div className="mt-2 border-t border-line pt-2">
            <Link href="/profile" onClick={close} className="block px-4 py-2 hover:bg-surface-2">
              Profile &amp; settings
            </Link>
            <button
              type="button"
              onClick={() => {
                close();
                logout();
                router.push("/login");
              }}
              className="block w-full px-4 py-2 text-left text-red-500 hover:cursor-pointer hover:bg-surface-2"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </Dropdown>
  );
}

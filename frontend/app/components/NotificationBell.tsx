"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, type AppNotification } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import Dropdown from "./Dropdown";

const ICONS: Record<AppNotification["type"], string> = { message: "💬", contact: "👤", security: "🔒", reaction: "😊" };

// "5 min ago", "2 h ago", "3 d ago"
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

// The 🔔 in the navbar: a tray of new messages, "X added you", and security changes
export default function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { connected } = useRealtime();

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ unread: number; items: AppNotification[] }>("/notifications"),
    refetchInterval: connected ? 120_000 : 15_000, // live updates come through the connection
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const readOne = useMutation({ mutationFn: (id: number) => api(`/notifications/${id}/read`, { method: "POST" }), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => api("/notifications/read-all", { method: "POST" }), onSuccess: refresh });

  const unread = notifications.data?.unread ?? 0;
  const items = notifications.data?.items ?? [];

  return (
    <Dropdown
      label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      button={
        <span className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-surface-2">
          🔔
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-red-500 px-1 text-center text-[11px] leading-5 font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </span>
      }
    >
      {(close) => (
        <>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={() => readAll.mutate()} className="text-sm font-semibold text-blue-500 hover:cursor-pointer">
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">You&apos;re all caught up.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.readAt) readOne.mutate(n.id);
                    if (n.link) router.push(n.link);
                    close();
                  }}
                  className={`flex w-full gap-3 px-4 py-3 text-left hover:cursor-pointer hover:bg-surface-2 ${n.readAt ? "" : "bg-blue-500/10"}`}
                >
                  <span className="text-xl" aria-hidden="true">{ICONS[n.type]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2">
                      <span className={`truncate ${n.readAt ? "" : "font-semibold"}`}>{n.title}</span>
                      <span className="shrink-0 text-xs text-muted">{ago(n.updatedAt)}</span>
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {n.type === "message" && n.count > 1 ? `${n.count} new messages · ${n.body}` : n.body}
                    </span>
                  </span>
                  {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-label="unread" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dropdown>
  );
}

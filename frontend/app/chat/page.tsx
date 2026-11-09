"use client";
import { Suspense, useEffect, useMemo, useState, type SubmitEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import RequireAuth from "@/app/components/RequireAuth";
import UserAvatar from "@/app/components/UserAvatar";
import { api, ApiError, nameOf, previewOf, type Conversation, type User } from "@/lib/api";
import { usePresence, useRealtime } from "@/lib/realtime";
import { activeChat } from "@/lib/active-chat";
import Thread from "./Thread";

const SIDEBAR_KEY = "messenger-ai-sidebar-collapsed";

export default function ChatPage() {
  // useSearchParams (the ?with=5 in the URL) needs a Suspense boundary in this Next.js version
  return (
    <Suspense fallback={<p className="flex flex-1 items-center justify-center text-muted">Loading…</p>}>
      <RequireAuth>{(me) => <Chat me={me} />}</RequireAuth>
    </Suspense>
  );
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// An avatar with that person's live status dot
function ContactAvatar({ user }: { user: User }) {
  const presence = usePresence(user);
  return <UserAvatar user={user} status={presence?.status} />;
}

function Chat({ me }: { me: User }) {
  const router = useRouter();
  const { connected, typing } = useRealtime();
  // The open chat lives in the URL (/chat?with=5), so notifications and the back button can open it
  const selectedId = Number(useSearchParams().get("with")) || null;
  const select = (id: number | null) => router.replace(id ? `/chat?with=${id}` : "/chat", { scroll: false });
  const [tab, setTab] = useState<"chats" | "requests">("chats");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false); // the "New chat" box opened by the floating ➕

  // Collapsed sidebar (desktop): remembered on this device
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const restore = () => {
      try {
        setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
      } catch {
        // storage blocked: start expanded
      }
    };
    restore();
  }, []);
  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1");
      } catch {
        // not remembered, still works now
      }
      return !c;
    });
  }

  // Live updates refresh these instantly; the timers are only a backup if the connection drops
  const users = useQuery({
    queryKey: ["contacts"],
    queryFn: () => api<User[]>("/contacts"),
    refetchInterval: connected ? 60_000 : 10_000,
  });
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<Conversation[]>("/messages/conversations"),
    refetchInterval: connected ? 60_000 : 5_000,
  });

  // Sidebar order (like WhatsApp): newest chat first, then people you haven't messaged yet (Sparky first)
  const everyone = useMemo(() => {
    const byUser = new Map((conversations.data ?? []).map((c) => [c.user.id, c]));
    return [...(users.data ?? [])]
      .map((user) => ({
        user,
        lastMessage: byUser.get(user.id)?.lastMessage ?? null,
        unread: user.id === selectedId ? 0 : (byUser.get(user.id)?.unreadCount ?? 0),
      }))
      .sort((a, b) => {
        if (a.lastMessage && b.lastMessage) return b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt);
        if (a.lastMessage || b.lastMessage) return a.lastMessage ? -1 : 1;
        if (a.user.isBot !== b.user.isBot) return a.user.isBot ? -1 : 1;
        return a.user.username.localeCompare(b.user.username);
      });
  }, [users.data, conversations.data, selectedId]);

  const chats = everyone.filter((c) => !c.user.isRequest);
  const requests = everyone.filter((c) => c.user.isRequest);
  // Search: keep people whose name, @username or last message contains what you typed
  const query = search.trim().toLowerCase().replace(/^@/, "");
  const matches = (c: (typeof everyone)[number]) =>
    !query ||
    nameOf(c.user).toLowerCase().includes(query) ||
    c.user.username.toLowerCase().includes(query) ||
    (c.lastMessage ? previewOf(c.lastMessage).toLowerCase().includes(query) : false);
  const shown = (tab === "requests" ? requests : chats).filter(matches);
  const selected = everyone.find((c) => c.user.id === selectedId)?.user ?? null;

  // Tell the alerts which chat is open, so you get no sound for the conversation you're reading
  useEffect(() => {
    activeChat.id = selectedId;
    return () => {
      activeChat.id = null;
    };
  }, [selectedId]);

  // Desktop notifications: the browser asks permission once, after a click
  const [canAskNotify, setCanAskNotify] = useState(false);
  useEffect(() => {
    const check = () => setCanAskNotify("Notification" in window && Notification.permission === "default");
    check();
  }, []);

  const tabButton = (value: "chats" | "requests", label: string, count: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => setTab(value)}
      className={`flex-1 border-b-2 py-2 text-sm font-semibold hover:cursor-pointer ${
        tab === value ? "border-blue-500 text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {label}
      {count > 0 && <span className="ml-1 rounded-full bg-blue-500 px-1.5 text-xs text-white">{count}</span>}
    </button>
  );

  return (
    <div className="flex h-[calc(100dvh-60px)] min-h-0 bg-surface text-ink">
      {/* Sidebar: hidden on phones while a chat is open; can shrink to just avatars on bigger screens */}
      <aside
        className={`${selected ? "hidden sm:flex" : "flex"} relative w-full flex-col border-r border-line transition-[width] ${
          collapsed ? "sm:w-[76px]" : "sm:w-80"
        }`}
        aria-label="Chats"
      >
        <div className={`flex items-center gap-2 px-4 pt-3 pb-2 ${collapsed ? "sm:justify-center sm:px-2" : "justify-between"}`}>
          <h1 className={`text-xl font-semibold ${collapsed ? "sm:sr-only" : ""}`}>Chats</h1>
          <div className="flex items-center gap-1">
            {canAskNotify && !collapsed && (
              <button
                type="button"
                onClick={() => Notification.requestPermission().then(() => setCanAskNotify(false))}
                className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:cursor-pointer hover:bg-surface-2"
              >
                🔔 Turn on alerts
              </button>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden h-9 w-9 items-center justify-center rounded-full text-lg hover:cursor-pointer hover:bg-surface-2 sm:flex"
              aria-label={collapsed ? "Expand the chat list" : "Collapse the chat list"}
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? "»" : "«"}
            </button>
          </div>
        </div>

        <div className={collapsed ? "sm:hidden" : ""}>
          <div className="px-4 pb-2">
            <label htmlFor="chat-search" className="sr-only">
              Search chats
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted" aria-hidden="true">
                🔍
              </span>
              <input
                id="chat-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setSearch("")}
                placeholder="Search chats"
                autoComplete="off"
                className="w-full rounded-full border border-line bg-field py-2 pr-3 pl-9 text-sm text-ink focus:border-ink focus:outline-none"
              />
            </div>
          </div>
          <div className="flex px-4" role="tablist" aria-label="Chats or message requests">
            {tabButton("chats", "Chats", 0)}
            {tabButton("requests", "Requests", requests.length)}
          </div>
        </div>
        {!connected && !collapsed && (
          <p className="mx-4 mt-2 rounded-md bg-amber-400/20 px-3 py-1 text-xs text-ink">Reconnecting… messages may be a few seconds late.</p>
        )}
        {users.isPending && <p className="px-4 pt-2 text-muted">Loading chats…</p>}
        {users.isError && <p className="px-4 pt-2 text-red-500">Couldn&apos;t load your chats. Is the backend running?</p>}
        {!collapsed && tab === "chats" && chats.length === 1 && !query && (
          <p className="px-4 pt-2 text-sm text-muted">Your list only has Sparky so far. Tap ➕ to add a friend by their username.</p>
        )}
        {!collapsed && query && shown.length === 0 && (
          <div className="px-4 pt-3 text-sm text-muted">
            <p>No chats match &quot;{search.trim()}&quot;.</p>
            <button type="button" onClick={() => setAdding(true)} className="mt-2 font-semibold text-blue-500 hover:cursor-pointer">
              ➕ Start a new chat with @{query}?
            </button>
          </div>
        )}
        {!collapsed && tab === "requests" && requests.length === 0 && (
          <p className="px-4 pt-3 text-sm text-muted">No message requests. When someone you haven&apos;t added writes to you, it waits here.</p>
        )}

        <ul className="min-h-0 flex-1 overflow-y-auto pt-1 pb-24">
          {/* Collapsed: show everyone (chats and requests) as avatars */}
          {(collapsed ? everyone : shown).map(({ user, lastMessage, unread }) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => select(user.id)}
                title={collapsed ? nameOf(user) : undefined}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:cursor-pointer hover:bg-surface-2 ${
                  user.id === selectedId ? "bg-surface-2" : ""
                } ${collapsed ? "sm:justify-center sm:px-2" : ""}`}
              >
                <span className="relative">
                  <ContactAvatar user={user} />
                  {collapsed && unread > 0 && (
                    <span className="absolute -top-1 -right-1 hidden min-w-5 rounded-full bg-green-500 px-1 text-center text-[11px] leading-5 font-bold text-white sm:block">
                      {unread}
                    </span>
                  )}
                </span>
                <span className={`min-w-0 flex-1 ${collapsed ? "sm:hidden" : ""}`}>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{nameOf(user)}</span>
                    {lastMessage && (
                      <span className={`shrink-0 text-xs ${unread && !user.isRequest ? "font-semibold text-green-600" : "text-muted"}`}>
                        {timeOf(lastMessage.createdAt)}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    {typing[user.id] ? (
                      <span className="text-sm font-semibold text-green-600">typing…</span>
                    ) : (
                      <span className={`block truncate text-sm ${unread ? "font-semibold text-ink" : "text-muted"}`}>
                        {lastMessage
                          ? `${lastMessage.senderId === me.id ? "You: " : ""}${previewOf(lastMessage)}`
                          : user.isBot
                            ? "Say hi to your AI assistant"
                            : `@${user.username}`}
                      </span>
                    )}
                    {unread > 0 && !user.isRequest && (
                      <span className="shrink-0 rounded-full bg-green-500 px-2 text-xs font-bold text-white" aria-label={`${unread} unread`}>
                        {unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* Floating ➕ (like WhatsApp): start a new chat by username */}
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label="New chat"
          title="New chat"
          className={`absolute flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 text-3xl text-white shadow-lg transition hover:cursor-pointer hover:bg-blue-600 ${
            collapsed ? "right-4 bottom-5 sm:right-2.5 sm:h-12 sm:w-12 sm:text-2xl" : "right-4 bottom-5"
          }`}
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          +
        </button>
      </aside>

      {adding && (
        <NewChatDialog
          initial={query}
          onClose={() => setAdding(false)}
          onAdded={(user) => {
            setAdding(false);
            setSearch("");
            setTab("chats");
            select(user.id);
          }}
        />
      )}

      {/* Chat panel */}
      <section className={`${selected ? "flex" : "hidden sm:flex"} min-w-0 flex-1 flex-col`}>
        {selected ? (
          <Thread key={selected.id} me={me} partner={selected} onBack={() => select(null)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-page p-6 text-center text-muted">
            <p className="text-lg font-semibold text-ink">Pick someone to chat with</p>
            <p>Or tap ➕ to add a friend by their username. Sparky is always in your list.</p>
          </div>
        )}
      </section>
    </div>
  );
}

// The "New chat" box opened by the floating ➕: type someone's exact username to add them and open the chat
function NewChatDialog({ initial, onClose, onAdded }: { initial: string; onClose: () => void; onAdded: (user: User) => void }) {
  const [username, setUsername] = useState(initial);
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: (name: string) => api<User>("/contacts", { method: "POST", body: { username: name } }),
    onSuccess: (user) => {
      toast.success(`${nameOf(user)} added!`);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onAdded(user); // open the chat with them straight away
    },
    onError: (error) => (error instanceof ApiError ? error.messages : ["Couldn't add them."]).forEach((m) => toast.error(m)),
  });

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = username.trim();
    if (name) add.mutate(name);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-chat-title"
        className="w-full max-w-sm rounded-2xl bg-surface p-5 text-ink shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="new-chat-title" className="text-lg font-semibold">
            New chat
          </h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 hover:cursor-pointer hover:bg-surface-2" aria-label="Close">
            ✕
          </button>
        </div>
        <label htmlFor="new-chat-username" className="mb-1 block text-sm">
          Their username
        </label>
        <div className="flex items-center rounded-[10px] border border-line bg-field focus-within:border-ink">
          <span className="pl-3 text-muted" aria-hidden="true">
            @
          </span>
          <input
            id="new-chat-username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/^@/, ""))}
            placeholder="username"
            maxLength={20}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-ink focus:outline-none"
          />
        </div>
        <p className="mt-1 text-xs text-muted">The exact username. There&apos;s no public list of users, for privacy.</p>
        <button
          type="submit"
          disabled={!username.trim() || add.isPending}
          className="mt-4 w-full rounded-[10px] bg-blue-500 py-2 font-semibold text-white hover:cursor-pointer disabled:opacity-50"
        >
          {add.isPending ? "Adding…" : "Add and start chatting"}
        </button>
      </form>
    </div>
  );
}

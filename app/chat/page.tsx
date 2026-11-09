"use client";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type SubmitEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import RequireAuth from "@/app/components/RequireAuth";
import EmojiPicker from "@/app/components/EmojiPicker";
import Attachment from "@/app/components/Attachment";
import CameraCapture from "@/app/components/CameraCapture";
import PresenceDot from "@/app/components/PresenceDot";
import { api, ApiError, nameOf, presenceText, previewOf, type Conversation, type Message, type User } from "@/lib/api";
import { usePresence, useRealtime } from "@/lib/realtime";
import { activeChat } from "@/lib/active-chat";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // same limit as the backend
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
const showErrors = (error: Error) =>
  (error instanceof ApiError ? error.messages : ["Something went wrong."]).forEach((m) => toast.error(m));

function Avatar({ user, size = "h-10 w-10" }: { user: User; size?: string }) {
  const presence = usePresence(user);
  // First letter of the name in a circle (the AI gets a blue one), with the status dot
  return (
    <span
      className={`relative flex ${size} shrink-0 items-center justify-center rounded-full font-semibold ${
        user.isBot ? "bg-blue-500 text-white" : "bg-accent text-accent-ink"
      }`}
      aria-hidden="true"
    >
      {user.isBot ? "⚡" : nameOf(user).charAt(0).toUpperCase()}
      <PresenceDot status={presence?.status} />
    </span>
  );
}

// "typing" with three bouncing dots
function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label="typing">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

function Chat({ me }: { me: User }) {
  const router = useRouter();
  const { connected, typing } = useRealtime();
  // The open chat lives in the URL (/chat?with=5), so notifications and the back button can open it
  const selectedId = Number(useSearchParams().get("with")) || null;
  const select = (id: number | null) => router.replace(id ? `/chat?with=${id}` : "/chat", { scroll: false });

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
  const contacts = useMemo(() => {
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

  const selected = contacts.find((c) => c.user.id === selectedId)?.user ?? null;

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

  return (
    <div className="flex h-[calc(100dvh-60px)] min-h-0 bg-surface text-ink">
      {/* Sidebar: hidden on phones while a chat is open; can shrink to just avatars on bigger screens */}
      <aside
        className={`${selected ? "hidden sm:flex" : "flex"} w-full flex-col border-r border-line transition-[width] ${
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

        {!collapsed && <AddContact onAdded={(user) => select(user.id)} />}
        {collapsed && <div className="sm:hidden"><AddContact onAdded={(user) => select(user.id)} /></div>}
        {!connected && !collapsed && (
          <p className="mx-4 mb-2 rounded-md bg-amber-400/20 px-3 py-1 text-xs text-ink">Reconnecting… messages may be a few seconds late.</p>
        )}
        {users.isPending && <p className="px-4 text-muted">Loading chats…</p>}
        {users.isError && <p className="px-4 text-red-500">Couldn&apos;t load your chats. Is the backend running?</p>}
        {users.data?.length === 1 && !collapsed && (
          <p className="px-4 pb-2 text-sm text-muted">Your list only has Sparky so far. Add a friend by their username above.</p>
        )}

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {contacts.map(({ user, lastMessage, unread }) => (
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
                  <Avatar user={user} />
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
                      <span className={`shrink-0 text-xs ${unread ? "font-semibold text-green-600" : "text-muted"}`}>
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
                    {unread > 0 && (
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
      </aside>

      {/* Chat panel */}
      <section className={`${selected ? "flex" : "hidden sm:flex"} min-w-0 flex-1 flex-col`}>
        {selected ? (
          <Thread key={selected.id} me={me} partner={selected} onBack={() => select(null)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-page p-6 text-center text-muted">
            <p className="text-lg font-semibold text-ink">Pick someone to chat with</p>
            <p>Or add a friend by their username. Sparky, the AI, is always in your list.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Thread({ me, partner, onBack }: { me: User; partner: User; onBack: () => void }) {
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const queryClient = useQueryClient();
  const { connected, typing, sendTyping } = useRealtime();
  const presence = usePresence(partner);
  const partnerTyping = !!typing[partner.id];
  const bottomRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingState = useRef({ sentAt: 0, timer: undefined as ReturnType<typeof setTimeout> | undefined });

  // The messages in this chat. New ones arrive through the live connection; the timer is a backup.
  const thread = useQuery({
    queryKey: ["thread", partner.id],
    queryFn: () => api<Message[]>(`/messages/${partner.id}`),
    refetchInterval: connected ? 60_000 : 3_000,
  });

  const send = useMutation({
    mutationFn: ({ content, file }: { content: string; file: File | null }) => {
      // With a file: a multipart form. Text only: plain JSON.
      if (!file) return api(`/messages/${partner.id}`, { method: "POST", body: { content } });
      const form = new FormData();
      form.append("file", file);
      if (content) form.append("content", content);
      return api(`/messages/${partner.id}`, { method: "POST", body: form });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thread", partner.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error, sent) => {
      // give the text and file back so nothing is lost
      setDraft(sent.content);
      setFile(sent.file);
      showErrors(error);
    },
  });

  // Keep the newest message (and the typing bubble) in view
  const count = thread.data?.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [count, send.isPending, partnerTyping]);

  // The message box grows with the text (up to about 6 lines, then it scrolls)
  useLayoutEffect(() => {
    const box = textRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 160)}px`;
  }, [draft]);

  // "typing…": tell them at most every 2.5 s while typing, and "stopped" after 3 s of quiet
  function stopTyping() {
    clearTimeout(typingState.current.timer);
    if (typingState.current.sentAt) sendTyping(partner.id, false);
    typingState.current.sentAt = 0;
  }
  function onDraftChange(value: string) {
    setDraft(value);
    if (partner.isBot) return;
    if (!value.trim()) return stopTyping();
    if (Date.now() - typingState.current.sentAt > 2500) {
      sendTyping(partner.id, true);
      typingState.current.sentAt = Date.now();
    }
    clearTimeout(typingState.current.timer);
    typingState.current.timer = setTimeout(stopTyping, 3000);
  }
  useEffect(() => () => stopTyping(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // A preview of the picked photo/video before sending
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  function submit() {
    const content = draft.trim();
    if ((!content && !file) || send.isPending) return;
    stopTyping();
    setDraft("");
    setFile(null);
    send.mutate({ content, file });
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    submit();
  }

  // Enter sends, Shift+Enter makes a new line
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function attachFile(picked: File) {
    if (!picked.type.startsWith("image/") && !picked.type.startsWith("video/")) return void toast.error("You can only send photos and videos.");
    if (picked.size > MAX_FILE_BYTES) return void toast.error("That file is too big. The limit is 25 MB.");
    setFile(picked);
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still triggers onChange
    if (picked) attachFile(picked);
  }

  // Put the emoji where the cursor is, not always at the end
  function insertEmoji(emoji: string) {
    const box = textRef.current;
    const start = box?.selectionStart ?? draft.length;
    const end = box?.selectionEnd ?? draft.length;
    onDraftChange(draft.slice(0, start) + emoji + draft.slice(end));
    requestAnimationFrame(() => {
      box?.focus();
      box?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  const subtitle = partnerTyping ? null : partner.isBot ? "AI assistant · always online" : presenceText(presence) || `@${partner.username}`;
  const iconButton = "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] text-xl hover:cursor-pointer hover:bg-surface-2";

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-md px-2 py-1 hover:bg-surface-2 sm:hidden" aria-label="Back to chats">
          ←
        </button>
        <Avatar user={partner} />
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <span className="truncate">{nameOf(partner)}</span>
            {partner.isBot && <span className="rounded-full bg-blue-100 px-2 text-xs font-semibold text-blue-600">AI</span>}
          </p>
          <p className="truncate text-sm text-muted">
            {partnerTyping ? <span className="font-semibold text-green-600">typing…</span> : subtitle}
          </p>
        </div>
        <span className="ml-auto hidden text-xs text-muted md:inline" title="Messages and files are stored encrypted">
          🔒 Encrypted
        </span>
        {!partner.isBot && <ContactButton partner={partner} onRemoved={onBack} />}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-page px-4 py-4">
        {thread.isPending && <p className="text-center text-muted">Loading messages…</p>}
        {thread.data?.length === 0 && !send.isPending && (
          <p className="text-center text-muted">
            {partner.isBot ? 'No messages yet. Try "hi", "joke" or "calc 12 * 4".' : "No messages yet. Say hello!"}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {thread.data?.map((m) => {
            const mine = m.senderId === me.id;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`flex max-w-[80%] flex-col gap-2 rounded-2xl px-4 py-2 break-words whitespace-pre-wrap ${
                    mine ? "rounded-br-sm bg-bubble-me text-bubble-me-ink" : "rounded-bl-sm bg-bubble-them text-bubble-them-ink shadow-sm"
                  }`}
                >
                  {m.attachment && <Attachment message={m} />}
                  {m.content && <span>{m.content}</span>}
                  <span className="text-right text-[11px] opacity-60">
                    {timeOf(m.createdAt)}
                    {mine && !partner.isBot && (m.readAt ? " · Seen" : " · Sent")}
                  </span>
                </div>
              </li>
            );
          })}
          {/* While sending: show my message right away, and a typing bubble for the AI */}
          {send.isPending && (
            <li className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-bubble-me px-4 py-2 break-words whitespace-pre-wrap text-bubble-me-ink opacity-60">
                {send.variables.file && <span className="block">📎 Sending {send.variables.file.type.startsWith("video") ? "video" : "photo"}…</span>}
                {send.variables.content}
              </div>
            </li>
          )}
          {(partnerTyping || (send.isPending && partner.isBot)) && (
            <li className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-bubble-them px-4 py-3 text-muted shadow-sm">
                <TypingDots />
              </div>
            </li>
          )}
        </ul>
        <div ref={bottomRef} />
      </div>

      {/* The picked file, waiting to be sent */}
      {file && previewUrl && (
        <div className="flex items-center gap-3 border-t border-line px-3 pt-3">
          {file.type.startsWith("video") ? (
            <video src={previewUrl} className="h-16 rounded-md" muted />
          ) : (
            <img src={previewUrl} alt="Selected photo" className="h-16 rounded-md" />
          )}
          <span className="min-w-0 flex-1 truncate text-sm text-muted">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} className="rounded-md px-2 py-1 text-sm font-semibold hover:cursor-pointer hover:bg-surface-2" aria-label="Remove the file">
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-1 border-t border-line p-3 sm:gap-2">
        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFile} className="hidden" id="file" />
        <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Attach a photo or video" className={iconButton}>
          📎
        </button>
        <button type="button" onClick={() => setCameraOpen(true)} aria-label="Take a photo or record a video" className={iconButton}>
          📷
        </button>
        <EmojiPicker onPick={insertEmoji} />
        <label htmlFor="message" className="sr-only">
          Message
        </label>
        <textarea
          id="message"
          ref={textRef}
          rows={1}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={stopTyping}
          maxLength={2000}
          placeholder={`Message ${nameOf(partner)}`}
          className="min-h-[42px] min-w-0 flex-1 resize-none overflow-y-auto rounded-[10px] border border-line bg-field px-3 py-2 text-ink focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={(!draft.trim() && !file) || send.isPending}
          className="h-[42px] shrink-0 rounded-[10px] bg-blue-500 px-4 font-semibold text-white hover:cursor-pointer disabled:opacity-50"
        >
          Send
        </button>
      </form>

      {cameraOpen && (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onCapture={(captured) => {
            setCameraOpen(false);
            attachFile(captured);
          }}
        />
      )}
    </>
  );
}

// The "Add by username" box at the top of the chat list
function AddContact({ onAdded }: { onAdded: (user: User) => void }) {
  const [username, setUsername] = useState("");
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: (name: string) => api<User>("/contacts", { method: "POST", body: { username: name } }),
    onSuccess: (user) => {
      setUsername("");
      toast.success(`${nameOf(user)} added!`);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onAdded(user); // open the chat with them straight away
    },
    onError: showErrors,
  });

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = username.trim();
    if (name) add.mutate(name);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 px-4 pb-3">
      <label htmlFor="add-username" className="sr-only">
        Add someone by username
      </label>
      <input
        id="add-username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Add by username"
        maxLength={21}
        autoComplete="off"
        className="min-w-0 flex-1 rounded-[10px] border border-line bg-field px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
      />
      <button
        type="submit"
        disabled={!username.trim() || add.isPending}
        className="rounded-[10px] bg-accent px-3 text-sm font-semibold text-accent-ink hover:cursor-pointer disabled:opacity-50"
      >
        {add.isPending ? "…" : "Add"}
      </button>
    </form>
  );
}

// In the chat header: "Add contact" for someone who messaged you, or "Remove" for a contact
function ContactButton({ partner, onRemoved }: { partner: User; onRemoved: () => void }) {
  const [confirming, setConfirming] = useState(false); // removing takes two clicks, so it can't happen by accident
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["contacts"] });

  const add = useMutation({
    mutationFn: () => api<User>("/contacts", { method: "POST", body: { username: partner.username } }),
    onSuccess: () => {
      toast.success(`${nameOf(partner)} added!`);
      refresh();
    },
    onError: showErrors,
  });

  const remove = useMutation({
    mutationFn: () => api(`/contacts/${partner.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.info(`${nameOf(partner)} removed from your list.`);
      refresh();
      onRemoved();
    },
    onError: showErrors,
  });

  // After the first click, go back to normal if they don't confirm within 3 seconds
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const style = "ml-auto shrink-0 rounded-[8px] border border-line px-3 py-1 text-sm font-semibold hover:cursor-pointer hover:bg-surface-2 disabled:opacity-50 md:ml-0";

  if (!partner.isContact) {
    return (
      <button type="button" onClick={() => add.mutate()} disabled={add.isPending} className={style}>
        + Add contact
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => (confirming ? remove.mutate() : setConfirming(true))}
      disabled={remove.isPending}
      className={`${style} ${confirming ? "border-red-500 text-red-500" : ""}`}
    >
      {confirming ? "Click to confirm" : "Remove"}
    </button>
  );
}

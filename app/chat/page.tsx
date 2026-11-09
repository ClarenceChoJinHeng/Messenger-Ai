"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type SubmitEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import RequireAuth from "@/app/components/RequireAuth";
import { api, ApiError, nameOf, type Conversation, type Message, type User } from "@/lib/api";

export default function ChatPage() {
  return <RequireAuth>{(me) => <Chat me={me} />}</RequireAuth>;
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Avatar({ user }: { user: User }) {
  // First letter of the name in a circle; the AI gets a blue one
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold text-white ${
        user.isBot ? "bg-blue-500" : "bg-black"
      }`}
      aria-hidden="true"
    >
      {user.isBot ? "⚡" : nameOf(user).charAt(0).toUpperCase()}
    </span>
  );
}

function Chat({ me }: { me: User }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Everyone I can talk to, and my existing chats (refreshed every 5 s for new messages)
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users") });
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<Conversation[]>("/messages/conversations"),
    refetchInterval: 5000,
  });

  // Sidebar order: the AI first, then recent chats (newest first), then everyone else A→Z
  const contacts = useMemo(() => {
    const last = new Map((conversations.data ?? []).map((c) => [c.user.id, c.lastMessage]));
    return [...(users.data ?? [])]
      .map((user) => ({ user, lastMessage: last.get(user.id) ?? null }))
      .sort((a, b) => {
        if (a.user.isBot !== b.user.isBot) return a.user.isBot ? -1 : 1;
        if (a.lastMessage && b.lastMessage) return b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt);
        if (a.lastMessage || b.lastMessage) return a.lastMessage ? -1 : 1;
        return a.user.username.localeCompare(b.user.username);
      });
  }, [users.data, conversations.data]);

  const selected = contacts.find((c) => c.user.id === selectedId)?.user ?? null;

  return (
    <div className="flex h-[calc(100dvh-62px)] min-h-0 bg-white text-black">
      {/* Sidebar: hidden on phones while a chat is open */}
      <aside
        className={`${selected ? "hidden sm:flex" : "flex"} w-full flex-col border-r border-zinc-200 sm:w-80`}
        aria-label="Contacts"
      >
        <h1 className="px-4 pt-4 pb-2 text-xl font-semibold">Chats</h1>
        {users.isPending && <p className="px-4 text-zinc-500">Loading people…</p>}
        {users.isError && <p className="px-4 text-red-500">Couldn&apos;t load people. Is the backend running?</p>}
        {users.data?.length === 1 && (
          <p className="px-4 pb-2 text-sm text-zinc-500">
            No other users yet. Register a second account in a private window to test messaging.
          </p>
        )}
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {contacts.map(({ user, lastMessage }) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => setSelectedId(user.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:cursor-pointer hover:bg-zinc-100 ${
                  user.id === selectedId ? "bg-zinc-100" : ""
                }`}
              >
                <Avatar user={user} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{nameOf(user)}</span>
                    {lastMessage && <span className="shrink-0 text-xs text-zinc-500">{timeOf(lastMessage.createdAt)}</span>}
                  </span>
                  <span className="block truncate text-sm text-zinc-500">
                    {lastMessage
                      ? `${lastMessage.senderId === me.id ? "You: " : ""}${lastMessage.content}`
                      : user.isBot
                        ? "Say hi to your AI assistant"
                        : `@${user.username}`}
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
          <Thread key={selected.id} me={me} partner={selected} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
            <p className="text-lg font-semibold text-black">Pick someone to chat with</p>
            <p>Tip: Sparky, the AI, is always at the top of the list.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Thread({ me, partner, onBack }: { me: User; partner: User; onBack: () => void }) {
  const [draft, setDraft] = useState("");
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  // The messages in this chat, refreshed every 3 s so replies from humans show up
  const thread = useQuery({
    queryKey: ["thread", partner.id],
    queryFn: () => api<Message[]>(`/messages/${partner.id}`),
    refetchInterval: 3000,
  });

  const send = useMutation({
    mutationFn: (content: string) =>
      api<{ sent: Message; reply: Message | null }>(`/messages/${partner.id}`, { method: "POST", body: { content } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thread", partner.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error, content) => {
      setDraft(content); // give the text back so nothing is lost
      (error instanceof ApiError ? error.messages : ["Message not sent."]).forEach((m) => toast.error(m));
    },
  });

  // Keep the newest message in view
  const count = thread.data?.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [count, send.isPending]);

  function submit() {
    const content = draft.trim();
    if (!content || send.isPending) return;
    setDraft("");
    send.mutate(content);
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

  return (
    <>
      <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-md px-2 py-1 hover:bg-zinc-100 sm:hidden" aria-label="Back to chats">
          ←
        </button>
        <Avatar user={partner} />
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <span className="truncate">{nameOf(partner)}</span>
            {partner.isBot && <span className="rounded-full bg-blue-100 px-2 text-xs font-semibold text-blue-600">AI</span>}
          </p>
          <p className="truncate text-sm text-zinc-500">{partner.bio || `@${partner.username}`}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-4 py-4">
        {thread.isPending && <p className="text-center text-zinc-500">Loading messages…</p>}
        {thread.data?.length === 0 && !send.isPending && (
          <p className="text-center text-zinc-500">
            {partner.isBot ? 'No messages yet. Try "hi", "joke" or "calc 12 * 4".' : "No messages yet. Say hello!"}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {thread.data?.map((m) => {
            const mine = m.senderId === me.id;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 break-words whitespace-pre-wrap ${
                    mine ? "rounded-br-sm bg-black text-white" : "rounded-bl-sm bg-white text-black shadow-sm"
                  }`}
                >
                  {m.content}
                  <span className={`mt-1 block text-right text-[11px] ${mine ? "text-zinc-400" : "text-zinc-500"}`}>
                    {timeOf(m.createdAt)}
                  </span>
                </div>
              </li>
            );
          })}
          {/* While sending: show my message right away, and a typing bubble for the AI */}
          {send.isPending && (
            <>
              <li className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-black px-4 py-2 break-words whitespace-pre-wrap text-white opacity-60">
                  {send.variables}
                </div>
              </li>
              {partner.isBot && (
                <li className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-zinc-500 shadow-sm">Sparky is typing…</div>
                </li>
              )}
            </>
          )}
        </ul>
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-zinc-200 p-3">
        <label htmlFor="message" className="sr-only">
          Message
        </label>
        <textarea
          id="message"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={2000}
          placeholder={`Message ${nameOf(partner)}`}
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-[10px] border border-zinc-300 px-3 py-2 focus:border-black focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || send.isPending}
          className="rounded-[10px] bg-blue-500 px-5 py-2 font-semibold text-white hover:cursor-pointer disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </>
  );
}

"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type SubmitEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import EmojiPicker from "@/app/components/EmojiPicker";
import WritingHelper from "@/app/components/WritingHelper";
import CameraCapture from "@/app/components/CameraCapture";
import VoiceRecorder from "@/app/components/VoiceRecorder";
import UserAvatar from "@/app/components/UserAvatar";
import VoicePlayer from "@/app/components/VoicePlayer";
import { useObjectUrl } from "@/lib/use-object-url";
import Dropdown from "@/app/components/Dropdown";
import {
  api,
  ApiError,
  kindOf,
  nameOf,
  presenceText,
  previewOf,
  type Message,
  type User,
} from "@/lib/api";
import { usePresence, useRealtime } from "@/lib/realtime";
import MessageBubble from "./MessageBubble";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // same limit as the backend
// The clock, for event handlers only ("typing" timing). Never call it while drawing.
const clock = () => Date.now();
const showErrors = (error: Error) =>
  (error instanceof ApiError ? error.messages : ["Something went wrong."]).forEach((m) =>
    toast.error(m),
  );

// "typing" with three bouncing dots
export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="typing">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

export default function Thread({
  me,
  partner,
  onBack,
}: {
  me: User;
  partner: User;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null); // answering this message
  const [editing, setEditing] = useState<Message | null>(null); // changing this message's text
  const [actionsFor, setActionsFor] = useState<number | null>(null); // phone: bubble whose actions are shown
  const [now, setNow] = useState(0); // the clock, updated every 30 s (decides if "Edit" is still allowed)
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);
  const queryClient = useQueryClient();
  const { connected, typing, aiStream, sendTyping } = useRealtime();
  const sparkyText = partner.isBot ? (aiStream[partner.id] ?? null) : null; // Sparky's reply being written
  const [translations, setTranslations] = useState<Record<number, string>>({}); // message id → translation
  const [summary, setSummary] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [language, setLanguage] = useState("English");
  // Is the real AI on? Free "simple mode" (no API key) hides the ✨ / 🌐 tools instead of showing buttons that can't work
  const aiStatus = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => api<{ claude: boolean }>("/ai/status"),
    staleTime: 5 * 60_000,
  });
  const aiOn = aiStatus.data?.claude === true;
  const presence = usePresence(partner);
  const partnerTyping = !!typing[partner.id];
  const bottomRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingState = useRef({
    sentAt: 0,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  });

  // The messages in this chat. New ones arrive through the live connection; the timer is a backup.
  const thread = useQuery({
    queryKey: ["thread", partner.id],
    queryFn: () => api<Message[]>(`/messages/${partner.id}`),
    refetchInterval: connected ? 60_000 : 3_000,
  });
  const refreshChat = () => {
    queryClient.invalidateQueries({ queryKey: ["thread", partner.id] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };
  // Put an updated message straight into the list (edits, unsends, reactions)
  const replaceMessage = (updated: Message) =>
    queryClient.setQueryData<Message[]>(["thread", partner.id], (old) =>
      old?.map((x) => (x.id === updated.id ? updated : x)),
    );

  const send = useMutation({
    mutationFn: ({
      content,
      file,
      replyToId,
    }: {
      content: string;
      file: File | null;
      replyToId?: number;
    }) => {
      // With a file: a multipart form. Text only: plain JSON.
      if (!file)
        return api(`/messages/${partner.id}`, {
          method: "POST",
          body: { content, ...(replyToId && { replyToId: String(replyToId) }) },
        });
      const form = new FormData();
      form.append("file", file);
      if (content) form.append("content", content);
      if (replyToId) form.append("replyToId", String(replyToId));
      return api(`/messages/${partner.id}`, { method: "POST", body: form });
    },
    onSuccess: refreshChat,
    onError: (error, sent) => {
      setDraft(sent.content); // give the text and file back so nothing is lost
      setFile(sent.file);
      showErrors(error);
    },
  });
  const edit = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      api<Message>(`/messages/item/${id}`, { method: "PATCH", body: { content } }),
    onSuccess: replaceMessage,
    onError: showErrors,
  });
  const unsend = useMutation({
    mutationFn: (id: number) => api<Message>(`/messages/item/${id}`, { method: "DELETE" }),
    onSuccess: (m) => {
      replaceMessage(m);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: showErrors,
  });
  const react = useMutation({
    mutationFn: ({ id, emoji }: { id: number; emoji: string }) =>
      api<Message>(`/messages/item/${id}/reaction`, { method: "PUT", body: { emoji } }),
    onSuccess: replaceMessage,
    onError: showErrors,
  });

  // Keep the newest message (and the typing bubble) in view
  const count = thread.data?.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [count, send.isPending, partnerTyping, sparkyText]);

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
    if (partner.isBot || editing) return;
    if (!value.trim()) return stopTyping();
    if (clock() - typingState.current.sentAt > 2500) {
      sendTyping(partner.id, true);
      typingState.current.sentAt = clock();
    }
    clearTimeout(typingState.current.timer);
    typingState.current.timer = setTimeout(stopTyping, 3000);
  }
  useEffect(() => () => stopTyping(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // A preview of the picked file before sending
  const previewUrl = useObjectUrl(file);

  // Sparky helping in this friend chat. The answer is only shown to me, never sent.
  const assist = useMutation({
    mutationFn: (body: { action: "summarize" | "suggest" | "translate"; messageId?: number }) =>
      api<{ text?: string; suggestions?: string[] }>("/ai/assist", {
        method: "POST",
        body: { partnerId: partner.id, ...body, ...(body.action === "translate" && { language }) },
      }),
    onSuccess: (result, body) => {
      if (body.action === "summarize") setSummary(result.text ?? "");
      if (body.action === "suggest") setSuggestions(result.suggestions ?? []);
      if (body.action === "translate" && body.messageId)
        setTranslations((t) => ({ ...t, [body.messageId!]: result.text ?? "" }));
    },
    onError: showErrors,
  });
  function translate(m: Message) {
    setActionsFor(null);
    if (translations[m.id]) {
      // second click hides it
      return setTranslations((t) => {
        const rest = { ...t };
        delete rest[m.id];
        return rest;
      });
    }
    assist.mutate({ action: "translate", messageId: m.id });
  }

  function startReply(m: Message) {
    setEditing(null);
    setReplyTo(m);
    setActionsFor(null);
    textRef.current?.focus();
  }
  function startEdit(m: Message) {
    setReplyTo(null);
    setFile(null);
    setEditing(m);
    setDraft(m.content);
    setActionsFor(null);
    requestAnimationFrame(() => textRef.current?.focus());
  }
  function cancelMode() {
    if (editing) setDraft("");
    setEditing(null);
    setReplyTo(null);
  }

  function submit() {
    const content = draft.trim();
    if (editing) {
      if (content !== editing.content) edit.mutate({ id: editing.id, content });
      setEditing(null);
      setDraft("");
      return;
    }
    if ((!content && !file) || send.isPending) return;
    stopTyping();
    setDraft("");
    setFile(null);
    setReplyTo(null);
    send.mutate({ content, file, replyToId: replyTo?.id });
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    submit();
  }

  // Enter sends, Shift+Enter makes a new line, Escape cancels reply/edit
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") cancelMode();
  }

  function attachFile(picked: File) {
    const ok = ["image/", "video/", "audio/"].some((t) => picked.type.startsWith(t));
    if (!ok) return void toast.error("You can only send photos, videos and voice messages.");
    if (picked.size > MAX_FILE_BYTES)
      return void toast.error("That file is too big. The limit is 25 MB.");
    setEditing(null);
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

  // Scroll to a quoted message and flash it
  function jumpTo(id: number) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return void toast.info("That message is further back in the chat.");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 800, iterations: 2 });
  }

  const subtitle = partner.isBot
    ? aiOn
      ? "AI assistant · always online"
      : 'Simple mode · type "help" to see what I can do'
    : presenceText(presence) || `@${partner.username}`;
  const iconButton =
    "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] text-xl hover:cursor-pointer hover:bg-surface-2";

  return (
    <>
      <header className="border-line flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="hover:bg-surface-2 rounded-md px-2 py-1 sm:hidden"
          aria-label="Back to chats"
        >
          ←
        </button>
        <UserAvatar user={partner} status={presence?.status} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            <span className="truncate">{nameOf(partner)}</span>
            {partner.isBot && (
              <span className="rounded-full bg-blue-100 px-2 text-xs font-semibold text-blue-600">
                AI
              </span>
            )}
          </p>
          <p className="text-muted truncate text-sm">
            {partnerTyping ? (
              <span className="font-semibold text-green-600">typing…</span>
            ) : (
              subtitle
            )}
          </p>
        </div>
        <span
          className="text-muted hidden text-xs md:inline"
          title="Messages and files are stored encrypted"
        >
          🔒 Encrypted
        </span>
        {partner.isBot ? (
          <SparkyMenu />
        ) : (
          <>
            {aiOn && (
              <AiTools
                busy={assist.isPending}
                language={language}
                onLanguage={setLanguage}
                onSummarize={() => assist.mutate({ action: "summarize" })}
                onSuggest={() => assist.mutate({ action: "suggest" })}
              />
            )}
            <ContactMenu partner={partner} onGone={onBack} />
          </>
        )}
      </header>

      {/* Sparky's summary of this chat (only you see it) */}
      {summary && (
        <div className="border-line flex gap-3 border-b bg-blue-500/10 px-4 py-3 text-sm">
          <span aria-hidden="true">✨</span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 font-semibold">
              Sparky&apos;s summary{" "}
              <span className="text-muted font-normal">· only you can see this</span>
            </p>
            <p className="whitespace-pre-wrap">{summary}</p>
          </div>
          <button
            type="button"
            onClick={() => setSummary(null)}
            className="hover:bg-surface-2 self-start rounded-md px-2 hover:cursor-pointer"
            aria-label="Close summary"
          >
            ✕
          </button>
        </div>
      )}

      {partner.isRequest && <RequestBanner partner={partner} onGone={onBack} />}

      <div
        className="bg-page min-h-0 flex-1 overflow-y-auto px-4 py-4"
        onClick={(e) => e.target === e.currentTarget && setActionsFor(null)}
      >
        {thread.isPending && <p className="text-muted text-center">Loading messages…</p>}
        {thread.data?.length === 0 && !send.isPending && (
          <p className="text-muted text-center">
            {partner.isBot
              ? 'No messages yet. Try "hi", "joke" or "calc 12 * 4".'
              : "No messages yet. Say hello!"}
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {thread.data?.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              me={me}
              partner={partner}
              now={now}
              open={actionsFor === m.id}
              onToggle={() => setActionsFor((id) => (id === m.id ? null : m.id))}
              onReply={() => startReply(m)}
              onEdit={() => startEdit(m)}
              onUnsend={() => unsend.mutate(m.id)}
              onReact={(emoji) => react.mutate({ id: m.id, emoji })}
              onJumpTo={jumpTo}
              translation={translations[m.id]}
              onTranslate={partner.isBot || !aiOn ? undefined : () => translate(m)}
            />
          ))}
          {/* While sending: show my message right away */}
          {send.isPending && (
            <li className="flex justify-end">
              <div className="bg-bubble-me text-bubble-me-ink max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2 break-words whitespace-pre-wrap opacity-60">
                {send.variables.file && (
                  <span className="block">
                    📎 Sending{" "}
                    {kindOf(send.variables.file.type) === "voice"
                      ? "voice message"
                      : kindOf(send.variables.file.type)}
                    …
                  </span>
                )}
                {send.variables.content}
              </div>
            </li>
          )}
          {(partnerTyping || sparkyText === "") && (
            <li className="flex justify-start">
              <div className="bg-bubble-them text-muted rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <TypingDots />
              </div>
            </li>
          )}
          {/* Sparky's answer appearing word by word */}
          {sparkyText && (
            <li className="flex justify-start" aria-live="polite">
              <div className="bg-bubble-them text-bubble-them-ink max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2 break-words whitespace-pre-wrap shadow-sm">
                {sparkyText}
                <span
                  className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current align-middle"
                  aria-hidden="true"
                />
              </div>
            </li>
          )}
        </ul>
        <div ref={bottomRef} />
      </div>

      {/* Sparky's suggested replies: click one to put it in the message box */}
      {suggestions.length > 0 && (
        <div className="border-line flex flex-wrap items-center gap-2 border-t px-4 py-2">
          <span className="text-muted text-xs font-semibold">✨ Suggested:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onDraftChange(s);
                setSuggestions([]);
                textRef.current?.focus();
              }}
              className="rounded-full border border-blue-500/50 bg-blue-500/10 px-3 py-1 text-sm hover:cursor-pointer hover:bg-blue-500/20"
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSuggestions([])}
            className="hover:bg-surface-2 ml-auto rounded-md px-2 text-sm hover:cursor-pointer"
            aria-label="Hide suggestions"
          >
            ✕
          </button>
        </div>
      )}

      {/* Replying to / editing: a strip above the message box */}
      {(replyTo || editing) && (
        <div className="border-line bg-surface flex items-center gap-3 border-t px-4 py-2">
          <span className="w-1 self-stretch rounded-full bg-blue-500" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold text-blue-500">
              {editing
                ? "Editing message"
                : `Replying to ${replyTo!.senderId === me.id ? "yourself" : nameOf(partner)}`}
            </span>
            <span className="text-muted block truncate">{previewOf((editing ?? replyTo)!)}</span>
          </span>
          <button
            type="button"
            onClick={cancelMode}
            className="hover:bg-surface-2 rounded-md px-2 py-1 font-semibold hover:cursor-pointer"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>
      )}

      {/* The picked file, waiting to be sent */}
      {file && previewUrl && (
        <div className="border-line flex items-center gap-3 border-t px-3 pt-3">
          {kindOf(file.type) === "video" ? (
            <video src={previewUrl} className="h-16 rounded-md" muted />
          ) : kindOf(file.type) === "voice" ? (
            <VoicePlayer blob={file} />
          ) : (
            <img src={previewUrl} alt="Selected photo" className="h-16 rounded-md" />
          )}
          <span className="text-muted min-w-0 flex-1 truncate text-sm">
            {kindOf(file.type) === "voice" ? "Listen before sending" : file.name}
          </span>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="hover:bg-surface-2 rounded-md px-2 py-1 text-sm font-semibold hover:cursor-pointer"
            aria-label="Remove the file"
          >
            ✕
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="border-line flex items-end gap-1 border-t p-3 sm:gap-2"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          onChange={handleFile}
          className="hidden"
          id="file"
        />
        {!editing && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach a photo, video or audio"
              className={iconButton}
            >
              📎
            </button>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              aria-label="Take a photo or record a video"
              className={iconButton}
            >
              📷
            </button>
          </>
        )}
        <EmojiPicker onPick={insertEmoji} />
        {!editing && <WritingHelper text={draft} onChange={onDraftChange} />}
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
          placeholder={editing ? "Edit your message" : `Message ${nameOf(partner)}`}
          className="border-line bg-field text-ink focus:border-ink min-h-[42px] min-w-0 flex-1 resize-none overflow-y-auto rounded-[10px] border px-3 py-2 focus:outline-none"
        />
        {/* Empty box (and no file): the mic. Something typed: Send. */}
        {!editing && !draft.trim() && !file ? (
          <VoiceRecorder onRecorded={attachFile} onError={(msg) => toast.error(msg)} />
        ) : (
          <button
            type="submit"
            disabled={(!draft.trim() && !file) || send.isPending}
            className="h-[42px] shrink-0 rounded-[10px] bg-blue-500 px-4 font-semibold text-white hover:cursor-pointer disabled:opacity-50"
          >
            {editing ? "Save" : "Send"}
          </button>
        )}
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

// Shown at the top of a message request: Accept / Delete / Block
function RequestBanner({ partner, onGone }: { partner: User; onGone: () => void }) {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };
  const accept = useMutation({
    mutationFn: () => api("/contacts", { method: "POST", body: { username: partner.username } }),
    onSuccess: () => {
      toast.success(`${nameOf(partner)} is now in your chats.`);
      refresh();
      queryClient.invalidateQueries({ queryKey: ["thread", partner.id] }); // now "Seen" can be sent
    },
    onError: showErrors,
  });
  const dismiss = useMutation({
    mutationFn: () => api(`/contacts/requests/${partner.id}/dismiss`, { method: "POST" }),
    onSuccess: () => {
      refresh();
      onGone();
    },
    onError: showErrors,
  });
  const block = useMutation({
    mutationFn: () => api(`/blocks/${partner.id}`, { method: "POST" }),
    onSuccess: () => {
      toast.info(`${nameOf(partner)} is blocked.`);
      refresh();
      onGone();
    },
    onError: showErrors,
  });
  const busy = accept.isPending || dismiss.isPending || block.isPending;

  return (
    <div className="border-line border-b bg-amber-400/10 px-4 py-3 text-sm">
      <p className="mb-2">
        <b>{nameOf(partner)}</b> (@{partner.username}) wants to message you. They won&apos;t see
        that you&apos;ve read it until you accept. Replying also accepts.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => accept.mutate()}
          className="rounded-[8px] bg-blue-500 px-4 py-1.5 font-semibold text-white hover:cursor-pointer disabled:opacity-50"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => dismiss.mutate()}
          className="border-line hover:bg-surface-2 rounded-[8px] border px-4 py-1.5 font-semibold hover:cursor-pointer disabled:opacity-50"
        >
          Delete
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => block.mutate()}
          className="rounded-[8px] border border-red-500 px-4 py-1.5 font-semibold text-red-500 hover:cursor-pointer disabled:opacity-50"
        >
          Block
        </button>
      </div>
    </div>
  );
}

// The ⋯ menu in the chat header: add/remove contact, block
function ContactMenu({ partner, onGone }: { partner: User; onGone: () => void }) {
  const queryClient = useQueryClient();
  const [confirmBlock, setConfirmBlock] = useState(false);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const add = useMutation({
    mutationFn: () => api("/contacts", { method: "POST", body: { username: partner.username } }),
    onSuccess: () => {
      toast.success(`${nameOf(partner)} added!`);
      refresh();
    },
    onError: showErrors,
  });
  const remove = useMutation({
    mutationFn: () => api(`/contacts/${partner.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.info(`${nameOf(partner)} removed from your contacts. Your messages stay.`);
      refresh();
    },
    onError: showErrors,
  });
  const block = useMutation({
    mutationFn: () => api(`/blocks/${partner.id}`, { method: "POST" }),
    onSuccess: () => {
      toast.info(
        `${nameOf(partner)} is blocked. Unblock them any time in Profile → Blocked people.`,
      );
      refresh();
      onGone();
    },
    onError: showErrors,
  });

  const item = "block w-full px-4 py-2 text-left hover:cursor-pointer hover:bg-surface-2";
  return (
    <Dropdown
      label="Chat options"
      panelClass="w-56!"
      button={
        <span className="hover:bg-surface-2 flex h-9 w-9 items-center justify-center rounded-full text-xl">
          ⋯
        </span>
      }
    >
      {(close) => (
        <div className="py-2">
          {partner.isContact ? (
            <button type="button" className={item} onClick={() => (remove.mutate(), close())}>
              Remove from contacts
            </button>
          ) : (
            <button type="button" className={item} onClick={() => (add.mutate(), close())}>
              + Add to contacts
            </button>
          )}
          <button
            type="button"
            className={`${item} text-red-500`}
            onClick={() => {
              if (!confirmBlock) return setConfirmBlock(true);
              block.mutate();
              close();
            }}
          >
            {confirmBlock ? `Click again to block ${nameOf(partner)}` : "Block"}
          </button>
        </div>
      )}
    </Dropdown>
  );
}

// Sparky's ⋯ menu: start a new conversation (Sparky forgets the earlier messages)
function SparkyMenu() {
  const queryClient = useQueryClient();
  const reset = useMutation({
    mutationFn: () => api("/ai/reset", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thread"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: showErrors,
  });
  return (
    <Dropdown
      label="Sparky options"
      panelClass="w-64!"
      button={
        <span className="hover:bg-surface-2 flex h-9 w-9 items-center justify-center rounded-full text-xl">
          ⋯
        </span>
      }
    >
      {(close) => (
        <div className="py-2">
          <button
            type="button"
            className="hover:bg-surface-2 block w-full px-4 py-2 text-left hover:cursor-pointer"
            onClick={() => {
              reset.mutate();
              close();
            }}
          >
            🧹 New conversation
            <span className="text-muted block text-xs">
              Sparky forgets the earlier messages (they stay in the chat)
            </span>
          </button>
        </div>
      )}
    </Dropdown>
  );
}

const LANGUAGES = [
  "English",
  "Malay",
  "Chinese (Simplified)",
  "Tamil",
  "Japanese",
  "Korean",
  "Spanish",
  "French",
  "Indonesian",
  "Thai",
];

// The ✨ menu in a friend chat: Sparky summarizes, suggests replies, and sets the translation language
function AiTools({
  busy,
  language,
  onLanguage,
  onSummarize,
  onSuggest,
}: {
  busy: boolean;
  language: string;
  onLanguage: (l: string) => void;
  onSummarize: () => void;
  onSuggest: () => void;
}) {
  const item = "block w-full px-4 py-2 text-left hover:cursor-pointer hover:bg-surface-2";
  return (
    <Dropdown
      label="Ask Sparky about this chat"
      panelClass="w-72!"
      button={
        <span
          className={`hover:bg-surface-2 flex h-9 w-9 items-center justify-center rounded-full text-xl ${busy ? "animate-pulse" : ""}`}
          title="Ask Sparky"
        >
          ✨
        </span>
      }
    >
      {(close) => (
        <div className="py-2">
          <p className="text-muted px-4 pb-2 text-xs">
            Sparky reads this chat to help. Only you see the result.
          </p>
          <button type="button" className={item} onClick={() => (onSummarize(), close())}>
            📝 Summarize this chat
          </button>
          <button type="button" className={item} onClick={() => (onSuggest(), close())}>
            💬 Suggest replies
          </button>
          <label className="block px-4 py-2 text-sm">
            <span className="mb-1 block">🌐 Translate messages into</span>
            <select
              value={language}
              onChange={(e) => onLanguage(e.target.value)}
              className="border-line bg-field text-ink w-full rounded-md border px-2 py-1"
            >
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <span className="text-muted mt-1 block text-xs">Then use 🌐 on any message.</span>
          </label>
        </div>
      )}
    </Dropdown>
  );
}

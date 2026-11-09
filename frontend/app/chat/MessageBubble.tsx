"use client";
import { useEffect, useState } from "react";
import Attachment from "@/app/components/Attachment";
import { REACTIONS, type Message, type User } from "@/lib/api";

const EDIT_WINDOW_MS = 15 * 60 * 1000; // same as the backend
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// One chat bubble, with its actions: reply, react, edit (my text, within 15 min) and unsend (mine).
// Desktop: the actions appear on hover. Phone: tap the bubble to show them.
export default function MessageBubble({
  message: m,
  me,
  partner,
  now,
  open,
  onToggle,
  onReply,
  onEdit,
  onUnsend,
  onReact,
  onJumpTo,
  translation,
  onTranslate,
}: {
  message: Message;
  me: User;
  partner: User;
  now: number; // the current time, ticking every 30 s (for the 15-minute edit window)
  open: boolean; // actions shown (phone tap)
  onToggle: () => void;
  onReply: () => void;
  onEdit: () => void;
  onUnsend: () => void;
  onReact: (emoji: string) => void;
  onJumpTo: (id: number) => void;
  translation?: string; // Sparky's translation, shown under the text
  onTranslate?: () => void; // undefined = no translate button (e.g. in Sparky's own chat)
}) {
  const mine = m.senderId === me.id;
  const [picking, setPicking] = useState(false); // the reaction bar is open
  const [confirmUnsend, setConfirmUnsend] = useState(false);

  // An unconfirmed "Unsend?" goes back to normal after 3 seconds
  useEffect(() => {
    if (!confirmUnsend) return;
    const timer = setTimeout(() => setConfirmUnsend(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmUnsend]);

  // Group reactions: 👍 2, ❤️ 1 (and remember which one is mine)
  const counts = new Map<string, number>();
  m.reactions.forEach((r) => counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1));
  const myReaction = m.reactions.find((r) => r.userId === me.id)?.emoji;

  const canEdit = mine && !m.deletedAt && now - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS;
  const actionBtn = "rounded-full px-2 py-1 text-sm hover:cursor-pointer hover:bg-surface-2";

  return (
    <li id={`msg-${m.id}`} className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`flex max-w-[85%] items-center gap-1 ${mine ? "flex-row-reverse" : ""}`}>
        <div
          onClick={onToggle}
          className={`flex min-w-0 flex-col gap-2 rounded-2xl px-4 py-2 break-words whitespace-pre-wrap ${
            mine ? "rounded-br-sm bg-bubble-me text-bubble-me-ink" : "rounded-bl-sm bg-bubble-them text-bubble-them-ink shadow-sm"
          }`}
        >
          {m.deletedAt ? (
            <span className="italic opacity-70">🚫 This message was deleted</span>
          ) : (
            <>
              {/* The quoted message this one replies to: click to jump to it */}
              {m.replyTo && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onJumpTo(m.replyTo!.id);
                  }}
                  className="rounded-lg border-l-4 border-blue-500 bg-black/10 px-3 py-1 text-left text-sm hover:cursor-pointer"
                >
                  <span className="block font-semibold">{m.replyTo.senderId === me.id ? "You" : partner.displayName || partner.username}</span>
                  <span className="line-clamp-2 opacity-80">{m.replyTo.preview}</span>
                </button>
              )}
              {m.attachment && <Attachment message={m} />}
              {m.content && <span>{m.content}</span>}
              {translation && (
                <span className="border-t border-current/20 pt-1 text-sm italic opacity-90">🌐 {translation}</span>
              )}
            </>
          )}
          <span className="text-right text-[11px] opacity-60">
            {m.editedAt && !m.deletedAt && "edited · "}
            {timeOf(m.createdAt)}
            {mine && !partner.isBot && !m.deletedAt && (m.readAt ? " · Seen" : " · Sent")}
          </span>
        </div>

        {/* Actions: hover on desktop, tap on phones */}
        {!m.deletedAt && (
          <div className={`flex shrink-0 items-center gap-0.5 ${open || picking ? "flex" : "hidden group-hover:flex"}`}>
            <button type="button" onClick={onReply} className={actionBtn} aria-label="Reply" title="Reply">
              ↩
            </button>
            <button type="button" onClick={() => setPicking((p) => !p)} className={actionBtn} aria-label="React" title="React">
              🙂
            </button>
            {onTranslate && m.content && (
              <button type="button" onClick={onTranslate} className={actionBtn} aria-label={translation ? "Hide translation" : "Translate"} title="Translate">
                🌐
              </button>
            )}
            {canEdit && (
              <button type="button" onClick={onEdit} className={actionBtn} aria-label="Edit" title="Edit">
                ✏️
              </button>
            )}
            {mine && (
              <button
                type="button"
                onClick={() => (confirmUnsend ? onUnsend() : setConfirmUnsend(true))}
                className={
                  confirmUnsend
                    ? // its own style, so the grey hover of the other buttons can't cover the red
                      "rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white shadow-sm hover:cursor-pointer hover:bg-red-700"
                    : actionBtn
                }
                aria-label={confirmUnsend ? "Click again to unsend" : "Unsend"}
                title="Unsend"
              >
                {confirmUnsend ? "Unsend?" : "🗑"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* The reaction bar */}
      {picking && (
        <div className="mt-1 flex gap-1 rounded-full border border-line bg-surface px-2 py-1 shadow-lg" role="group" aria-label="Pick a reaction">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(emoji);
                setPicking(false);
              }}
              className={`rounded-full px-1 text-xl hover:scale-125 hover:cursor-pointer ${myReaction === emoji ? "bg-blue-500/20" : ""}`}
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Reactions under the bubble: click your own to remove it */}
      {counts.size > 0 && (
        <div className={`-mt-1 flex gap-1 ${mine ? "mr-2" : "ml-2"}`}>
          {[...counts.entries()].map(([emoji, n]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              className={`rounded-full border px-1.5 text-sm hover:cursor-pointer ${
                myReaction === emoji ? "border-blue-500 bg-blue-500/15" : "border-line bg-surface"
              }`}
              aria-label={`${emoji} ${n}${myReaction === emoji ? ", yours: click to remove" : ""}`}
            >
              {emoji}
              {n > 1 && <span className="ml-0.5 text-xs">{n}</span>}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

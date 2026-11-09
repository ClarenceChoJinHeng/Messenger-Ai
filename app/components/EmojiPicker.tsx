"use client";
import { useEffect, useRef, useState } from "react";

// A small grid of common emojis. Emojis are just text, so picking one inserts it into the message.
const EMOJIS = [
  "😀", "😂", "🤣", "😊", "😍", "🥰", "😘", "😎",
  "🤔", "😅", "😭", "😡", "😴", "🤯", "🥳", "😇",
  "👍", "👎", "👏", "🙏", "💪", "👋", "🤝", "✌️",
  "❤️", "💔", "🔥", "✨", "🎉", "💯", "⭐", "⚡",
  "😺", "🐶", "🍕", "🍔", "☕", "🍰", "⚽", "🎮",
  "✅", "❌", "❓", "💡", "📷", "🎵", "🌙", "☀️",
];

export default function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the picker or pressing Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Add an emoji"
        aria-expanded={open}
        className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] text-xl hover:cursor-pointer hover:bg-surface-2"
      >
        😊
      </button>
      {open && (
        <div className="absolute bottom-12 left-0 z-20 grid w-[280px] grid-cols-8 gap-1 rounded-[10px] border border-line bg-surface p-2 shadow-lg">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onPick(emoji)}
              className="rounded-md p-1 text-xl hover:cursor-pointer hover:bg-surface-2"
              aria-label={`Insert ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { polish, shorten, summarize } from "@/lib/text-tools";

// The ✨ next to the message box: Sparky's free writing helpers. They change what you've typed
// (nothing is sent), run in your browser, and can always be undone.
export default function WritingHelper({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [before, setBefore] = useState<string | null>(null); // what was there before the last change (for Undo)
  const boxRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function apply(tool: (t: string) => string) {
    const result = tool(text);
    setOpen(false);
    if (result === text) return;
    setBefore(text);
    onChange(result);
  }

  const sentences = text.match(/[.!?](\s|$)/g)?.length ?? 0;
  const item = "flex w-full items-start gap-3 px-4 py-2 text-left hover:cursor-pointer hover:bg-surface-2 disabled:cursor-default disabled:opacity-40";

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={!text.trim() && before === null}
        aria-label="Improve my message"
        aria-expanded={open}
        title="Improve my message"
        className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] text-xl hover:cursor-pointer hover:bg-surface-2 disabled:cursor-default disabled:opacity-40"
      >
        ✨
      </button>
      {open && (
        <div className="absolute bottom-12 left-0 z-20 w-72 rounded-[12px] border border-line bg-surface py-2 text-ink shadow-xl">
          <p className="px-4 pb-2 text-xs text-muted">Sparky&apos;s writing helpers. They only change your draft.</p>
          <button type="button" className={item} disabled={!text.trim()} onClick={() => apply(polish)}>
            <span aria-hidden="true">✨</span>
            <span>
              <span className="block font-medium">Polish</span>
              <span className="block text-xs text-muted">Capitals, spelling like &quot;dont&quot;, slang like &quot;u&quot;, punctuation</span>
            </span>
          </button>
          <button type="button" className={item} disabled={!text.trim()} onClick={() => apply(shorten)}>
            <span aria-hidden="true">✂️</span>
            <span>
              <span className="block font-medium">Shorten</span>
              <span className="block text-xs text-muted">Polish, and cut filler like &quot;just&quot;, &quot;really&quot;, &quot;in order to&quot;</span>
            </span>
          </button>
          <button type="button" className={item} disabled={sentences < 3} onClick={() => apply(summarize)}>
            <span aria-hidden="true">📝</span>
            <span>
              <span className="block font-medium">Summarize</span>
              <span className="block text-xs text-muted">
                {sentences < 3 ? "For longer messages (3+ sentences)" : "Keep only the most important sentences"}
              </span>
            </span>
          </button>
          {before !== null && (
            <button
              type="button"
              className={`${item} border-t border-line`}
              onClick={() => {
                onChange(before);
                setBefore(null);
                setOpen(false);
              }}
            >
              <span aria-hidden="true">↶</span>
              <span className="block font-medium">Undo last change</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";

// A button that opens a floating panel, closing on outside click or Escape.
// `button` is what's always shown; `children` gets a close() function to call after picking something.
export default function Dropdown({
  button,
  label,
  children,
  panelClass = "",
}: {
  button: React.ReactNode;
  label: string;
  children: (close: () => void) => React.ReactNode;
  panelClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        className="relative flex items-center rounded-full hover:cursor-pointer"
      >
        {button}
      </button>
      {open && (
        <div
          className={`absolute top-12 right-0 z-30 w-[min(22rem,calc(100vw-1.5rem))] rounded-[12px] border border-line bg-surface text-ink shadow-xl ${panelClass}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

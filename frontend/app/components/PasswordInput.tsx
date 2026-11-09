"use client";
import { useState, type InputHTMLAttributes } from "react";

// A password box with a "show / hide" button. Takes the same props as a normal <input>.
export default function PasswordInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative flex">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`w-full rounded-[5px] border border-line bg-field py-2 pr-16 pl-2 text-ink ${className}`}
      />
      <button
        type="button" // not "submit": clicking it must not send the form
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 px-3 text-sm font-semibold text-muted hover:cursor-pointer hover:text-ink"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

import type { Presence } from "@/lib/api";

// The little coloured dot on an avatar: green = online, amber = away, grey = offline
const COLORS: Record<Presence, string> = {
  online: "bg-green-500",
  away: "bg-amber-400",
  offline: "bg-zinc-400",
};

export default function PresenceDot({ status, className = "" }: { status: Presence | undefined; className?: string }) {
  if (!status) return null;
  return (
    <span
      className={`absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-surface ${COLORS[status]} ${className}`}
      aria-label={status}
      role="img"
    />
  );
}

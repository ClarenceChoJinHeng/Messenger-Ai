"use client";
import { useQuery } from "@tanstack/react-query";
import { apiBlob, nameOf, type Presence, type User } from "@/lib/api";
import PresenceDot from "./PresenceDot";
import { useObjectUrl } from "@/lib/use-object-url";

// A round avatar: the profile photo if there is one, otherwise the first letter of the name
// (Sparky gets ⚡). Optionally shows the online/away/offline dot.
export default function UserAvatar({
  user,
  size = "h-10 w-10",
  textSize = "",
  status,
}: {
  user: Pick<User, "id" | "username" | "displayName" | "isBot" | "avatarKey">;
  size?: string;
  textSize?: string;
  status?: Presence;
}) {
  // Photos are private (they need the login token), so fetch the bytes and show a local copy.
  // The avatarKey is part of the cache key: a new photo = a new key = fetched again.
  const photo = useQuery({
    queryKey: ["avatar", user.id, user.avatarKey],
    queryFn: () => apiBlob(`/users/${user.id}/avatar?k=${user.avatarKey}`),
    enabled: !!user.avatarKey,
    staleTime: Infinity,
  });
  const url = useObjectUrl(photo.data);

  return (
    <span
      className={`relative flex ${size} shrink-0 items-center justify-center rounded-full font-semibold ${textSize} ${
        user.isBot ? "bg-blue-500 text-white" : "bg-accent text-accent-ink"
      }`}
      aria-hidden="true"
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full rounded-full object-cover" />
      ) : user.isBot ? (
        "⚡"
      ) : (
        nameOf(user).charAt(0).toUpperCase()
      )}
      <PresenceDot status={status} />
    </span>
  );
}

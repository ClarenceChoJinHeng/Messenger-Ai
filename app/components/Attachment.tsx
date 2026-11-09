"use client";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiBlob, type Message } from "@/lib/api";

// Shows a photo or video from a message. Files are private, so a plain <img src> can't load them
// (it can't send the login token). Instead we fetch the bytes with the token, then give the
// browser a temporary local URL for them.
export default function Attachment({ message }: { message: Message }) {
  const isVideo = message.attachment!.mime.startsWith("video");

  const file = useQuery({
    queryKey: ["attachment", message.id],
    queryFn: () => apiBlob(`/messages/attachment/${message.id}`),
    staleTime: Infinity, // a sent file never changes
  });

  // A "blob:" URL pointing at the downloaded bytes, freed again when no longer shown
  const url = useMemo(() => (file.data ? URL.createObjectURL(file.data) : null), [file.data]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  if (file.isError) return <p className="text-sm opacity-70">Couldn&apos;t load this {isVideo ? "video" : "photo"}.</p>;
  if (!url) {
    return <div className="flex h-40 w-56 items-center justify-center rounded-lg bg-black/10 text-sm opacity-70">Loading…</div>;
  }

  return isVideo ? (
    <video src={url} controls preload="metadata" className="max-h-72 max-w-full rounded-lg" />
  ) : (
    <a href={url} target="_blank" rel="noreferrer" aria-label="Open photo full size">
      <img src={url} alt="Photo sent in chat" className="max-h-72 max-w-full rounded-lg" />
    </a>
  );
}

"use client";
import { useEffect, useState } from "react";

// Turns downloaded bytes (a Blob/File) into a temporary "blob:" URL that <img>, <audio> and <video>
// can use, and frees it when it's no longer needed.
// The URL is made INSIDE the effect, so the cleanup always frees the same URL it made. (Making it
// outside broke playback in development, where React runs effects twice: the cleanup freed the URL
// while the player was still using it.)
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      const clear = () => setUrl(null);
      clear();
      return;
    }
    const made = URL.createObjectURL(blob);
    const apply = () => setUrl(made);
    apply();
    return () => URL.revokeObjectURL(made);
  }, [blob]);

  return url;
}

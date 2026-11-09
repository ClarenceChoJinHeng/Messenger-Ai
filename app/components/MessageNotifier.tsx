"use client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Conversation } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { activeChat } from "@/lib/active-chat";

// Keeps the unread count in the browser tab title: "(3) Messenger AI".
// (The sound and desktop notifications for new messages live in lib/realtime.tsx.)
export default function MessageNotifier() {
  const { user } = useAuth();
  const { connected } = useRealtime();

  const conversations = useQuery({
    queryKey: ["conversations"], // shared with the chat page, so it's fetched once
    queryFn: () => api<Conversation[]>("/messages/conversations"),
    enabled: !!user,
    // Live updates refresh this instantly; the timer is only a backup if the connection drops
    refetchInterval: connected ? 60_000 : 5_000,
  });

  useEffect(() => {
    if (!user || !conversations.data) {
      document.title = "Messenger AI";
      return;
    }
    const unread = conversations.data.reduce((sum, c) => sum + (activeChat.id === c.user.id ? 0 : c.unreadCount), 0);
    document.title = unread > 0 ? `(${unread}) Messenger AI` : "Messenger AI";
  }, [conversations.data, user]);

  return null;
}

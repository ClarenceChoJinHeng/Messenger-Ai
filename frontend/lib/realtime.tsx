"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { API_URL, getToken, nameOf, previewOf, SESSION_EXPIRED_EVENT, setToken, type Message, type PresenceInfo, type User } from "./api";
import { useAuth } from "./auth";
import { activeChat } from "./active-chat";

interface RealtimeState {
  connected: boolean; // false = live connection down (the app falls back to checking every few seconds)
  presence: Record<number, PresenceInfo>; // latest live status per user id
  typing: Record<number, boolean>; // who is typing to me right now
  aiStream: Record<number, string | null>; // Sparky's reply being written ("" = thinking, null = not replying)
  sendTyping: (to: number, typing: boolean) => void;
}

const RealtimeContext = createContext<RealtimeState | null>(null);
const IDLE_AFTER_MS = 5 * 60 * 1000; // "auto" status turns to away after 5 minutes without activity

// A short two-note "pop", made in code so no sound file is needed
function playPop() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.09 + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.09);
      osc.stop(ctx.currentTime + i * 0.09 + 0.2);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    // the browser blocked sound (no click on the page yet): stay silent
  }
}

// Keeps one live WebSocket connection open while you're logged in, and turns what arrives
// into fresh data on screen: new messages, "Seen", typing dots, statuses and the bell.
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const typingTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<Record<number, PresenceInfo>>({});
  const [typing, setTyping] = useState<Record<number, boolean>>({});
  const [aiStream, setAiStream] = useState<Record<number, string | null>>({});
  const myId = user?.id;

  // WhatsApp-style alert: nothing if you're looking at that chat, otherwise a sound,
  // plus a desktop notification when the window isn't in front
  const alertNewMessage = useCallback(
    (m: Message) => {
      const looking = document.hasFocus() && activeChat.id === m.senderId;
      if (looking) return;
      playPop();
      if (document.hasFocus() || !("Notification" in window) || Notification.permission !== "granted") return;
      const sender = queryClient.getQueryData<User[]>(["contacts"])?.find((u) => u.id === m.senderId);
      const n = new Notification(sender ? nameOf(sender) : "New message", { body: previewOf(m), tag: `chat-${m.senderId}` });
      n.onclick = () => {
        window.focus();
        router.push(`/chat?with=${m.senderId}`);
        n.close();
      };
    },
    [queryClient, router],
  );

  useEffect(() => {
    const token = getToken();
    if (!myId || !token) return;

    const socket = io(API_URL, { auth: { token }, transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => {
      // The server refused our token: same as any other expired session
      if (err.message === "session-expired") {
        socket.disconnect();
        setToken(null);
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
    });

    socket.on("message", (m: Message) => {
      const partnerId = m.senderId === myId ? m.receiverId : m.senderId;
      queryClient.invalidateQueries({ queryKey: ["thread", partnerId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (m.senderId !== myId) {
        setTyping((t) => ({ ...t, [m.senderId]: false })); // they sent it, so they stopped typing
        queryClient.invalidateQueries({ queryKey: ["contacts"] }); // a new person may have messaged
        if (!m.isRequest) alertNewMessage(m); // message requests are silent: only the Requests counter changes
      }
    });
    // Someone reacted to my message: a sound, and a desktop notification when I'm not looking at that chat
    socket.on("reaction", (r: { from: number; name: string; emoji: string; preview: string }) => {
      if (document.hasFocus() && activeChat.id === r.from) return; // I can see it happen in the open chat
      playPop();
      if (document.hasFocus() || !("Notification" in window) || Notification.permission !== "granted") return;
      const n = new Notification(`${r.name} reacted ${r.emoji}`, { body: `to: ${r.preview}`, tag: `reaction-${r.from}` });
      n.onclick = () => {
        window.focus();
        router.push(`/chat?with=${r.from}`);
        n.close();
      };
    });
    // A message was edited, unsent or reacted to: swap it in place in the open chat
    socket.on("message:updated", (m: Message) => {
      const partnerId = m.senderId === myId ? m.receiverId : m.senderId;
      queryClient.setQueryData<Message[]>(["thread", partnerId], (old) => old?.map((x) => (x.id === m.id ? m : x)));
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });
    // My chat list changed (someone blocked/unblocked me, changed their name or photo, a request was handled)
    socket.on("contacts", () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    });
    // Sparky writing its answer: the text so far, then "done" once the real message is saved
    socket.on("ai:stream", ({ botId, text, done }: { botId: number; text?: string; done?: boolean }) =>
      setAiStream((s) => ({ ...s, [botId]: done ? null : (text ?? "") })),
    );
    socket.on("read", ({ by }: { by: number }) => queryClient.invalidateQueries({ queryKey: ["thread", by] }));
    socket.on("notifications", () => queryClient.invalidateQueries({ queryKey: ["notifications"] }));
    socket.on("presence", (p: { userId: number } & PresenceInfo) =>
      setPresence((prev) => ({ ...prev, [p.userId]: { status: p.status, lastSeenAt: p.lastSeenAt } })),
    );
    socket.on("typing", ({ from, typing: isTyping }: { from: number; typing: boolean }) => {
      setTyping((t) => ({ ...t, [from]: isTyping }));
      // If the "stopped typing" signal gets lost, hide the dots after 6 seconds anyway
      clearTimeout(typingTimers.current.get(from));
      if (isTyping) typingTimers.current.set(from, setTimeout(() => setTyping((t) => ({ ...t, [from]: false })), 6000));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [myId, queryClient, alertNewMessage, router]);

  // "Auto" status: tell the server whether this tab is being used (active) or not (idle)
  useEffect(() => {
    if (!connected) return;
    let state: "active" | "idle" = "active";
    let lastActivity = Date.now();
    const report = (next: "active" | "idle") => {
      if (next === state) return;
      state = next;
      socketRef.current?.emit("activity", { state });
    };
    const onActivity = () => {
      lastActivity = Date.now();
      if (!document.hidden) report("active");
    };
    const onVisibility = () => (document.hidden ? report("idle") : onActivity());
    const check = setInterval(() => {
      if (document.hidden || Date.now() - lastActivity > IDLE_AFTER_MS) report("idle");
    }, 30_000);

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(check);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [connected]);

  const sendTyping = useCallback((to: number, isTyping: boolean) => {
    socketRef.current?.emit("typing", { to, typing: isTyping });
  }, []);

  return (
    <RealtimeContext.Provider value={{ connected, presence, typing, aiStream, sendTyping }}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used inside <RealtimeProvider>");
  return ctx;
}

// The freshest status we know for someone: live updates first, then what the list said
export function usePresence(user: Pick<User, "id" | "presence"> | null | undefined): PresenceInfo | undefined {
  const { presence } = useRealtime();
  if (!user) return undefined;
  return presence[user.id] ?? user.presence;
}

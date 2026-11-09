// One place that talks to the NestJS backend.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TOKEN_KEY = "messenger-ai-token";

// The event we fire when the backend says our login is no longer valid (lib/auth.tsx listens)
export const SESSION_EXPIRED_EVENT = "messenger-ai:session-expired";

// localStorage can throw (private windows, blocked storage), so every access is wrapped
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // nothing to do: the user just stays logged in for this tab only
  }
}

// The error we throw for any non-2xx answer. `messages` is always a list, ready for toasts.
export class ApiError extends Error {
  constructor(
    public status: number,
    public messages: string[],
  ) {
    super(messages.join(" "));
  }
}

// The shared part of api() and apiBlob(): send the request, handle errors
async function request(path: string, options: { method?: string; body?: unknown }): Promise<Response> {
  const token = getToken();
  const isForm = options.body instanceof FormData; // file uploads: the browser sets the headers itself
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined && !isForm && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: isForm ? (options.body as FormData) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // fetch only throws when nobody answered at all
    throw new ApiError(0, ["Cannot reach the server, please try again later."]);
  }

  if (!res.ok) {
    // We were logged in, but the backend no longer accepts our token → log out everywhere in the app
    if (res.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    // Nest sends { message: "text" } or { message: ["text", "text"] }
    const data = await res.json().catch(() => null);
    const message = data?.message ?? (res.status === 429 ? "Too many tries. Please wait a minute." : "Something went wrong.");
    throw new ApiError(res.status, Array.isArray(message) ? message : [message]);
  }
  return res;
}

// fetch + JSON + login token + errors, in one call: api<User>("/users/me")
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await request(path, options);
  return (await res.json().catch(() => null)) as T;
}

// For files (photos/videos): same as api(), but gives back the raw bytes
export async function apiBlob(path: string): Promise<Blob> {
  return (await request(path, {})).blob();
}

// Shapes of what the backend sends back
export type Theme = "grey" | "black";
export type Presence = "online" | "away" | "offline";
export type StatusMode = "auto" | "online" | "away" | "offline";
export interface PresenceInfo {
  status: Presence;
  lastSeenAt: string | null;
}

export interface AppNotification {
  id: number;
  type: "message" | "contact" | "security";
  actorId: number | null;
  title: string;
  body: string;
  link: string | null;
  count: number;
  readAt: string | null;
  updatedAt: string;
}

export interface User {
  id: number;
  username: string;
  email?: string; // only on your own profile
  theme?: Theme; // only on your own profile
  displayName: string | null;
  bio: string | null;
  isBot: boolean;
  isContact?: boolean; // in my chat list: false = they messaged me but I haven't added them
  presence?: PresenceInfo; // in my chat list: online / away / offline + last seen
  statusMode?: StatusMode; // only on your own profile
  createdAt: string;
}

// "online", "away", "last seen today at 14:05", ...
export function presenceText(p: PresenceInfo | undefined): string {
  if (!p) return "";
  if (p.status !== "offline") return p.status;
  if (!p.lastSeenAt) return "offline";
  const seen = new Date(p.lastSeenAt);
  const time = seen.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(seen).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return `last seen today at ${time}`;
  if (days === 1) return `last seen yesterday at ${time}`;
  return `last seen ${seen.toLocaleDateString([], { day: "numeric", month: "short" })}`;
}

export interface Message {
  id: number;
  content: string;
  senderId: number;
  receiverId: number;
  readAt: string | null;
  createdAt: string;
  attachment: { mime: string; size: number } | null;
}

export interface Conversation {
  user: User;
  lastMessage: Message;
  unreadCount: number;
}

// "Sparky (AI)" if there's a display name, otherwise the username
export const nameOf = (u: Pick<User, "displayName" | "username">) => u.displayName || u.username;

// What to show in a chat list preview for a message
export const previewOf = (m: Message) =>
  m.content || (m.attachment ? (m.attachment.mime.startsWith("video") ? "🎬 Video" : "📷 Photo") : "");

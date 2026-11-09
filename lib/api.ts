// One place that talks to the NestJS backend.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TOKEN_KEY = "messenger-ai-token";

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

// fetch + JSON + login token + errors, in one call: api<User>("/users/me")
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // fetch only throws when nobody answered at all
    throw new ApiError(0, ["Cannot reach the server, please try again later."]);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Nest sends { message: "text" } or { message: ["text", "text"] }
    const message = data?.message ?? "Something went wrong.";
    throw new ApiError(res.status, Array.isArray(message) ? message : [message]);
  }
  return data as T;
}

// Shapes of what the backend sends back
export interface User {
  id: number;
  username: string;
  email?: string; // only on your own profile
  displayName: string | null;
  bio: string | null;
  isBot: boolean;
  createdAt: string;
}

export interface Message {
  id: number;
  content: string;
  senderId: number;
  receiverId: number;
  createdAt: string;
}

export interface Conversation {
  user: User;
  lastMessage: Message;
}

// "Sparky (AI)" if there's a display name, otherwise the username
export const nameOf = (u: Pick<User, "displayName" | "username">) => u.displayName || u.username;

"use client";
import { useState, type SubmitEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import RequireAuth from "@/app/components/RequireAuth";
import PasswordInput from "@/app/components/PasswordInput";
import { api, ApiError, nameOf, type Theme, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function ProfilePage() {
  return <RequireAuth>{(me) => <Profile me={me} />}</RequireAuth>;
}

// Shared look for the cards and inputs on this page
const card = "flex flex-col gap-4 rounded-[10px] bg-surface p-5 shadow-[0px_15px_35px_rgba(0,0,0,0.12)]";
const input = "rounded-[5px] border border-line bg-field px-2 py-2 text-ink";
const button = "rounded-[8px] bg-accent px-3 py-2 font-[600] text-accent-ink hover:cursor-pointer disabled:opacity-60";
const showErrors = (error: Error) =>
  (error instanceof ApiError ? error.messages : ["Something went wrong."]).forEach((m) => toast.error(m));

function Profile({ me }: { me: User }) {
  const router = useRouter();
  const joined = new Date(me.createdAt).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });

  // Back to wherever you came from (or the chats, if you opened this page directly)
  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/chat");
  }

  return (
    <div className="flex flex-1 justify-center bg-page px-3 py-6">
      <div className="flex w-full max-w-[480px] flex-col gap-6 text-ink">
        <button
          type="button"
          onClick={goBack}
          className="flex w-fit items-center gap-2 rounded-[8px] px-2 py-1 font-semibold hover:cursor-pointer hover:bg-surface-2"
        >
          <span aria-hidden="true" className="text-xl">←</span> Back
        </button>

        {/* Profile card */}
        <div className="flex items-center gap-4 rounded-[10px] bg-surface p-5 shadow-[0px_15px_35px_rgba(0,0,0,0.12)]">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-semibold text-accent-ink">
            {nameOf(me).charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{nameOf(me)}</h1>
            <p className="truncate text-muted">@{me.username}</p>
            <p className="text-sm text-muted">Joined {joined}</p>
          </div>
        </div>

        <ProfileForm me={me} />
        <ThemePicker me={me} />
        <EmailForm me={me} />
        <PasswordForm />
      </div>
    </div>
  );
}

function ProfileForm({ me }: { me: User }) {
  const { setUser } = useAuth();
  const [username, setUsername] = useState(me.username);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(me.displayName ?? "");
  const [bio, setBio] = useState(me.bio ?? "");

  const save = useMutation({
    mutationFn: (body: { username?: string; displayName: string; bio: string }) =>
      api<User>("/users/me", { method: "PATCH", body }),
    onSuccess: (updated) => {
      setUser(updated); // the navbar shows the new name straight away
      toast.success("Profile saved!");
    },
    onError: showErrors,
  });

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    // Same username rules as the sign-up form, checked before we bother the server
    const newName = username.trim();
    setUsernameError(null);
    if (newName.length < 3) return setUsernameError("Username cannot be less then 3 characters!");
    if (newName.length > 20) return setUsernameError("Username cannot be more then 20 characters!");
    if (/\s/.test(newName)) return setUsernameError("Username cannot have space!");

    // Only send the username if it actually changed
    save.mutate({ ...(newName !== me.username && { username: newName }), displayName, bio });
  }

  return (
    <form onSubmit={handleSubmit} className={card}>
      <h2 className="text-xl font-semibold">Edit profile</h2>

      <div className="flex flex-col">
        <label htmlFor="username">Username</label>
        <input id="username" className={input} value={username} maxLength={20} autoComplete="username" onChange={(e) => setUsername(e.target.value)} />
        {usernameError ? (
          <p className="text-[13px] font-[600] text-red-500">{usernameError}</p>
        ) : (
          <p className="text-xs text-muted">3–20 characters, no spaces. You log in with this too.</p>
        )}
      </div>

      <div className="flex flex-col">
        <label htmlFor="displayName">Display name</label>
        <input id="displayName" className={input} value={displayName} maxLength={40} placeholder={me.username} onChange={(e) => setDisplayName(e.target.value)} />
        <p className="text-xs text-muted">Shown in chats instead of your username.</p>
      </div>

      <div className="flex flex-col">
        <label htmlFor="bio">Bio</label>
        <textarea id="bio" rows={3} className={`resize-none ${input}`} value={bio} maxLength={280} placeholder="A line or two about you" onChange={(e) => setBio(e.target.value)} />
        <p className="text-right text-xs text-muted">{bio.length}/280</p>
      </div>

      <button type="submit" disabled={save.isPending} className={button}>
        {save.isPending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}

function ThemePicker({ me }: { me: User }) {
  const { setUser } = useAuth();
  const current = me.theme ?? "grey";

  const save = useMutation({
    mutationFn: (theme: Theme) => api<User>("/users/me", { method: "PATCH", body: { theme } }),
    onSuccess: (updated) => setUser(updated), // the whole app switches colours right away
    onError: showErrors,
  });

  const options: { value: Theme; label: string; swatch: string }[] = [
    { value: "grey", label: "White", swatch: "bg-white border-zinc-300" },
    { value: "black", label: "Dark", swatch: "bg-black border-zinc-600" },
  ];

  return (
    <section className={card} aria-labelledby="theme-title">
      <h2 id="theme-title" className="text-xl font-semibold">Theme</h2>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Theme">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={current === o.value}
            disabled={save.isPending}
            onClick={() => save.mutate(o.value)}
            className={`flex items-center gap-3 rounded-[10px] border-2 p-3 text-left font-semibold hover:cursor-pointer ${
              current === o.value ? "border-blue-500" : "border-line"
            }`}
          >
            <span className={`h-8 w-8 shrink-0 rounded-full border ${o.swatch}`} aria-hidden="true" />
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function EmailForm({ me }: { me: User }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");

  const request = useMutation({
    mutationFn: (body: { newEmail: string; password: string }) =>
      api<{ message: string }>("/account/email", { method: "POST", body }),
    onSuccess: ({ message }) => {
      toast.success(`${message} Click the link in it to finish.`);
      setNewEmail("");
      setPassword("");
    },
    onError: showErrors,
  });

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newEmail.trim() || !password) return void toast.error("Fill in the new email and your current password.");
    request.mutate({ newEmail: newEmail.trim(), password });
  }

  return (
    <form onSubmit={handleSubmit} className={card}>
      <div>
        <h2 className="text-xl font-semibold">Change email</h2>
        <p className="text-sm text-muted">
          Now: {me.email}. We&apos;ll email a confirmation link to the new address.
        </p>
      </div>
      <div className="flex flex-col">
        <label htmlFor="newEmail">New email</label>
        <input id="newEmail" type="email" autoComplete="email" className={input} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
      </div>
      <div className="flex flex-col">
        <label htmlFor="emailPassword">Current password</label>
        <PasswordInput id="emailPassword" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button type="submit" disabled={request.isPending} className={button}>
        {request.isPending ? "Sending..." : "Send confirmation link"}
      </button>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);

  const request = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api<{ message: string }>("/account/password", { method: "POST", body }),
    onSuccess: ({ message }) => {
      toast.success(`${message} Your password changes when you click the link.`);
      setCurrent("");
      setNext("");
      setRepeat("");
    },
    onError: showErrors,
  });

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!current) return setError("Please enter your current password.");
    if (next.length < 8) return setError("Password cannot be less than 8 characters!");
    if (/\s/.test(next)) return setError("Password cannot have space!");
    if (next !== repeat) return setError("The two new passwords don't match.");
    request.mutate({ currentPassword: current, newPassword: next });
  }

  return (
    <form onSubmit={handleSubmit} className={card}>
      <div>
        <h2 className="text-xl font-semibold">Change password</h2>
        <p className="text-sm text-muted">We&apos;ll email you a link to confirm. After that, you&apos;re logged out everywhere.</p>
      </div>
      <div className="flex flex-col">
        <label htmlFor="currentPassword">Current password</label>
        <PasswordInput id="currentPassword" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="flex flex-col">
        <label htmlFor="newPassword">New password</label>
        <PasswordInput id="newPassword" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div className="flex flex-col">
        <label htmlFor="repeatPassword">New password again</label>
        <PasswordInput id="repeatPassword" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        {error && <p className="text-[13px] font-[600] text-red-500">{error}</p>}
      </div>
      <button type="submit" disabled={request.isPending} className={button}>
        {request.isPending ? "Sending..." : "Send confirmation link"}
      </button>
    </form>
  );
}

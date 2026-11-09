"use client";
import { useState, type SubmitEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import RequireAuth from "@/app/components/RequireAuth";
import { api, ApiError, nameOf, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function ProfilePage() {
  return <RequireAuth>{(me) => <Profile me={me} />}</RequireAuth>;
}

function Profile({ me }: { me: User }) {
  const { setUser } = useAuth();
  const [displayName, setDisplayName] = useState(me.displayName ?? "");
  const [bio, setBio] = useState(me.bio ?? "");

  const save = useMutation({
    mutationFn: (body: { displayName: string; bio: string }) => api<User>("/users/me", { method: "PATCH", body }),
    onSuccess: (updated) => {
      setUser(updated); // the navbar shows the new name straight away
      toast.success("Profile saved!");
    },
    onError: (error) => {
      (error instanceof ApiError ? error.messages : ["Could not save."]).forEach((m) => toast.error(m));
    },
  });

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    save.mutate({ displayName, bio });
  }

  const joined = new Date(me.createdAt).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex flex-1 justify-center px-3 py-10">
      <div className="w-full max-w-[480px] text-black">
        {/* Profile card */}
        <div className="mb-6 flex items-center gap-4 rounded-[10px] p-5 shadow-[0px_15px_35px_rgba(0,0,0,0.12)]">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-black text-2xl font-semibold text-white">
            {nameOf(me).charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{nameOf(me)}</h1>
            <p className="truncate text-zinc-500">@{me.username}</p>
            <p className="text-sm text-zinc-500">Joined {joined}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-[10px] p-5 shadow-[0px_15px_35px_rgba(0,0,0,0.12)]">
          <h2 className="text-xl font-semibold">Edit profile</h2>

          <div className="flex flex-col">
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              className="rounded-[5px] border border-black px-2 py-2"
              value={displayName}
              maxLength={40}
              placeholder={me.username}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <p className="text-xs text-zinc-500">Shown in chats instead of your username. Leave empty to use @{me.username}.</p>
          </div>

          <div className="flex flex-col">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              rows={3}
              className="resize-none rounded-[5px] border border-black px-2 py-2"
              value={bio}
              maxLength={280}
              placeholder="A line or two about you"
              onChange={(e) => setBio(e.target.value)}
            />
            <p className="text-right text-xs text-zinc-500">{bio.length}/280</p>
          </div>

          <div className="flex flex-col">
            <span>Email</span>
            <p className="text-zinc-600">{me.email}</p>
          </div>

          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-[8px] bg-black px-3 py-2 font-[600] text-white hover:cursor-pointer disabled:opacity-60"
          >
            {save.isPending ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

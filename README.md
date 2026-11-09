# Messenger AI

A full-stack messaging app where users chat one-on-one with each other and with **Sparky**, a built-in AI assistant powered by Claude.

This repo is the **frontend** (Next.js). The API lives in a separate **backend** repo (NestJS + MySQL).

## Features

- **Accounts**: sign up and log in (with a show/hide password button). Passwords are hashed with bcrypt, and sessions use JWT tokens.
- **Profiles**: username, display name, bio, and a **Grey** (light) or **Black** (dark) theme.
- **Email-confirmed changes**: changing your email or password sends a confirmation link. A password change logs you out everywhere.
- **Messaging**: one-on-one chats with **emojis**, **photos and videos**, unread badges, "Seen" receipts, and live updates through polling.
- **Real time** (Socket.IO): messages, "Seen" receipts, **typing…** indicators and status changes arrive instantly.
- **Status**: online / away / offline dots and "last seen". Set it yourself or leave it on Automatic (away after 5 minutes idle).
- **Camera**: take a photo or record a video right in the chat.
- **Notifications, WhatsApp-style**: a sound, green unread badges, desktop notifications when the window isn't in front, and a 🔔 tray.
- **Collapsible chat list** and a message box that grows as you type.
- **Reply, edit, unsend** and **reactions** (👍 ❤️ 😂 …) on any message.
- **Voice notes** and **profile photos** (both encrypted like everything else).
- **Message requests**: strangers land in a Requests tab (accept, delete or block). **Block** stops messages, typing and status both ways.
- **Encrypted storage**: messages and files are encrypted in the database and on disk (AES-256-GCM).
- **AI assistant**: Sparky shows up as a contact. With an Anthropic API key it answers with Claude. Without one it runs a simple built-in mode (greetings, jokes, dice, a coin flip and a calculator).
- Validation on both sides: the form checks before sending, and the API checks again.
- Responsive: on phones the chat list and the conversation switch places.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend (this repo) | Next.js 16 (App Router), React 19, TypeScript, TanStack Query, Tailwind CSS 4, react-toastify |
| Backend | NestJS 12, Prisma 7 (MariaDB driver adapter), MySQL, class-validator, JWT, bcrypt, Anthropic SDK |

## How it fits together

```
Browser (Next.js :3000) ──fetch + JWT──▶ NestJS API (:4000) ──Prisma──▶ MySQL
                                              │
                                              └──▶ Claude API (Sparky's replies)
```

- `lib/api.ts`: a single `api()` helper that adds the token, parses JSON, and turns errors into toast-ready messages.
- `lib/auth.tsx`: an auth context that restores the session from a saved token on page load.
- `app/chat`: the contact list and a conversation view. TanStack Query refreshes messages every few seconds.
- `app/profile`: view and edit your profile.

## Run it locally

1. Start the backend first (see its README). It runs on `http://localhost:4000`.
2. Then run this repo:

```bash
npm install
npm run dev
```

Open http://localhost:3000, register two accounts (use a private window for the second one), and message each other or Sparky.

If the API runs somewhere else, set `NEXT_PUBLIC_API_URL` in `.env.local`.

## Notes

- The login token is stored in `localStorage` to keep things simple. A production app would use an httpOnly cookie.
- Messages arrive by polling, not WebSockets. That's enough for a small app, and it's the first thing I'd upgrade.

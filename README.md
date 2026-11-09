# Messenger AI

A full-stack messaging app where users chat one-on-one with each other and with **Sparky**, a built-in AI assistant powered by Claude.

This repo is the **frontend** (Next.js). The API lives in a separate **backend** repo (NestJS + MySQL).

## Features

- **Accounts**: sign up and log in. Passwords are hashed with bcrypt, and sessions use JWT tokens.
- **Profiles**: set a display name and a bio.
- **Messaging**: one-on-one chats between users, a chat list sorted by the latest message, and live updates through polling.
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

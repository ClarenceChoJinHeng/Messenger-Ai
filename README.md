# Messenger AI

A full-stack messenger where people chat one-on-one and with **Sparky**, a built-in assistant.

| Folder | What | Stack |
|---|---|---|
| [`frontend/`](frontend) | The website | Next.js 16, React 19, TypeScript, TanStack Query, Tailwind CSS 4, Socket.IO client |
| [`backend/`](backend) | The API | NestJS 12, Prisma 7, MySQL, Socket.IO, JWT, AES-256-GCM encryption |

## Highlights

- **Real time** over WebSockets: messages, "Seen" receipts, typing indicators, online/away/offline status.
- **Rich messages**: photos, videos, voice notes (recorded as WAV, with a waveform player), emojis, replies, edits, unsend, reactions.
- **Privacy & security**: messages and files encrypted at rest (AES-256-GCM), bcrypt passwords, JWT sessions that end on
  password change, message requests from strangers, blocking, rate limits, file types checked from their bytes.
- **Accounts**: profiles with photos, White/Dark themes, email-confirmed email/password changes, notification tray.
- **Sparky**: free built-in mode (help, jokes, maths…) plus a free writing helper (polish / shorten / summarize your draft).
  With an Anthropic API key it becomes a real AI: streamed replies, sees photos, summarizes and translates chats.

## Run it locally

1. Backend: see [`backend/README.md`](backend/README.md) (needs MySQL; `npm run start:dev` on port 4000)
2. Frontend: see [`frontend/README.md`](frontend/README.md) (`npm run dev` on port 3000)

## Put it online (free)

Aiven (MySQL) + Render (API) + Vercel (website): step by step in **[DEPLOY.md](DEPLOY.md)**.

# Spec 003 · Portfolio MVP: login, profiles, messaging, AI assistant

**Branch:** `task/003-portfolio-mvp` (both repos)
**Story:** US-03 onward, built in one go for the portfolio · **Sprint:** 01
**Status:** done, waiting for Clarence's review (not merged)
**Date:** 2026-11-09
**Built by:** Claude, at Clarence's request. Clarence keeps learning on their own branches
(`task/002-prisma-mysql` backend, `task/001-project-setup` frontend).

## Goal
A simple but complete app to show on GitHub: accounts, a profile page, one-on-one messaging,
and a simple AI contact.

## What changes
Backend
- Prisma schema: `User` gets `displayName`, `bio`, `isBot`. New `Message` model (sender, receiver)
- Register: bcrypt hashing, 409 for a taken username/email, password ≠ username
- Login with JWT (`@nestjs/jwt`), `AuthGuard`, `@CurrentUser()` decorator
- `/users` (me, update me, list, by username), `/messages` (conversations, thread, send)
- `ai/`: Sparky is a bot user. Claude (`claude-opus-5-5`, low effort, server-side fallback) when
  `ANTHROPIC_API_KEY` is set, a simple command bot otherwise (no `eval`)
- `PrismaModule` (global), `dotenv` loaded on line 1 of main.ts, `.env.example`, README, tests
Frontend
- `lib/api.ts` (fetch helper + types), `lib/auth.tsx` (auth context)
- Pages: landing, login, register (redirects to login), `/chat`, `/profile`. Navbar knows if you're logged in
- README for the portfolio

## Out of scope
- WebSockets (polling every 3–5 s), httpOnly cookies, unread counts, group chats, deploying

## Done when
- [x] Backend: `tsc` clean, unit tests pass, every endpoint checked with curl
- [x] Frontend: `tsc` + lint clean, `next build` passes
- [ ] Clarence has clicked through it in the browser
- [ ] Pushed to GitHub (only when Clarence says so)

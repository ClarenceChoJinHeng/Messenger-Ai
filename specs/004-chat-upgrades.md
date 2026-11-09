# Spec 004 · Chat upgrades: security, media, notifications, themes

**Branch:** `task/004-chat-upgrades` (both repos, from `task/003-portfolio-mvp`)
**Status:** built and tested, waiting for Clarence's review (not committed yet)
**Date:** 2026-11-09 · **Built by:** Claude, at Clarence's request

## What Clarence asked for → what was built
1. See the password when typing → show/hide button on login, sign-up and profile
2. "Session expired" when messaging → the JWT secret was regenerated on every backend restart.
   Secrets now come from .env or a saved development key (`secrets/dev-keys.json`, git-ignored).
   The frontend also logs out cleanly with a message on any 401
3. Notify users of new messages → pop-up toast (click opens the chat), unread badges, a tab title count,
   optional desktop notifications, "Sent/Seen" receipts
4. Emojis → emoji picker in the chat box (inserts at the cursor); emojis work everywhere
5. Encryption + security → AES-256-GCM for message text and files at rest, helmet headers,
   rate limiting, tokenVersion (a password change logs out every device), file type sniffing
6. No homepage link inside the chat → the logo is hidden on /chat
7. Theme black or grey → Grey (light) / Black (dark), saved on the account
8. Photo and video upload → 📎 button, preview before sending, 25 MB limit, private download route
9. Back button on profile → "← Back" at the top
10. Email confirmation for email/password changes → /account endpoints, one-time links (1 hour),
    printed in the terminal until SMTP is configured
11. Add users to chat (asked later) → Contact table; add by exact username; the sidebar shows Sparky,
    contacts, and anyone who messaged you (with an "Add contact" button); Remove keeps the messages.
    The old GET /users (listed every account) was removed. Test accounts deleted from the database

## Round 1 of "make it a full messenger" (asked 2026-11-09)
12. Real-time connection: Socket.IO gateway (token checked during the handshake). Messages, "Seen",
    typing, status and bell updates are pushed instantly; polling is only a slow backup
13. Message box grows with the text (up to ~6 lines)
14. "typing…" with animated dots (chat list, header, and a bubble in the chat)
15. Status: Automatic (online while active, away after 5 min idle or tab hidden) / Online / Away /
    Appear offline, set from the profile icon menu. Dots on avatars and "last seen today at 14:05"
16. Camera: take a photo or record a video (up to 60 s, front/back camera)
17. Collapsible chat list (remembered per device)
18. WhatsApp-style alerts: no pop-ups; a sound, the chat jumps to the top with a green unread badge,
    and a desktop notification only when the window isn't in front
19. Notification tray (🔔): grouped new messages, "X added you", password/email changed; mark as read

Round 2 (not started, Clarence picks): message requests + block, reply/edit/unsend, reactions,
voice notes, profile photos, group chats, search, voice/video calls, deployment.

## Out of scope
- End-to-end encryption (Sparky must be able to read messages), WebSockets, a real SMTP account

## Done when
- [x] Backend: tsc clean, 12 unit tests pass, every new route tested live with curl
- [x] Frontend: tsc + lint clean, `next build` passes, all pages answer 200 on the dev server
- [ ] Clarence has clicked through it in the browser
- [ ] Committed (when Clarence asks)

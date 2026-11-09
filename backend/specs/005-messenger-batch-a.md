# Spec 005 · Messenger Batch A: requests, block, reply/edit/unsend, reactions, voice notes, photos

**Branch:** `task/005-messenger-batch-a` (both repos, from `task/004-chat-upgrades`)
**Status:** built and tested, waiting for Clarence's review (not committed yet)
**Date:** 2026-11-09 · **Built by:** Claude, at Clarence's request (Round 2, Batch A)

## What was built
1. **Message requests**: a stranger's messages go to a Requests tab (no sound, no bell, no "Seen"
   until accepted). Accept (adds them) / Delete (hidden until they write again) / Block. Replying accepts.
2. **Block**: no messages, typing or status either way; the blocked person can't find you by username
   and sees you as offline. Profile → Blocked people → Unblock.
3. **Reply** (quoted, click to jump), **edit** (own text, within 15 minutes, marked "edited"),
   **unsend** ("This message was deleted"; the file is erased and the text removed from the bell).
4. **Reactions**: 👍 ❤️ 😂 😮 😢 🙏 🔥 🎉, one per person per message; same again removes it.
5. **Voice notes**: 🎤 when the box is empty, up to 5 minutes, played with an audio player.
6. **Profile photos**: click your avatar on the profile page; shown everywhere. Encrypted like messages.

## How
- New tables: `Block`, `DismissedRequest`, `Reaction`; `Message.replyToId/editedAt/deletedAt`;
  `User.avatarFile/avatarMime/avatarKey`
- `RelationsService` works out contacts / blocks / requests in one place
- `FileStoreService` shared by attachments and photos (type check from bytes, AES-256-GCM on disk)
- Live events: `message:updated` (edit/unsend/react), `contacts` (block, names, photos, requests)

## Also in this task: Sparky upgrades (asked 2026-11-09)
7. **Live typing replies**: Sparky answers in the background and streams its text (`ai:stream` events);
   the user's message is saved and shown at once.
8. **Sees photos**: the 3 newest photos you sent (≤5 MB) are shown to Claude. Voice/video become a note.
9. **Remembers you**: knows your name and today's date; reads up to 40 messages since the last
   "🧹 New conversation" (Sparky ⋯ menu, `POST /ai/reset`, `User.aiMemoryFrom`).
10. **In friend chats** (✨ menu, `POST /ai/assist`, 20/min): summarize the chat, suggest 3 replies
    (click to use), translate a message (🌐) into a chosen language. Only the asker sees the result.
- Model: `claude-opus-5-5`, effort `low`, server-side fallbacks on. Needs `ANTHROPIC_API_KEY` in
  backend/.env (Clarence adds it); without it Sparky stays in simple mode and /ai/assist answers 503.
- Also: "Lessons learned" rules added to both repos' CLAUDE.md.

## Done when
- [x] Backend: tsc clean, 12 unit tests pass, 28 API checks pass (requests, block, reply/edit/unsend,
      reactions, voice, photos)
- [x] Frontend: tsc + lint clean, `next build` passes, pages answer 200 on the dev server
- [ ] Clarence has clicked through it in the browser
- [ ] Committed (when Clarence asks)

## Next (Batch B / C)
Group chats, message search, voice/video calls, deployment.

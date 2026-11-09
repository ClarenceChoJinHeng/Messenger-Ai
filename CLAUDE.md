@AGENTS.md

# Messenger With AI · frontend (Next.js)

Project notes, rules and learning progress live in Obsidian:
`E:\Learning\Personal\Projects\Messenger With AI\` (start with `CLAUDE.md` and `Resume Here.md`).

- Clarence is **learning** React / Next.js here: teach, don't write their app code — EXCEPT on branches
  Clarence asked Claude to build (`task/003-portfolio-mvp` and later feature tasks). Learning happens on `task/001-project-setup`.
- Every task: `specs/NNN-name.md` → branch `task/NNN-name` from `release/prod` →
  `release/staging` → `release/prod`. Commit only when Clarence asks, and scan for secrets first.
- **No Claude attribution in commits**: never add `Co-Authored-By: Claude` (Clarence removed it from all history).
- Never read `.env*` or other secrets.
- Runs on port 3000 (`npm run dev`). The backend repo is `../backend` (port 4000).

## Publishing (GitHub + hosting)

- Public repo: https://github.com/ClarenceChoJinHeng/Messenger-Ai (account ClarenceChoJinHeng; the old
  ChoJinHeng/messenger-ai remote is NOT writable from this PC). It's a monorepo: `frontend/` + `backend/`,
  built in `E:/laragon/www/Projects/Personal/Messenger-Ai` with both histories (subtree merge).
- Work still happens in these two repos. To publish `release/prod` (only when Clarence asks to push):
  `cd ../../Messenger-Ai && git fetch ../messenger-ai-app/messenger-ai release/prod && git merge -X subtree=frontend FETCH_HEAD`
  then the same with `../messenger-ai-app/backend` and `-X subtree=backend`, then `git push`.
- Hosting: Aiven (MySQL) + Render (`render.yaml`, rootDir backend) + Vercel (root dir frontend). See DEPLOY.md there.

## Lessons learned — don't repeat these

Each one is a real mistake made in this project.

**Blob / object URLs**
- Never create an object URL in render/`useMemo` and revoke it in an effect. React runs effects twice in
  development, so the URL got revoked while still in use (voice notes showed 0:00 and wouldn't play).
  Use `useObjectUrl()` (lib/use-object-url.ts), which creates AND revokes inside the same effect.

**Audio**
- Don't record voice with MediaRecorder WebM: Chrome/Edge's own `decodeAudioData` rejects it (`EncodingError`)
  and it has no duration. Voice notes are recorded as WAV (lib/wav.ts + VoiceRecorder).
- When something fails, show the real error name in the UI (that's how EncodingError was found).

**Styling (Tailwind v4)**
- Never put two classes for the same property in one element (e.g. `hover:bg-surface-2` and `hover:bg-red-600`):
  the winner depends on CSS order, not class order. Give each state its own complete class list.
- Theme colours come from the tokens in globals.css (`bg-surface`, `text-ink`, `bg-accent`…). No hard-coded
  `bg-white`/`text-black`, and no `prefers-color-scheme` rule: the theme is the user's choice.
- After editing globals.css (or running `next build` while `next dev` runs), check the CSS the dev server
  actually serves. It once served the old stylesheet (white text on white).

**React rules (React 19 lint)**
- Only real hooks may start with `use` (`useFile` broke the Rules of Hooks).
- No impure calls in render (`Date.now()`, `Math.random()`): keep a ticking `now` in state instead.
  The linter also flags them inside handlers defined in the component body: call a module-level
  helper (`const clock = () => Date.now()`) from the handler instead.
- No `setState` directly in an effect body; wrap it in a function (`const apply = () => setX(...); apply();`)
  or do it in an event/async callback.
- `useSearchParams()` needs a `<Suspense>` boundary in this Next.js version.

**Edit scripts**
- Write edit scripts to files (not bash heredocs) and use Python raw strings (r"...") for code with regex backslashes.
- Run new text/logic helpers on real sample input before wiring them into the UI (it caught "ur" → "your" vs "you're").

**Testing honestly**
- Claude CAN drive a real (hidden) Chrome with puppeteer-core from the scratchpad
  (`C:/Program Files/Google/Chrome/Application/chrome.exe`): log in as a temp `@t.com` user, click through,
  capture console errors and screenshots. Do this for UI changes before saying they work.
- Still can't hear sound or use a real mic/camera: say so, and ask Clarence to check those by hand.

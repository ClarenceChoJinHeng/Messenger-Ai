# Messenger With AI · backend (NestJS)

Project notes, rules and learning progress live in Obsidian:
`E:\Learning\Personal\Projects\Messenger With AI\` (start with `CLAUDE.md` and `Resume Here.md`).

- Clarence is **learning** NestJS here: teach, don't write their app code — EXCEPT on branches Clarence
  asked Claude to build (`task/003-portfolio-mvp` and later feature tasks). Learning happens on `task/002-prisma-mysql`.
- Every task: `specs/NNN-name.md` → branch `task/NNN-name` from `release/prod` →
  `release/staging` → `release/prod`. Commit only when Clarence asks, and scan for secrets first.
- **No Claude attribution in commits**: never add `Co-Authored-By: Claude` (Clarence removed it from all history).
- Never read `.env*`, `secrets/` or other secrets. Use the app's own code to work with them.
- Runs on port 4000 (`npm run start:dev`). The frontend repo is `../messenger-ai` (port 3000).
- MySQL comes from Laragon (MySQL 8.0.30). Laragon → Start All before the backend.

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

**Secrets and sessions**
- Never generate a secret fresh on each start (`process.env.X ?? randomBytes()`). Watch mode restarts on
  every save, so everyone got logged out ("session expired"). Use `getSecret()` (src/config/secrets.ts),
  which persists a dev key in `secrets/`.

**Auth**
- Check WebSocket auth in the handshake middleware (`server.use`), never in `handleConnection`:
  a fake token connected for a moment before being kicked.
- Throw 403 (not 401) for "wrong current password" on a logged-in route: the frontend logs out on any 401.

**Global guards / modules**
- A global HTTP guard (ThrottlerGuard) also runs on WebSocket events and crashes there.
  Use `HttpThrottlerGuard`, which skips non-HTTP contexts.

**Prisma 7**
- `migrate dev` does NOT run `generate` in Prisma 7. Always run both after a schema change.
- Before deleting/renaming migrations, the database still has the old ones: expect drift → `migrate reset` (dev only).

**Uploads / files**
- Never trust a file's name or the browser's MIME type. Detect from bytes (`FileStoreService`), random names,
  encrypted on disk. WebM may be detected as Matroska; audio WebM looks like video WebM.

**Running and testing**
- If the API is unreachable, check MySQL (port 3306) and the backend port first: the cause was MySQL being off.
- Stopping a background `nest start --watch` can leave its child `node dist/main` running on port 4000.
  Check the port (`Get-NetTCPConnection -LocalPort 4000`) and stop the orphan before starting again.
- `touch`-ing a file does not always trigger the watcher: restart it instead.
- Test accounts use `@t.com` emails and must be deleted after every test run (with their uploaded files).
- Hosting runs Linux + whatever npm its Node version bundles. Render's Node 22 = npm 10, which rejected a lock
  file made by npm 11 ("Missing: typescript from lock file"). Use Node 24 (npm 11) and test the build command
  with `npx npm@<host's npm> ci --dry-run` before pushing.
- Write helper scripts to files instead of long bash heredocs with quotes/apostrophes (they broke twice).
- In Python edit scripts, use raw strings (r"...") for code with backslashes (regexes): `\s`, `\p{...}` broke an edit.

**Being honest**
- Claude cannot click through the browser here. Say what was tested (API, build) and what wasn't (UI, mic,
  camera, sound), and ask Clarence to check those.

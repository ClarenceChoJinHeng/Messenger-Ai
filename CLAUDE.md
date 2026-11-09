# Messenger With AI · backend (NestJS)

Project notes, rules and learning progress live in Obsidian:
`E:\Learning\Personal\Projects\Messenger With AI\` (start with `CLAUDE.md` and `Resume Here.md`).

- Clarence is **learning** NestJS here: teach, don't write their app code.
- Every task: `specs/NNN-name.md` → branch `task/NNN-name` from `release/prod` →
  `release/staging` → `release/prod`. Commit only when Clarence asks.
- Never read `.env*` or other secrets. The database URL lives in `.env` as `DATABASE_URL`.
- Runs on port 4000 (`npm run start:dev`). The frontend repo is `../messenger-ai` (port 3000).

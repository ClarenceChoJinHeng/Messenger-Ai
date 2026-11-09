# Spec 006 · Hosting (free): Aiven MySQL + Render (backend) + Vercel (frontend)

**Branch:** `task/006-hosting` (both repos) · **Date:** 2026-11-10 · **Built by:** Claude, at Clarence's request

## Goal
Put the app online for free, so it can be shown in the portfolio.

## What changes
- `FILE_STORAGE=database`: uploads (still encrypted) go in a new `StoredFile` table, because free hosts wipe their disk
- `dbConfig()`: builds the DB connection from `DATABASE_URL`, with SSL for hosted MySQL (+ optional `DATABASE_CA_CERT`)
- In production the app refuses to start without `JWT_SECRET` / `MESSAGE_ENCRYPTION_KEY` (made-up keys would vanish)
- `render.yaml` blueprint (build, migrate on start, generated secrets), `engines.node >= 22`
- `DEPLOY.md` step-by-step guide, README deploy sections, `.env.example` entries

## Done when
- [x] Database file storage tested (upload → identical download, stored bytes encrypted)
- [x] Production start without secrets refuses with a clear message
- [x] tsc, tests, build pass
- [ ] Merged into release/staging → release/prod and pushed (backend repo created by Clarence)
- [ ] Aiven / Render / Vercel set up by Clarence following DEPLOY.md

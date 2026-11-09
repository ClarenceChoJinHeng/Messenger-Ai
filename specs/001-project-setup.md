# Spec 001 · Move the project to the new rules

**Branch:** `task/001-project-setup` (from `release/prod`)
**Story:** setup · **Sprint:** 01
**Status:** in progress
**Date:** 2026-11-06

## Goal
Set the project up the same way as every other project: notes folder, specs, branches and
secret protection, so the database work (task 002) starts clean.

## What changes
- Notes folder: CLAUDE.md, ARCHITECTURE.md, CHANGELOG.md, Backlog.md, Sprints/Sprint 01.md,
  Learned Topics.md, Scoreboard.md, Quizzes/, Resume Here.md
- Two repos: frontend `messenger-ai` (existing) and backend `backend` (new `git init`)
- Both repos: `release/prod` + `release/staging`, `specs/`, `CLAUDE.md` pointing to the notes,
  `.claude/settings.json` deny rules for secrets, the same patterns in `.gitignore`
- Backend: `.gitignore` (node_modules, dist, .env)

## Out of scope
- Any app code changes (the register work done so far gets committed as it is)
- GitHub remote for the backend (Clarence decides later)

## Done when
- [x] Notes folder files exist and match the code
- [x] Both repos have `release/prod`, `release/staging` and this spec
- [x] Secret deny rules + `.gitignore` patterns in both repos
- [ ] Clarence has asked for the commits and they're done (backend needs a first commit before its branches can exist)
- [ ] Merged into `release/staging`, then `release/prod`

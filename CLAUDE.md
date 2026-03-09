# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Custom NYC Connections-style web game. Players enter a pre-assigned access code, play a one-time scored puzzle, then view a public leaderboard. `docs/plan.md` is the source of truth for architecture — read it before making changes and justify any deviations.

## Stack

- **Framework**: Next.js (App Router) — Server Components for puzzle data, Client Components for interactive grid
- **Database**: Vercel Postgres via **Drizzle ORM** (edge-compatible, type-safe)
- **Auth**: Custom access-code system for players; `ADMIN_KEY` env var gates `/admin`
- **Deployment**: Vercel

Do NOT use Vercel Blob — all data is text-based and belongs in Postgres.

## Commands

The app is not yet scaffolded. Once scaffolded, standard Next.js commands apply:

```bash
npm run dev       # local dev server
npm run build     # production build
npm run lint      # lint
npx drizzle-kit push    # push schema to DB
npx drizzle-kit studio  # DB browser UI
```

## App Router Structure

src/
├── app/
│ ├── page.tsx # Login gateway (access code entry)
│ ├── play/page.tsx # Game grid UI
│ ├── leaderboard/page.tsx
│ └── admin/
│ ├── layout.tsx # Admin password gate
│ └── page.tsx
├── actions/
│ ├── auth.ts # validateAccessCode()
│ ├── game.ts # submitGuess()
│ └── admin.ts # createPuzzle(), generatePlayers()
├── components/
│ ├── game/ # Board.tsx, WordCard.tsx
│ └── ui/
├── db/
│ ├── schema.ts # Drizzle schema definitions
│ └── index.ts # DB client
└── lib/
├── math.ts # Score formula
└── utils.ts

```

## Data Model

Six tables: `Admin`, `Puzzle` (one active at a time), `Category` (4 per puzzle, difficulty 1–4), `Word` (4 per category), `Player` (unique `access_code`), `GameSession` (unique per player, enforced at DB level), and optionally `Guess`.

## Game Logic Rules

- **Server NEVER sends category metadata to the client** — only 16 shuffled word strings
- `submitGuess(session_id, word_ids[])` runs entirely server-side, validates category membership, increments `mistakes_made` in DB before responding
- `start_time` / `end_time` are server-authoritative — client timer is cosmetic only
- Session locks on 4 mistakes (LOST) or 4 correct groups (WON); score computed server-side at end
- Score formula: `1000 + max(0, 500 - ((seconds - 30) * 5)) - (mistakes * 150)`


## Environment Variables

```

POSTGRES_URL= # From Vercel Storage integration
ADMIN_KEY= # Secret passphrase for /admin route

```

## Implementation Phases

Follow `docs/plan.md` phases in order:
1. Foundation — Next.js scaffold, Drizzle schema, seed script
2. Core Game Engine — Board/WordCard components, `submitGuess` Server Action
3. Auth & Sessions — Access code login, session creation, route protection
4. Leaderboard & Scoring — Score math, end-game triggers, `/leaderboard` UI
5. Admin Tooling — Password-gated CRUD for puzzles and bulk player generation
6. Polish & Deploy — Animations, mobile QA, Vercel deploy
```

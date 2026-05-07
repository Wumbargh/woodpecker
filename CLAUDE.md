# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Wookpecker** is a chess tactics training app based on the "Woodpecker Method": a fixed set of puzzles is cycled through repeatedly (similar to a flashcard deck, but the whole set is repeated rather than individual cards). Puzzles come from the Lichess open puzzle database plus user-created custom puzzles.

Stack: **Next.js 14+ (App Router)**, **Supabase** (Postgres + Auth), **Vercel** (deployment), **chess.js** (move validation/logic), **react-chessboard** (board UI).

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
```

Supabase local dev (requires Supabase CLI):
```bash
supabase start       # Start local Supabase stack
supabase db push     # Apply migrations to remote
supabase gen types typescript --local > src/types/supabase.ts  # Regenerate DB types
```

## Architecture

### Data Model

The core entities and their relationships:

- **puzzle_sets** — A named collection of puzzles owned by a user (e.g. "Meine Eröffnungsfallen", "Lichess Top 1000")
- **puzzles** — A single tactic: FEN start position, solution as UCI move list, optional source metadata. Can belong to multiple sets via `puzzle_set_puzzles` join table.
- **training_sessions** — One complete run through a puzzle set. Records start/end time and which cycle number this is (1st, 2nd, 3rd pass through the set).
- **puzzle_attempts** — One attempt at one puzzle within a session. Records whether it was solved correctly, time taken, and any user notes.

The Woodpecker loop: a session is "complete" when all puzzles in the set have one attempt. The next session increments the cycle counter. Stats are aggregated per set per cycle to show improvement over time (accuracy %, avg time per puzzle).

### Puzzle Sources

- **Lichess import**: puzzles are bulk-imported from the [Lichess puzzle CSV](https://database.lichess.org/#puzzles). A background job or one-time migration script inserts them into the `puzzles` table with `source = 'lichess'` and the original Lichess puzzle ID.
- **Custom puzzles**: users can create puzzles manually (FEN + solution). These have `source = 'custom'`.

### Next.js App Router Structure

```
src/
  app/
    (auth)/          # Login/signup pages, no nav shell
    (app)/           # Authenticated app shell with nav
      dashboard/     # Overview: active sets, recent sessions
      sets/          # Puzzle set management
      train/[setId]/ # Active training session (the core loop)
      puzzles/       # Browse/import puzzles
  components/
    board/           # react-chessboard wrapper + move handling
    training/        # Session UI, timer, result feedback
  lib/
    supabase/        # Client + server Supabase clients
    chess/           # chess.js helpers (validate solution, get legal moves)
    lichess/         # CSV parser, puzzle import logic
  types/
    supabase.ts      # Auto-generated from schema (do not edit manually)
```

### Supabase Auth

Use Supabase's built-in Auth with the `@supabase/ssr` package. Two client instances:
- `lib/supabase/client.ts` — browser client (for components)
- `lib/supabase/server.ts` — server client using `cookies()` (for Server Components and API routes)

Row Level Security (RLS) is enabled on all tables. All policies are scoped to `auth.uid()`.

### Training Session Flow

1. User starts a session → creates a `training_sessions` row, builds the puzzle queue (see below), persists queue state so a page refresh is safe.
2. For each puzzle: render board at starting FEN, wait for user moves, validate against the solution move list using chess.js.
3. On completion → insert `puzzle_attempts` row (correct: true/false, time taken), update queue state, advance to next puzzle.
4. When both queues are empty → mark session complete, show summary stats.

The board component must handle multi-move solutions (not just the first move). After the user plays the correct move, the engine response move is played automatically before waiting for the next user move.

### Repetition System

Sessions use a **two-queue model**:

- **Main queue**: all puzzles in the set, shuffled at session start (shuffle seed stored in `training_sessions` so it survives refresh).
- **Review queue**: puzzles solved incorrectly during this session.

Every time a puzzle is drawn from the main queue, the system checks whether to inject a review puzzle instead, based on a configurable **review interval** (default: every 8–10 main puzzles). If the injected review puzzle is solved incorrectly again, it goes back to the end of the review queue. The session ends when the main queue is exhausted and the review queue is empty.

**Cross-session weighting**: when building the main queue for a new cycle, puzzles that were solved incorrectly in the previous cycle are duplicated in the queue (default: 2 copies for ≥1 error, 3 copies for ≥2 errors). This keeps the Woodpecker structure (one full pass) while surfacing weak puzzles more often. The `puzzle_attempts` table provides the per-puzzle error history needed to compute these weights.

Queue state (current index into main queue, review queue contents, review counter) is stored as a JSON column on `training_sessions` so sessions can be resumed after interruption.

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # Only for server-side admin tasks (puzzle import)
```

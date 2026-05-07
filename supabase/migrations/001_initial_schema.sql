-- Puzzles (shared, not user-owned — users curate sets from this pool)
create table puzzles (
  id uuid primary key default gen_random_uuid(),
  fen text not null,
  moves text[] not null,           -- solution as UCI move list, e.g. ['e2e4', 'e7e5']
  source text not null default 'custom', -- 'lichess' | 'custom'
  lichess_id text unique,          -- original Lichess puzzle ID
  rating int,
  themes text[],
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Named puzzle collections owned by a user
create table puzzle_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Many-to-many: which puzzles belong to which set
create table puzzle_set_puzzles (
  puzzle_set_id uuid not null references puzzle_sets(id) on delete cascade,
  puzzle_id uuid not null references puzzles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (puzzle_set_id, puzzle_id)
);

-- One session = one full pass through a set
create table training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_set_id uuid not null references puzzle_sets(id) on delete cascade,
  cycle_number int not null default 1,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Persisted queue state so sessions survive page refresh:
  -- { mainQueue: uuid[], mainIndex: number, reviewQueue: uuid[], reviewCounter: number }
  queue_state jsonb not null default '{}'::jsonb
);

-- One row per puzzle shown during a session (including review-queue re-shows)
create table puzzle_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references training_sessions(id) on delete cascade,
  puzzle_id uuid not null references puzzles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  solved_correctly boolean not null,
  time_taken_ms int,
  attempt_number int not null default 1, -- increments for review-queue retries within a session
  created_at timestamptz not null default now()
);

-- RLS
alter table puzzles enable row level security;
alter table puzzle_sets enable row level security;
alter table puzzle_set_puzzles enable row level security;
alter table training_sessions enable row level security;
alter table puzzle_attempts enable row level security;

-- Lichess puzzles are readable by all authenticated users; custom puzzles only by creator
create policy "puzzles: read lichess or own" on puzzles
  for select using (source = 'lichess' or created_by = auth.uid());

create policy "puzzles: insert own" on puzzles
  for insert with check (created_by = auth.uid());

create policy "puzzle_sets: all own" on puzzle_sets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "puzzle_set_puzzles: via own set" on puzzle_set_puzzles
  for all using (
    exists (select 1 from puzzle_sets where id = puzzle_set_id and user_id = auth.uid())
  );

create policy "training_sessions: all own" on training_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "puzzle_attempts: all own" on puzzle_attempts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

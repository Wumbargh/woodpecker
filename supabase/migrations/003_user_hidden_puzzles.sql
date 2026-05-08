-- Counter on puzzles: how many users have hidden this puzzle
alter table puzzles add column hidden_count int not null default 0;

-- Per-user blocklist: puzzles that won't appear in new sets for this user
create table user_hidden_puzzles (
  user_id  uuid not null references auth.users(id) on delete cascade,
  puzzle_id uuid not null references puzzles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, puzzle_id)
);

alter table user_hidden_puzzles enable row level security;

create policy "user_hidden_puzzles: all own" on user_hidden_puzzles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Trigger increments hidden_count so we don't need an extra UPDATE round-trip
create or replace function increment_puzzle_hidden_count()
returns trigger language plpgsql security definer as $$
begin
  update puzzles set hidden_count = hidden_count + 1 where id = new.puzzle_id;
  return new;
end;
$$;

create trigger trg_puzzle_hidden_count
  after insert on user_hidden_puzzles
  for each row execute function increment_puzzle_hidden_count();

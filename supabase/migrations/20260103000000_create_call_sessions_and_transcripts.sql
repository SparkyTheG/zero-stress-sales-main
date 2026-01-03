-- Stores per-user call sessions and transcript chunks (streamed during the call)
-- Run this migration in your Supabase project.

create extension if not exists "pgcrypto";

-- 1) Sessions: one row per call
create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists call_sessions_user_id_idx on public.call_sessions(user_id);
create index if not exists call_sessions_created_at_idx on public.call_sessions(created_at desc);

alter table public.call_sessions enable row level security;

-- Allow users to see their own sessions
create policy "call_sessions_select_own"
  on public.call_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Allow users to create their own sessions
create policy "call_sessions_insert_own"
  on public.call_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Allow users to update their own sessions (e.g., ended_at/title)
create policy "call_sessions_update_own"
  on public.call_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) Transcript chunks: append-only rows per session
create table if not exists public.call_transcript_chunks (
  id bigserial primary key,
  session_id uuid not null references public.call_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seq int not null,
  speaker text not null default 'unknown',
  text text not null,
  created_at timestamptz not null default now()
);

-- Guarantee ordering per session
create unique index if not exists call_transcript_chunks_session_seq_uniq
  on public.call_transcript_chunks(session_id, seq);

create index if not exists call_transcript_chunks_user_id_idx on public.call_transcript_chunks(user_id);
create index if not exists call_transcript_chunks_session_id_idx on public.call_transcript_chunks(session_id);
create index if not exists call_transcript_chunks_created_at_idx on public.call_transcript_chunks(created_at desc);

alter table public.call_transcript_chunks enable row level security;

-- Users can read only their own chunks
create policy "call_transcript_chunks_select_own"
  on public.call_transcript_chunks
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can insert only their own chunks (client-side inserts, if ever used)
create policy "call_transcript_chunks_insert_own"
  on public.call_transcript_chunks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can update only their own chunks (not typically needed, but safe)
create policy "call_transcript_chunks_update_own"
  on public.call_transcript_chunks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


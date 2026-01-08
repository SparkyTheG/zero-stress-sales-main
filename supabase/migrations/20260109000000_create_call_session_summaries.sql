-- Stores AI-generated conversation summaries per call session (progressive + final)
-- Run this migration in your Supabase project.

create extension if not exists "pgcrypto";

create table if not exists public.call_session_summaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.call_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  status text not null check (status in ('progressive', 'final')),
  title text,
  preview text,
  summary jsonb not null default '{}'::jsonb,
  duration_seconds int,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists call_session_summaries_user_id_idx on public.call_session_summaries(user_id);
create index if not exists call_session_summaries_session_id_idx on public.call_session_summaries(session_id);
create index if not exists call_session_summaries_created_at_idx on public.call_session_summaries(created_at desc);
create index if not exists call_session_summaries_status_idx on public.call_session_summaries(status);

-- Only one FINAL summary per session (but allow multiple progressive summaries)
create unique index if not exists call_session_summaries_one_final_per_session
  on public.call_session_summaries(session_id)
  where status = 'final';

alter table public.call_session_summaries enable row level security;

drop policy if exists "call_session_summaries_select_own" on public.call_session_summaries;
create policy "call_session_summaries_select_own"
  on public.call_session_summaries
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "call_session_summaries_insert_own" on public.call_session_summaries;
create policy "call_session_summaries_insert_own"
  on public.call_session_summaries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "call_session_summaries_update_own" on public.call_session_summaries;
create policy "call_session_summaries_update_own"
  on public.call_session_summaries
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


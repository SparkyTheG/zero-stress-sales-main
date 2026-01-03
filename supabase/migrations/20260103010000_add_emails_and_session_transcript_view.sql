-- Add user_email columns and a "one paragraph per session" transcript view.

-- 1) Denormalized email columns for easier admin visibility
alter table public.call_sessions
  add column if not exists user_email text;

alter table public.user_settings
  add column if not exists user_email text;

create index if not exists call_sessions_user_email_idx on public.call_sessions(user_email);
create index if not exists user_settings_user_email_idx on public.user_settings(user_email);

-- 2) View: one row per call session with aggregated transcript
create or replace view public.call_session_transcripts as
select
  s.id as session_id,
  s.user_id,
  s.user_email,
  s.created_at,
  s.ended_at,
  coalesce(
    string_agg(
      (upper(c.speaker) || ': ' || c.text),
      E'\n'
      order by c.seq
    ),
    ''
  ) as transcript
from public.call_sessions s
left join public.call_transcript_chunks c
  on c.session_id = s.id
group by s.id, s.user_id, s.user_email, s.created_at, s.ended_at;


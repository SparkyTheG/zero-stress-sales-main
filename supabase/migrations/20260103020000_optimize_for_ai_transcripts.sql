/*
  # Optimize Supabase schema for AI-analyzed transcripts

  Changes:
  1. Add ai_analyzed flag to call_sessions to track which sessions used AI speaker detection
  2. Update call_session_transcripts view to show cleaner paragraph format
  3. Add indexes for better query performance
  4. Ensure speaker column is properly indexed for filtering
*/

-- Add ai_analyzed flag to call_sessions
alter table public.call_sessions
add column if not exists ai_analyzed boolean default false;

-- Add index on speaker column for filtering by closer/prospect
create index if not exists call_transcript_chunks_speaker_idx 
on public.call_transcript_chunks(speaker);

-- Add index on created_at for time-based queries
create index if not exists call_sessions_created_at_idx 
on public.call_sessions(created_at desc);

-- Update the view to show cleaner paragraph format with speaker labels
create or replace view public.call_session_transcripts as
select
  s.id as session_id,
  s.user_id,
  s.user_email,
  s.created_at,
  s.ended_at,
  s.ai_analyzed,
  coalesce(
    string_agg(
      (upper(c.speaker) || ': ' || c.text),
      E'\n'
      order by c.seq
    ),
    ''
  ) as transcript,
  count(c.id) as chunk_count,
  count(case when c.speaker = 'closer' then 1 end) as closer_turns,
  count(case when c.speaker = 'prospect' then 1 end) as prospect_turns
from public.call_sessions s
left join public.call_transcript_chunks c
  on c.session_id = s.id
group by s.id, s.user_id, s.user_email, s.created_at, s.ended_at, s.ai_analyzed;

-- Create a simpler view that shows just the clean transcript (for easy reading)
create or replace view public.call_transcripts_simple as
select
  s.id as session_id,
  s.user_email,
  s.created_at::date as call_date,
  s.ai_analyzed,
  coalesce(
    string_agg(
      (
        case c.speaker 
          when 'closer' then '🎯 CLOSER: '
          when 'prospect' then '👤 PROSPECT: '
          else '❓ ' || upper(c.speaker) || ': '
        end || c.text
      ),
      E'\n\n'
      order by c.seq
    ),
    '(No transcript)'
  ) as conversation
from public.call_sessions s
left join public.call_transcript_chunks c
  on c.session_id = s.id
group by s.id, s.user_email, s.created_at, s.ai_analyzed
order by s.created_at desc;

-- Grant select on new views to authenticated users
grant select on public.call_session_transcripts to authenticated;
grant select on public.call_transcripts_simple to authenticated;

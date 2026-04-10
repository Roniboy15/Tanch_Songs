-- Phase 5: App-facing query layer (public feed + admin moderation queue).
-- Run this after phase4_rls.sql.

begin;

-- Faster admin queue loading (pending songs first).
create index if not exists songs_pending_created_idx
  on public.songs (created_at desc)
  where moderation_status = 'pending';

-- Unified public-facing view of approved songs + verse connections.
-- Works for anon users because RLS already limits base tables to approved rows.
create or replace view public.approved_song_links as
select
  s.id as song_id,
  s.title,
  s.artist_name,
  s.composer_name,
  s.source_url,
  s.created_at as song_created_at,
  'exact'::text as link_kind,
  l.relationship_type,
  l.note,
  l.sort_order,
  v.reference as link_label,
  b.book_number as start_book_number,
  c.chapter_number as start_chapter_number,
  v.verse_number as start_verse_number,
  b.book_number as end_book_number,
  c.chapter_number as end_chapter_number,
  v.verse_number as end_verse_number
from public.songs s
join public.song_verse_links l on l.song_id = s.id
join public.verses v on v.id = l.verse_id
join public.chapters c on c.id = v.chapter_id
join public.books b on b.id = c.book_id
where s.moderation_status = 'approved'

union all

select
  s.id as song_id,
  s.title,
  s.artist_name,
  s.composer_name,
  s.source_url,
  s.created_at as song_created_at,
  'range'::text as link_kind,
  r.relationship_type,
  r.note,
  r.sort_order,
  r.range_label as link_label,
  sb.book_number as start_book_number,
  sc.chapter_number as start_chapter_number,
  sv.verse_number as start_verse_number,
  eb.book_number as end_book_number,
  ec.chapter_number as end_chapter_number,
  ev.verse_number as end_verse_number
from public.songs s
join public.song_verse_ranges r on r.song_id = s.id
join public.verses sv on sv.id = r.start_verse_id
join public.chapters sc on sc.id = sv.chapter_id
join public.books sb on sb.id = sc.book_id
join public.verses ev on ev.id = r.end_verse_id
join public.chapters ec on ec.id = ev.chapter_id
join public.books eb on eb.id = ec.book_id
where s.moderation_status = 'approved';

-- Admin queue view: pending songs with quick link counts.
-- Admin-only visibility comes from RLS on public.songs.
create or replace view public.admin_song_review_queue as
select
  s.id,
  s.title,
  s.artist_name,
  s.composer_name,
  s.source_url,
  s.notes,
  s.submitted_by,
  s.moderation_status,
  s.created_at,
  s.updated_at,
  coalesce(l.exact_link_count, 0) as exact_link_count,
  coalesce(r.range_link_count, 0) as range_link_count,
  (coalesce(l.exact_link_count, 0) + coalesce(r.range_link_count, 0)) as total_link_count
from public.songs s
left join (
  select song_id, count(*) as exact_link_count
  from public.song_verse_links
  group by song_id
) l on l.song_id = s.id
left join (
  select song_id, count(*) as range_link_count
  from public.song_verse_ranges
  group by song_id
) r on r.song_id = s.id
where s.moderation_status = 'pending'
order by s.created_at asc;

-- RPC-friendly helper for public submissions.
-- Trigger from phase4 still forces moderation_status to pending for non-admin callers.
create or replace function public.submit_song(
  p_title text,
  p_artist_name text default null,
  p_composer_name text default null,
  p_source_url text default null,
  p_lyrics text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required';
  end if;

  insert into public.songs (
    id,
    title,
    artist_name,
    composer_name,
    source_url,
    lyrics,
    notes,
    moderation_status
  )
  values (
    new_id,
    trim(p_title),
    nullif(trim(p_artist_name), ''),
    nullif(trim(p_composer_name), ''),
    nullif(trim(p_source_url), ''),
    nullif(p_lyrics, ''),
    nullif(p_notes, ''),
    'pending'
  )

  return new_id;
end;
$$;

grant execute on function public.submit_song(text, text, text, text, text, text) to anon, authenticated;

grant select on public.approved_song_links to anon, authenticated;
grant select on public.admin_song_review_queue to authenticated;

-- RPC-friendly helper for moderation action.
-- RLS allows update only for editor/admin users.
create or replace function public.set_song_moderation(
  p_song_id uuid,
  p_target_status text
)
returns public.songs
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_row public.songs;
begin
  if p_target_status not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid moderation status: %', p_target_status;
  end if;

  update public.songs s
  set moderation_status = p_target_status
  where s.id = p_song_id
  returning s.* into updated_row;

  if updated_row.id is null then
    raise exception 'song not found or not permitted';
  end if;

  return updated_row;
end;
$$;

grant execute on function public.set_song_moderation(uuid, text) to authenticated;

commit;

-- Optional quick checks:
-- select * from public.approved_song_links order by title, sort_order, link_kind;
-- select * from public.admin_song_review_queue;

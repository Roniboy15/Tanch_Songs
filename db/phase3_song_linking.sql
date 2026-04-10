-- Phase 3: Song linking layer (exact verses + verse ranges)
-- Safe to run in Supabase SQL editor after schema.sql and Tanach import are complete.

begin;

-- 1) Keep song timestamps current on updates.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_songs_set_updated_at on public.songs;
create trigger trg_songs_set_updated_at
before update on public.songs
for each row
execute function public.set_updated_at();

-- 2) Add useful uniqueness guardrails (idempotent).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'song_verse_ranges_unique_range'
      and conrelid = 'public.song_verse_ranges'::regclass
  ) then
    alter table public.song_verse_ranges
      add constraint song_verse_ranges_unique_range
      unique (song_id, start_verse_id, end_verse_id, relationship_type);
  end if;
end
$$;

-- 3) Validate that a range is forward and inside one book.
create or replace function public.validate_song_verse_range()
returns trigger
language plpgsql
as $$
declare
  s_book_id uuid;
  e_book_id uuid;
  s_book_number integer;
  e_book_number integer;
  s_chapter integer;
  e_chapter integer;
  s_verse integer;
  e_verse integer;
begin
  select b.id, b.book_number, c.chapter_number, v.verse_number
    into s_book_id, s_book_number, s_chapter, s_verse
  from public.verses v
  join public.chapters c on c.id = v.chapter_id
  join public.books b on b.id = c.book_id
  where v.id = new.start_verse_id;

  select b.id, b.book_number, c.chapter_number, v.verse_number
    into e_book_id, e_book_number, e_chapter, e_verse
  from public.verses v
  join public.chapters c on c.id = v.chapter_id
  join public.books b on b.id = c.book_id
  where v.id = new.end_verse_id;

  if s_book_id is null or e_book_id is null then
    raise exception 'Start or end verse does not exist';
  end if;

  if s_book_id <> e_book_id then
    raise exception 'Verse range must stay inside one book';
  end if;

  if (s_book_number, s_chapter, s_verse) > (e_book_number, e_chapter, e_verse) then
    raise exception 'Range start must come before range end';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_song_verse_range on public.song_verse_ranges;
create trigger trg_validate_song_verse_range
before insert or update on public.song_verse_ranges
for each row
execute function public.validate_song_verse_range();

-- 4) Helpful indexes for common lookups.
create index if not exists songs_created_desc_idx
  on public.songs (created_at desc);

create index if not exists song_verse_ranges_start_idx
  on public.song_verse_ranges (start_verse_id, end_verse_id);

-- 5) Demo inserts (safe to rerun).
insert into public.songs (title, artist_name, composer_name, source_url, notes, moderation_status)
select
  'Demo Song - Bereshit Opening',
  'Demo Artist',
  'Demo Composer',
  'https://example.com/demo-song',
  'Inserted by phase3_song_linking.sql for validation',
  'approved'
where not exists (
  select 1 from public.songs where title = 'Demo Song - Bereshit Opening'
);

-- Link exact verse: Genesis 1:1.
with s as (
  select id as song_id
  from public.songs
  where title = 'Demo Song - Bereshit Opening'
  order by created_at desc
  limit 1
), v as (
  select id as verse_id
  from public.verses
  where reference = 'Genesis 1:1'
)
insert into public.song_verse_links (song_id, verse_id, relationship_type, note, sort_order)
select s.song_id, v.verse_id, 'exact', 'Opening verse link', 1
from s cross join v
on conflict (song_id, verse_id, relationship_type) do nothing;

-- Link range: Genesis 1:1-3.
with s as (
  select id as song_id
  from public.songs
  where title = 'Demo Song - Bereshit Opening'
  order by created_at desc
  limit 1
), sv as (
  select id as start_verse_id
  from public.verses
  where reference = 'Genesis 1:1'
), ev as (
  select id as end_verse_id
  from public.verses
  where reference = 'Genesis 1:3'
)
insert into public.song_verse_ranges (
  song_id,
  start_verse_id,
  end_verse_id,
  range_label,
  relationship_type,
  note,
  sort_order
)
select
  s.song_id,
  sv.start_verse_id,
  ev.end_verse_id,
  'Genesis 1:1-3',
  'quotation',
  'Opening creation range',
  2
from s cross join sv cross join ev
on conflict (song_id, start_verse_id, end_verse_id, relationship_type) do nothing;

commit;

-- 6) Verification queries.

-- A) Songs connected to one exact verse reference (direct links + containing ranges).
with target as (
  select v.id, b.book_number, c.chapter_number, v.verse_number
  from public.verses v
  join public.chapters c on c.id = v.chapter_id
  join public.books b on b.id = c.book_id
  where v.reference = 'Genesis 1:2'
)
select distinct
  s.id,
  s.title,
  s.artist_name,
  s.moderation_status
from public.songs s
left join public.song_verse_links l on l.song_id = s.id
left join target t on t.id = l.verse_id
left join public.song_verse_ranges r on r.song_id = s.id
left join public.verses sv on sv.id = r.start_verse_id
left join public.chapters sc on sc.id = sv.chapter_id
left join public.books sb on sb.id = sc.book_id
left join public.verses ev on ev.id = r.end_verse_id
left join public.chapters ec on ec.id = ev.chapter_id
left join public.books eb on eb.id = ec.book_id
where
  t.id is not null
  or (
    sb.book_number = eb.book_number
    and sb.book_number = (select book_number from target limit 1)
    and (sc.chapter_number, sv.verse_number)
      <= ((select chapter_number from target limit 1), (select verse_number from target limit 1))
    and (ec.chapter_number, ev.verse_number)
      >= ((select chapter_number from target limit 1), (select verse_number from target limit 1))
  )
order by s.title;

-- B) All verse links for one song, sorted canonically.
select
  s.title,
  'exact' as link_kind,
  v.reference as link_label,
  l.relationship_type,
  l.note,
  l.sort_order
from public.song_verse_links l
join public.songs s on s.id = l.song_id
join public.verses v on v.id = l.verse_id
where s.title = 'Demo Song - Bereshit Opening'

union all

select
  s.title,
  'range' as link_kind,
  r.range_label as link_label,
  r.relationship_type,
  r.note,
  r.sort_order
from public.song_verse_ranges r
join public.songs s on s.id = r.song_id
where s.title = 'Demo Song - Bereshit Opening'
order by sort_order, link_kind, link_label;

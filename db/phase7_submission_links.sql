-- Phase 7: Submission with verse links (selector-based, no free-text references).
-- Run this after phase5_app_queries.sql.

begin;

drop function if exists public.submit_song_with_links(text, text, text, text, text, text, text[], text, text, text);

create or replace view public.tanach_verse_catalog as
select
  v.id as verse_id,
  v.reference,
  v.verse_number,
  c.id as chapter_id,
  c.chapter_number,
  b.id as book_id,
  b.book_number,
  b.canonical_name as book_name
from public.verses v
join public.chapters c on c.id = v.chapter_id
join public.books b on b.id = c.book_id;

grant select on public.tanach_verse_catalog to anon, authenticated;

create or replace function public.submit_song_with_links(
  p_title text,
  p_artist_name text default null,
  p_composer_name text default null,
  p_source_url text default null,
  p_lyrics text default null,
  p_notes text default null,
  p_exact_verse_ids uuid[] default '{}',
  p_range_start_verse_id uuid default null,
  p_range_end_verse_id uuid default null,
  p_range_relationship_type text default 'quotation'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_song_id uuid := gen_random_uuid();
  cleaned_exact_ids uuid[];
  has_range boolean;
  ref_item uuid;
  link_order integer := 0;
  start_reference text;
  end_reference text;
  valid_exact_count integer := 0;
begin
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required';
  end if;

  cleaned_exact_ids := coalesce(
    array(
      select distinct value
      from unnest(coalesce(p_exact_verse_ids, '{}'::uuid[])) as value
      where value is not null
    ),
    '{}'::uuid[]
  );

  has_range := p_range_start_verse_id is not null and p_range_end_verse_id is not null;

  if (p_range_start_verse_id is null) <> (p_range_end_verse_id is null) then
    raise exception 'range requires both start and end verse ids';
  end if;

  if coalesce(array_length(cleaned_exact_ids, 1), 0) = 0 and not has_range then
    raise exception 'at least one exact verse or one range is required';
  end if;

  if p_range_relationship_type not in ('exact', 'quotation', 'theme', 'allusion') then
    raise exception 'invalid range relationship type: %', p_range_relationship_type;
  end if;

  if coalesce(array_length(cleaned_exact_ids, 1), 0) > 0 then
    select count(*) into valid_exact_count
    from public.verses v
    where v.id = any(cleaned_exact_ids);

    if valid_exact_count <> array_length(cleaned_exact_ids, 1) then
      raise exception 'one or more exact verse ids are invalid';
    end if;
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
    new_song_id,
    trim(p_title),
    nullif(trim(p_artist_name), ''),
    nullif(trim(p_composer_name), ''),
    nullif(trim(p_source_url), ''),
    nullif(p_lyrics, ''),
    nullif(p_notes, ''),
    'pending'
  );

  if coalesce(array_length(cleaned_exact_ids, 1), 0) > 0 then
    foreach ref_item in array cleaned_exact_ids loop
      link_order := link_order + 1;

      insert into public.song_verse_links (
        song_id,
        verse_id,
        relationship_type,
        note,
        sort_order
      )
      values (
        new_song_id,
        ref_item,
        'exact',
        null,
        link_order
      );
    end loop;
  end if;

  if has_range then
    select reference into start_reference
    from public.verses
    where id = p_range_start_verse_id;

    if start_reference is null then
      raise exception 'invalid range start verse id';
    end if;

    select reference into end_reference
    from public.verses
    where id = p_range_end_verse_id;

    if end_reference is null then
      raise exception 'invalid range end verse id';
    end if;

    insert into public.song_verse_ranges (
      song_id,
      start_verse_id,
      end_verse_id,
      range_label,
      relationship_type,
      note,
      sort_order
    )
    values (
      new_song_id,
      p_range_start_verse_id,
      p_range_end_verse_id,
      start_reference || ' - ' || end_reference,
      p_range_relationship_type,
      null,
      100
    );
  end if;

  return new_song_id;
end;
$$;

grant execute on function public.submit_song_with_links(text, text, text, text, text, text, uuid[], uuid, uuid, text) to anon, authenticated;

commit;

-- Optional checks:
-- select public.submit_song_with_links('Phase 7 Test', null, null, null, null, null, array['00000000-0000-0000-0000-000000000000']::uuid[], null, null, 'quotation');

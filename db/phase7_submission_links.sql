-- Phase 7: Submission with verse links.
-- Run this after phase5_app_queries.sql.

begin;

create or replace function public.submit_song_with_links(
  p_title text,
  p_artist_name text default null,
  p_composer_name text default null,
  p_source_url text default null,
  p_lyrics text default null,
  p_notes text default null,
  p_exact_references text[] default '{}',
  p_range_start_reference text default null,
  p_range_end_reference text default null,
  p_range_relationship_type text default 'quotation'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_song_id uuid := gen_random_uuid();
  cleaned_exact_refs text[];
  has_range boolean;
  start_verse_id uuid;
  end_verse_id uuid;
  ref_item text;
  link_order integer := 0;
begin
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required';
  end if;

  cleaned_exact_refs := coalesce(
    array(
      select distinct trim(value)
      from unnest(coalesce(p_exact_references, '{}'::text[])) as value
      where trim(value) <> ''
    ),
    '{}'::text[]
  );

  p_range_start_reference := nullif(trim(coalesce(p_range_start_reference, '')), '');
  p_range_end_reference := nullif(trim(coalesce(p_range_end_reference, '')), '');
  has_range := p_range_start_reference is not null and p_range_end_reference is not null;

  if (p_range_start_reference is null) <> (p_range_end_reference is null) then
    raise exception 'range requires both start and end references';
  end if;

  if coalesce(array_length(cleaned_exact_refs, 1), 0) = 0 and not has_range then
    raise exception 'at least one exact reference or one range is required';
  end if;

  if p_range_relationship_type not in ('exact', 'quotation', 'theme', 'allusion') then
    raise exception 'invalid range relationship type: %', p_range_relationship_type;
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

  if coalesce(array_length(cleaned_exact_refs, 1), 0) > 0 then
    foreach ref_item in array cleaned_exact_refs loop
      link_order := link_order + 1;

      insert into public.song_verse_links (
        song_id,
        verse_id,
        relationship_type,
        note,
        sort_order
      )
      select
        new_song_id,
        v.id,
        'exact',
        null,
        link_order
      from public.verses v
      where v.reference = ref_item;

      if not found then
        raise exception 'unknown exact reference: %', ref_item;
      end if;
    end loop;
  end if;

  if has_range then
    select id into start_verse_id
    from public.verses
    where reference = p_range_start_reference;

    if start_verse_id is null then
      raise exception 'unknown range start reference: %', p_range_start_reference;
    end if;

    select id into end_verse_id
    from public.verses
    where reference = p_range_end_reference;

    if end_verse_id is null then
      raise exception 'unknown range end reference: %', p_range_end_reference;
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
      start_verse_id,
      end_verse_id,
      p_range_start_reference || ' - ' || p_range_end_reference,
      p_range_relationship_type,
      null,
      100
    );
  end if;

  return new_song_id;
end;
$$;

grant execute on function public.submit_song_with_links(text, text, text, text, text, text, text[], text, text, text) to anon, authenticated;

commit;

-- Optional checks:
-- select public.submit_song_with_links('Phase 7 Test', null, null, null, null, null, array['Genesis 1:1'], null, null, 'quotation');

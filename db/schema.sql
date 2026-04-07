-- Phase 1 schema for a Tanach + songs application.
-- Target database: PostgreSQL / Supabase Postgres

create extension if not exists pgcrypto;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  book_number integer not null unique,
  canonical_name text not null unique,
  chapter_count integer not null check (chapter_count > 0),
  verse_count integer not null check (verse_count > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_number integer not null check (chapter_number > 0),
  verse_count integer not null check (verse_count > 0),
  chapter_ref text not null,
  created_at timestamptz not null default now(),
  unique (book_id, chapter_number),
  unique (chapter_ref)
);

create index if not exists chapters_book_idx
  on public.chapters (book_id, chapter_number);

create table if not exists public.verses (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  verse_number integer not null check (verse_number > 0),
  reference text not null,
  verse_text text,
  created_at timestamptz not null default now(),
  unique (chapter_id, verse_number),
  unique (reference)
);

create index if not exists verses_chapter_idx
  on public.verses (chapter_id, verse_number);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist_name text,
  composer_name text,
  source_url text,
  lyrics text,
  notes text,
  submitted_by uuid,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists songs_status_idx
  on public.songs (moderation_status, created_at desc);

create table if not exists public.song_verse_links (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  verse_id uuid not null references public.verses(id) on delete cascade,
  relationship_type text not null default 'exact'
    check (relationship_type in ('exact', 'quotation', 'theme', 'allusion')),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (song_id, verse_id, relationship_type)
);

create index if not exists song_verse_links_song_idx
  on public.song_verse_links (song_id, sort_order, verse_id);

create index if not exists song_verse_links_verse_idx
  on public.song_verse_links (verse_id, song_id);

create table if not exists public.song_verse_ranges (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  start_verse_id uuid not null references public.verses(id) on delete restrict,
  end_verse_id uuid not null references public.verses(id) on delete restrict,
  range_label text not null,
  relationship_type text not null default 'exact'
    check (relationship_type in ('exact', 'quotation', 'theme', 'allusion')),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (start_verse_id <> end_verse_id)
);

create index if not exists song_verse_ranges_song_idx
  on public.song_verse_ranges (song_id, sort_order);

create table if not exists public.profiles (
  id uuid primary key,
  display_name text,
  role text not null default 'user'
    check (role in ('user', 'editor', 'admin')),
  created_at timestamptz not null default now()
);

comment on table public.books is
  'One row per book of Tanach.';

comment on table public.chapters is
  'One row per chapter, belonging to a book.';

comment on table public.verses is
  'One row per verse, belonging to a chapter.';

comment on table public.song_verse_links is
  'Connects a song to one specific verse.';

comment on table public.song_verse_ranges is
  'Connects a song to a navigable verse span, such as Genesis 1:1-3.';

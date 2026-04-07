-- Phase 2 import workflow for normalized CSV files.
-- Run this after creating the schema in db/schema.sql.
-- Update the file paths in each COPY command to match your machine or Supabase import flow.

create temporary table staging_books (
  book_number integer,
  canonical_name text,
  chapter_count integer,
  verse_count integer
);

create temporary table staging_chapters (
  book_name text,
  chapter_number integer,
  verse_count integer,
  chapter_ref text
);

create temporary table staging_verses (
  book_name text,
  chapter_ref text,
  verse_number integer,
  reference text,
  verse_text text
);

-- Example COPY commands for local Postgres:
-- copy staging_books from '/absolute/path/to/books.csv' with (format csv, header true);
-- copy staging_chapters from '/absolute/path/to/chapters.csv' with (format csv, header true);
-- copy staging_verses from '/absolute/path/to/verses.csv' with (format csv, header true);

insert into public.books (book_number, canonical_name, chapter_count, verse_count)
select
  book_number,
  canonical_name,
  chapter_count,
  verse_count
from staging_books
order by book_number;

insert into public.chapters (book_id, chapter_number, verse_count, chapter_ref)
select
  b.id,
  sc.chapter_number,
  sc.verse_count,
  sc.chapter_ref
from staging_chapters sc
join public.books b
  on b.canonical_name = sc.book_name
order by b.book_number, sc.chapter_number;

insert into public.verses (chapter_id, verse_number, reference, verse_text)
select
  c.id,
  sv.verse_number,
  sv.reference,
  nullif(sv.verse_text, '')
from staging_verses sv
join public.chapters c
  on c.chapter_ref = sv.chapter_ref
join public.books b
  on b.id = c.book_id
 and b.canonical_name = sv.book_name
order by b.book_number, c.chapter_number, sv.verse_number;

-- Validation checks
select count(*) as books_count from public.books;
select count(*) as chapters_count from public.chapters;
select count(*) as verses_count from public.verses;

select chapter_ref, count(*) as verse_total
from public.verses v
join public.chapters c on c.id = v.chapter_id
group by chapter_ref
order by chapter_ref;

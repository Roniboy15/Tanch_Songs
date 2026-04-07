# Tanach Songs Data Model

## Short Answer

No, your current CSV files do not need to match the future database model exactly.

They were shaped for Baserow, which encouraged link-style columns and human-readable references.
For PostgreSQL, the better approach is:

- keep the CSVs as import sources
- extract only the useful columns
- load the data into a cleaner relational schema

## Core Model

The database should treat these as the core source of truth:

- `books`
- `chapters`
- `verses`
- `songs`
- `song_verse_links`
- `song_verse_ranges`

This keeps Tanach structure separate from song submissions and supports both:

- linking a song to one exact verse
- linking a song to a verse range such as `Genesis 1:1-3`

## Why The Baserow CSVs Should Be Simplified

Some current columns look like placeholders for Baserow relations:

- `Books.Chapters`
- `Books.Verses`
- `Chapters.Verses`
- `Verses.Song`

For PostgreSQL, those should not be imported as final data columns.
Instead, the relationships should come from foreign keys:

- each chapter stores `book_id`
- each verse stores `chapter_id`
- song-to-verse relations live in dedicated link tables

## How The Existing CSVs Map

### Books CSV

Use:

- `Book Name` -> `books.canonical_name`
- `Book Number` -> `books.book_number`
- `Chapter Count` -> `books.chapter_count`
- `Verse Count` -> `books.verse_count`

Ignore:

- `Verses`
- `Chapters`

### Chapters CSV

Use:

- `Book`
- `Chapter Number`
- `Verse Count`

Optional:

- `Chapter Ref`

Ignore:

- `Verses`

Note:
The `tanach_chapters_with_chapter_ref_for_baserow.csv` file is more useful than the plain chapters file because it already includes `Chapter Ref`.

### Verses CSV

Use:

- `Reference`
- `Book`
- `Chapter`
- `Verse Text` if you plan to fill it

Ignore for now:

- `Song`

Important:
The current verses CSV does not appear to have a dedicated `Verse Number` column, so during import we should derive it from the `Reference` value like `Genesis 1:4`.

## Verse Range Design

Verse ranges should be modeled explicitly, not stored only as free text.

Recommended table:

- `song_verse_ranges`
  - `song_id`
  - `start_verse_id`
  - `end_verse_id`
  - `range_label`

This gives the interface two important abilities:

- show a clean label like `Genesis 1:1-3`
- let users click into the start verse, end verse, chapter, or the whole range

## Suggested Import Order Later

When we get to phase 2, import in this order:

1. `books`
2. `chapters`
3. `verses`
4. `songs`
5. `song_verse_links`
6. `song_verse_ranges`

## Why This Is Better

This model gives you:

- cleaner SQL queries
- easier validation
- safer future changes
- better support for search and navigation
- less dependence on spreadsheet-style link columns

# Phase 2: Import Workflow

## Goal

Convert the current Baserow-oriented CSV files into clean import files for the PostgreSQL schema.

## What Changes In Phase 2

We do not import the original CSVs directly into the final tables.

Instead, we:

1. normalize the CSVs into simpler files
2. load those normalized files into staging tables
3. insert from staging into the final relational tables

This gives us a safer and more debuggable import process.

## Files Added

- `scripts/normalize_tanach_csvs.py`
- `db/import_from_normalized.sql`

## Input Files

Use these source files:

- `tanach_books_for_baserow_books_table.csv`
- `tanach_chapters_with_chapter_ref_for_baserow.csv`
- `tanach_verses_for_baserow_verses_table.csv`

The `chapters_with_chapter_ref` file is the best chapters source because it already includes a chapter reference.

## Output Files

The normalization script writes:

- `data/normalized/books.csv`
- `data/normalized/chapters.csv`
- `data/normalized/verses.csv`

These generated files are ignored by Git because they can always be recreated from the original CSVs.

## How To Run The Normalization Script

From the project root:

```bash
python3 scripts/normalize_tanach_csvs.py \
  --books "/Users/jarontreyer/Desktop/Daten für neues Parsha Songs/tanach_books_for_baserow_books_table.csv" \
  --chapters "/Users/jarontreyer/Desktop/Daten für neues Parsha Songs/tanach_chapters_with_chapter_ref_for_baserow.csv" \
  --verses "/Users/jarontreyer/Desktop/Daten für neues Parsha Songs/tanach_verses_for_baserow_verses_table.csv" \
  --out-dir data/normalized
```

## What The Script Does

### Books

Keeps:

- `Book Number`
- `Book Name`
- `Chapter Count`
- `Verse Count`

Drops:

- Baserow-style empty relation columns

### Chapters

Keeps:

- `Book`
- `Chapter Number`
- `Verse Count`
- `Chapter Ref`

### Verses

Keeps:

- `Reference`
- `Book`
- `Chapter`
- `Verse Text`

Derives:

- `verse_number` from the `Reference` field

## How To Import Into Postgres

1. Run `db/schema.sql`
2. Run the normalization script
3. Load the normalized CSVs into the three staging tables in `db/import_from_normalized.sql`
4. Insert from staging into `books`, `chapters`, and `verses`
5. Run the validation queries at the bottom

## Why Staging Tables Matter

Staging tables make import safer because they let us:

- inspect raw incoming values
- catch parsing mistakes early
- rerun inserts without rewriting the original files
- validate counts before the app depends on the data

## Git Note

The source CSVs currently live outside the repository.

That is fine for now, but later you should decide one of these:

- keep them outside the repo and treat them as private source data
- copy cleaned versions into a `data/raw/` folder in the repo

For a public GitHub repository, I would not automatically commit the raw source files until you are sure you want them public.

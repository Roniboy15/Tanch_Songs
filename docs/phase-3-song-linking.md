# Phase 3: Song Linking Workflow

## Goal

Add a safe and query-friendly linking layer so songs can be connected to:

1. one exact verse (`song_verse_links`)
2. one verse range (`song_verse_ranges`)

## File Added

- `db/phase3_song_linking.sql`

## What This SQL Adds

The script is idempotent and intended to run after:

1. `db/schema.sql`
2. Tanach data import (Phase 2)

Then it adds:

- `updated_at` trigger support for songs
- uniqueness guardrail on range links to avoid duplicate range rows
- trigger validation that range links are:
  - inside one book
  - forward ordered (`start <= end`)
- helpful indexes for song/range lookups
- demo song + demo links for validation

## How To Run

In Supabase SQL Editor or Postgres client:

```sql
-- run after schema + import
\i db/phase3_song_linking.sql
```

If your SQL client does not support `\i`, paste the file content directly and run it.

## Demo Data Inserted

The script inserts one song if missing:

- `Demo Song - Bereshit Opening`

Then it links:

- exact verse: `Genesis 1:1`
- verse range: `Genesis 1:1-3`

All demo inserts are safe to rerun due to existence checks and conflict handling.

## Validation Queries Included

At the bottom of `db/phase3_song_linking.sql` there are two checks:

1. Find songs connected to one target verse reference, including songs linked through a range that contains that verse.
2. Show all links for one song (exact + ranges) in sorted order.

## Important Notes

- `song_verse_ranges` already has `check (start_verse_id <> end_verse_id)` in `schema.sql`, so single-verse ranges are not allowed there. Use `song_verse_links` for single verse links.
- Range validation currently enforces same-book rather than same-chapter to keep broad Tanach passages possible.
- If you later want stricter moderation flow, add RLS policies on `songs`, `song_verse_links`, and `song_verse_ranges` as Phase 4.

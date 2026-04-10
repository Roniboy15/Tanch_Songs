# Phase 7: Verse-Linked Submission

## Goal

Require verse references at submission time so approved songs are always visible in the public linked feed.

## Files Added/Updated

- `db/phase7_submission_links.sql`
- `web/public/index.html`
- `web/public/app.js`

## Exactly What To Run In Supabase

1. Open SQL Editor.
2. New query.
3. Paste full content of `db/phase7_submission_links.sql`.
4. Run.

This creates RPC:

- `public.submit_song_with_links(...)`

## Submission Rules

The RPC enforces:

1. `title` is required.
2. At least one link is required:
- one or more exact references (`Genesis 1:1`)
- or one complete range (start + end)
3. Exact/range references must exist in `public.verses.reference`.
4. Song is inserted as `pending`.

## Frontend Behavior

Public form now includes:

- exact references textarea (one per line, comma also supported)
- optional range start/end references
- range relationship type selector

If a reference is invalid, the submit call fails and no partial data is written.

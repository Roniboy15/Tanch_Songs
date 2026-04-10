# Phase 7: Verse-Linked Submission (No Free Text Linking)

## Goal

Make verse linking easy and strict:

- users choose from Tanach selectors (`Book -> Chapter -> Verse`)
- users cannot type free-text references for linking

Free text remains only for fields like:

- title
- artist/composer
- source URL
- notes

## Files Added/Updated

- `db/phase7_submission_links.sql`
- `web/public/index.html`
- `web/public/app.js`
- `web/admin/app.js` (startup reliability fix)

## Exactly What To Run In Supabase

1. Open SQL Editor.
2. New query.
3. Paste full content of `db/phase7_submission_links.sql`.
4. Run.

This creates/updates:

- `public.tanach_verse_catalog` view (picker data source)
- `public.submit_song_with_links(...)` RPC (ID-based links only)

## Submission Rules

The RPC enforces:

1. `title` is required.
2. At least one link is required:
- one or more exact verse IDs
- or one complete range (start + end verse IDs)
3. Verse IDs must exist in `public.verses`.
4. Song is inserted as `pending`.

## Frontend Behavior

Public form now provides:

- exact verse selector + add/remove list
- optional range start/end selectors
- no free-text reference entry

This ensures approved songs always have valid linkable Tanach references.

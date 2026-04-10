# Phase 5: App Query Layer

## Goal

Add reusable SQL views and RPC functions so the app can:

1. read approved song links for public pages
2. show a moderation queue for admins
3. submit songs via RPC
4. approve/reject songs via RPC

## File Added

- `db/phase5_app_queries.sql`

## Exactly What To Run In Supabase

1. Open SQL Editor.
2. New query.
3. Paste full content of `db/phase5_app_queries.sql`.
4. Run.

## What Gets Created

- `public.approved_song_links` (view)
- `public.admin_song_review_queue` (view)
- `public.submit_song(...)` (function)
- `public.set_song_moderation(...)` (function)
- `songs_pending_created_idx` (partial index)

## How To Use From Supabase Client

Submit (public):

```sql
select public.submit_song(
  'My New Song',
  'Artist Name',
  null,
  'https://example.com/song',
  null,
  'User submitted this from public form'
);
```

Moderate (admin/editor session):

```sql
select (public.set_song_moderation('<SONG_UUID>', 'approved')).*;
```

## Notes

- Public submission still ends up as `pending` because Phase 4 trigger enforces it for non-admin users.
- `set_song_moderation` is protected by RLS and only works for users in `profiles.role in ('editor', 'admin')`.

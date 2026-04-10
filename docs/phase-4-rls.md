# Phase 4: RLS For Public Submission + Admin Moderation

## Goal

Allow anyone (including not logged-in users) to submit songs while keeping moderation and edits restricted to trusted roles.

## File Added

- `db/phase4_rls.sql`

## What This Phase Enforces

1. Public read access only to approved songs and their approved links/ranges.
2. Public insert access for song submissions and pending-link inserts.
3. Non-admin submissions are forced to `moderation_status = 'pending'`.
4. Only authenticated users with profile role `editor` or `admin` can:
- see all rows (including pending)
- update or delete songs/links/ranges
- approve or reject content

## Important Prerequisite

Admin/editor permissions are read from `public.profiles`.

Example to make your user an admin:

```sql
insert into public.profiles (id, display_name, role)
values ('<YOUR_AUTH_USER_UUID>', 'Jaron', 'admin')
on conflict (id)
do update set role = excluded.role, display_name = excluded.display_name;
```

You can find your auth UUID in Supabase Authentication -> Users.

## Exactly What To Run In Supabase

1. Open Supabase SQL Editor.
2. Create a new query.
3. Paste full content of `db/phase4_rls.sql`.
4. Run it.

After that, run this quick check:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename in ('songs', 'song_verse_links', 'song_verse_ranges');
```

All three should show `rowsecurity = true`.

## Notes

- Service role bypasses RLS, so server-side jobs can still moderate safely.
- RLS reduces data exposure and unauthorized writes, but app-side input validation and rate-limiting are still recommended.

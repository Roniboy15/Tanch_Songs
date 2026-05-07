# Phase 8: Review + Public UX Expansion

## Goal

Extend moderation quality and public usability:

1. Admin can fully inspect and edit pending submissions before moderation.
2. Public UI is split into focused pages for clarity and growth.
3. Search and discovery are fast and intuitive.

## Files Updated / Added

- `web/admin/index.html`
- `web/admin/app.js`
- `web/public/index.html`
- `web/public/add-song.html`
- `web/public/search-song.html`
- `web/public/common.js`
- `web/public/home.js`
- `web/public/add-song.js`
- `web/public/search-song.js`
- `web/public/assets/welcome-placeholder.svg`
- `web/shared/styles.css`

## Admin Improvements

1. Queue rows now have a `View` action with persistent detail context.
2. Selecting a song loads full detail:
   - song metadata (title, artist, composer, source, lyrics, notes, status)
   - exact links
   - range links
3. Admin can edit link verse targets directly:
   - exact: Book -> Chapter -> Verse
   - range: Book -> Start Chapter/Verse + End Chapter/Verse
4. Range label is rebuilt automatically from selected verses.
5. Admin can still remove exact/range links.
6. Detail state resets safely when pending queue empties.

## Public UX Refactor

1. Public interface is now multi-page with top navigation:
   - `Home`
   - `Add Song`
   - `Search Song`
2. Home page contains:
   - welcome container/message
   - replaceable welcome image placeholder
   - recently approved songs panel
3. Add Song page contains the full submission flow, now including `lyrics` input.
4. Search Song page contains:
   - verse-based discovery (Book/Chapter/Verse)
   - unified text search over song + link metadata
   - live search behavior after 2 characters

## Discovery / Search Behavior

1. Verse lookup returns songs linked exactly or by containing ranges.
2. Text search matches title, artist, composer, source URL, lyrics, notes, link labels, and link notes.
3. Search results update continuously while typing (>=2 characters).

## Notes

1. Public/admin access control remains enforced by existing Supabase RLS and RPC functions.
2. Welcome image can be replaced at:
   - `web/public/assets/welcome-placeholder.svg`

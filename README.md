# Tanach Songs Database

This project builds a relational Tanach database and a song-linking interface on top of it.

## Current Status

- Phase 1 complete: database schema defined
- Phase 2 complete: CSV normalization and import workflow added
- Phase 3 complete: song-to-verse linking layer added (exact + ranges)
- Phase 4 complete: RLS policies enable public submissions with admin moderation
- Phase 5 complete: app-facing views/functions for feed + moderation queue
- Phase 6 complete: web pages for submission and moderation
- Phase 7 ready: verse-linked submission flow added

## Key Files

- `db/schema.sql`
- `db/import_from_normalized.sql`
- `db/phase3_song_linking.sql`
- `db/phase4_rls.sql`
- `db/phase5_app_queries.sql`
- `db/phase7_submission_links.sql`
- `docs/data-model.md`
- `docs/phase-2-import.md`
- `docs/phase-3-song-linking.md`
- `docs/phase-4-rls.md`
- `docs/phase-5-app-queries.md`
- `docs/phase-6-frontend.md`
- `docs/phase-7-verse-link-submission.md`
- `web/public/index.html`
- `web/admin/index.html`
- `scripts/normalize_tanach_csvs.py`

# Tanach Songs Database

This project builds a relational Tanach database and a song-linking interface on top of it.

## Current Status

- Phase 1 complete: database schema defined
- Phase 2 complete: CSV normalization and import workflow added
- Phase 3 complete: song-to-verse linking layer added (exact + ranges)
- Phase 4 ready: RLS policy script prepared for public submissions + admin moderation

## Key Files

- `db/schema.sql`
- `db/import_from_normalized.sql`
- `db/phase3_song_linking.sql`
- `db/phase4_rls.sql`
- `docs/data-model.md`
- `docs/phase-2-import.md`
- `docs/phase-3-song-linking.md`
- `docs/phase-4-rls.md`
- `scripts/normalize_tanach_csvs.py`

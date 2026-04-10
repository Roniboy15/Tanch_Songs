# Phase 6: Frontend Pages (Public Submit + Admin Moderation)

## Goal

Provide a minimal frontend so you can use your Phase 4/5 backend immediately.

## Files Added

- `web/public/index.html`
- `web/public/app.js`
- `web/admin/index.html`
- `web/admin/app.js`
- `web/shared/styles.css`
- `web/shared/supabase.js`
- `web/shared/config.example.js`

## One-Time Setup

1. Copy config template:

```bash
cp web/shared/config.example.js web/shared/config.js
```

2. Edit `web/shared/config.js` and insert:
- your Supabase project URL
- your Supabase anon key

## Run Locally

From project root:

```bash
python3 -m http.server 8080
```

Open:

- Public form: `http://localhost:8080/web/public/`
- Admin queue: `http://localhost:8080/web/admin/`

## What Each Page Does

Public page:
- calls `submit_song(...)` RPC
- shows recent approved songs via `approved_song_links` view

Admin page:
- sends email magic link login
- loads `admin_song_review_queue` view
- uses `set_song_moderation(...)` RPC to approve/reject

## Important Supabase Auth Setting

In Supabase Authentication settings, add this redirect URL:

- `http://localhost:8080/web/admin/`

Without that, magic-link sign-in may fail to return to your admin page.

-- Phase 4: RLS policies for public submissions + admin moderation.
-- Goal: anyone can submit songs, but only editors/admins can moderate or edit existing rows.
-- Run this after schema.sql, phase 2 import, and phase3_song_linking.sql.

begin;

-- Helper: role check via profiles table.
create or replace function public.is_editor_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('editor', 'admin')
  );
$$;

-- Helper: check pending-song state without relying on caller's songs visibility.
create or replace function public.song_is_pending(target_song_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.songs s
    where s.id = target_song_id
      and s.moderation_status = 'pending'
  );
$$;

grant execute on function public.is_editor_or_admin() to anon, authenticated;
grant execute on function public.song_is_pending(uuid) to anon, authenticated;

-- Guardrail: non-admin inserts are always forced to pending.
create or replace function public.force_pending_song_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_editor_or_admin() then
    new.moderation_status := 'pending';
  end if;

  if auth.uid() is not null and new.submitted_by is null then
    new.submitted_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_force_pending_song_submission on public.songs;
create trigger trg_force_pending_song_submission
before insert on public.songs
for each row
execute function public.force_pending_song_submission();

alter table public.songs enable row level security;
alter table public.song_verse_links enable row level security;
alter table public.song_verse_ranges enable row level security;

-- SONGS policies

drop policy if exists songs_select_approved_public on public.songs;
create policy songs_select_approved_public
  on public.songs
  for select
  to anon, authenticated
  using (moderation_status = 'approved');

drop policy if exists songs_select_admin_all on public.songs;
create policy songs_select_admin_all
  on public.songs
  for select
  to authenticated
  using (public.is_editor_or_admin());

drop policy if exists songs_insert_public_pending on public.songs;
create policy songs_insert_public_pending
  on public.songs
  for insert
  to anon, authenticated
  with check (moderation_status = 'pending');

drop policy if exists songs_update_admin_only on public.songs;
create policy songs_update_admin_only
  on public.songs
  for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

drop policy if exists songs_delete_admin_only on public.songs;
create policy songs_delete_admin_only
  on public.songs
  for delete
  to authenticated
  using (public.is_editor_or_admin());

-- EXACT LINKS policies

drop policy if exists song_verse_links_select_approved_public on public.song_verse_links;
create policy song_verse_links_select_approved_public
  on public.song_verse_links
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.songs s
      where s.id = song_verse_links.song_id
        and s.moderation_status = 'approved'
    )
  );

drop policy if exists song_verse_links_select_admin_all on public.song_verse_links;
create policy song_verse_links_select_admin_all
  on public.song_verse_links
  for select
  to authenticated
  using (public.is_editor_or_admin());

drop policy if exists song_verse_links_insert_public_pending_song on public.song_verse_links;
create policy song_verse_links_insert_public_pending_song
  on public.song_verse_links
  for insert
  to anon, authenticated
  with check (public.song_is_pending(song_id));

drop policy if exists song_verse_links_insert_admin on public.song_verse_links;
create policy song_verse_links_insert_admin
  on public.song_verse_links
  for insert
  to authenticated
  with check (public.is_editor_or_admin());

drop policy if exists song_verse_links_update_admin_only on public.song_verse_links;
create policy song_verse_links_update_admin_only
  on public.song_verse_links
  for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

drop policy if exists song_verse_links_delete_admin_only on public.song_verse_links;
create policy song_verse_links_delete_admin_only
  on public.song_verse_links
  for delete
  to authenticated
  using (public.is_editor_or_admin());

-- RANGE LINKS policies

drop policy if exists song_verse_ranges_select_approved_public on public.song_verse_ranges;
create policy song_verse_ranges_select_approved_public
  on public.song_verse_ranges
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.songs s
      where s.id = song_verse_ranges.song_id
        and s.moderation_status = 'approved'
    )
  );

drop policy if exists song_verse_ranges_select_admin_all on public.song_verse_ranges;
create policy song_verse_ranges_select_admin_all
  on public.song_verse_ranges
  for select
  to authenticated
  using (public.is_editor_or_admin());

drop policy if exists song_verse_ranges_insert_public_pending_song on public.song_verse_ranges;
create policy song_verse_ranges_insert_public_pending_song
  on public.song_verse_ranges
  for insert
  to anon, authenticated
  with check (public.song_is_pending(song_id));

drop policy if exists song_verse_ranges_insert_admin on public.song_verse_ranges;
create policy song_verse_ranges_insert_admin
  on public.song_verse_ranges
  for insert
  to authenticated
  with check (public.is_editor_or_admin());

drop policy if exists song_verse_ranges_update_admin_only on public.song_verse_ranges;
create policy song_verse_ranges_update_admin_only
  on public.song_verse_ranges
  for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

drop policy if exists song_verse_ranges_delete_admin_only on public.song_verse_ranges;
create policy song_verse_ranges_delete_admin_only
  on public.song_verse_ranges
  for delete
  to authenticated
  using (public.is_editor_or_admin());

commit;

-- Verification helpers (run manually):
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('songs','song_verse_links','song_verse_ranges');
-- select policyname, tablename, cmd, roles from pg_policies where schemaname = 'public' and tablename in ('songs','song_verse_links','song_verse_ranges') order by tablename, policyname;

import { supabase, formatDate } from '../shared/supabase.js';

export { supabase, formatDate };

export function setStatus(el, text, tone = 'warn') {
  if (!el) return;
  el.textContent = text;
  el.className = `status ${tone}`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function toSafeExternalUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch (_) {
    return null;
  }
}

export function setOptions(selectEl, options, getLabel, getValue, includeBlank = false) {
  if (!selectEl) return;
  const oldValue = selectEl.value;
  selectEl.innerHTML = '';

  if (includeBlank) {
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '-- choose --';
    selectEl.appendChild(blank);
  }

  for (const option of options) {
    const el = document.createElement('option');
    el.value = getValue(option);
    el.textContent = getLabel(option);
    selectEl.appendChild(el);
  }

  if (oldValue && Array.from(selectEl.options).some((o) => o.value === oldValue)) {
    selectEl.value = oldValue;
  }
}

export async function fetchBooks() {
  const { data, error } = await supabase
    .from('books')
    .select('id, book_number, canonical_name')
    .order('book_number', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchChapters(bookId) {
  if (!bookId) return [];
  const { data, error } = await supabase
    .from('chapters')
    .select('id, chapter_number')
    .eq('book_id', bookId)
    .order('chapter_number', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchVerses(chapterId) {
  if (!chapterId) return [];
  const { data, error } = await supabase
    .from('verses')
    .select('id, reference, verse_number')
    .eq('chapter_id', chapterId)
    .order('verse_number', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchVerseCatalogById(verseId) {
  const { data, error } = await supabase
    .from('tanach_verse_catalog')
    .select('verse_id, reference, book_number, chapter_number, verse_number')
    .eq('verse_id', verseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export function dedupeLabels(rows) {
  const seen = new Set();
  const labels = [];
  for (const row of rows) {
    const label = row.link_kind === 'range' ? `Range: ${row.link_label}` : row.link_label;
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

export function songCardHtml(song, links) {
  const artist = song.artist_name ? ` • ${escapeHtml(song.artist_name)}` : '';
  const safeUrl = toSafeExternalUrl(song.source_url);
  const sourceHtml = safeUrl
    ? `<p><a class="source-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">Open Song Source</a></p>`
    : '<p><small>No source URL provided.</small></p>';
  const linkChips = (links ?? [])
    .map((link) => `<span class="pill approved">${escapeHtml(link)}</span>`)
    .join(' ');

  return `<article class="approved-song-card">
    <p><strong>${escapeHtml(song.title)}</strong>${artist}<br /><small>${escapeHtml(formatDate(song.song_created_at || song.created_at))}</small></p>
    ${sourceHtml}
    ${linkChips ? `<p class="approved-links">${linkChips}</p>` : ''}
  </article>`;
}

export function renderSongCards(targetEl, entries, emptyText) {
  if (!targetEl) return;
  if (!entries.length) {
    targetEl.innerHTML = `<p>${escapeHtml(emptyText)}</p>`;
    return;
  }
  targetEl.innerHTML = entries.map(({ song, links }) => songCardHtml(song, links)).join('');
}

function compareChapterVerse(chapterA, verseA, chapterB, verseB) {
  if (chapterA < chapterB) return -1;
  if (chapterA > chapterB) return 1;
  if (verseA < verseB) return -1;
  if (verseA > verseB) return 1;
  return 0;
}

export function rowContainsVerse(row, targetBook, targetChapter, targetVerse) {
  if (row.start_book_number !== targetBook || row.end_book_number !== targetBook) {
    return false;
  }

  const startsBeforeOrAt = compareChapterVerse(
    row.start_chapter_number,
    row.start_verse_number,
    targetChapter,
    targetVerse
  ) <= 0;

  const endsAfterOrAt = compareChapterVerse(
    row.end_chapter_number,
    row.end_verse_number,
    targetChapter,
    targetVerse
  ) >= 0;

  return startsBeforeOrAt && endsAfterOrAt;
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase();
}

function buildSearchBlob(song, linkedRows) {
  const linkedText = linkedRows
    .map((row) => `${row.link_label || ''} ${row.relationship_type || ''} ${row.note || ''}`)
    .join(' ');

  return normalizeText(
    [
      song.title,
      song.artist_name,
      song.composer_name,
      song.source_url,
      song.lyrics,
      song.notes,
      linkedText
    ].join(' ')
  );
}

export async function loadApprovedData() {
  const [linksRes, songsRes] = await Promise.all([
    supabase
      .from('approved_song_links')
      .select('song_id, title, artist_name, composer_name, source_url, song_created_at, link_kind, relationship_type, note, sort_order, link_label, start_book_number, start_chapter_number, start_verse_number, end_book_number, end_chapter_number, end_verse_number')
      .order('song_created_at', { ascending: false })
      .order('sort_order', { ascending: true }),
    supabase
      .from('songs')
      .select('id, title, artist_name, composer_name, source_url, lyrics, notes, created_at')
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })
  ]);

  if (linksRes.error) throw new Error(linksRes.error.message);
  if (songsRes.error) throw new Error(songsRes.error.message);

  const approvedLinkRows = linksRes.data ?? [];
  const linksBySongId = new Map();
  for (const row of approvedLinkRows) {
    if (!linksBySongId.has(row.song_id)) linksBySongId.set(row.song_id, []);
    linksBySongId.get(row.song_id).push(row);
  }

  const approvedSongsById = new Map();
  for (const song of songsRes.data ?? []) {
    approvedSongsById.set(song.id, { ...song });
  }

  for (const row of approvedLinkRows) {
    if (!approvedSongsById.has(row.song_id)) {
      approvedSongsById.set(row.song_id, {
        id: row.song_id,
        title: row.title,
        artist_name: row.artist_name,
        composer_name: row.composer_name,
        source_url: row.source_url,
        lyrics: null,
        notes: null,
        created_at: row.song_created_at
      });
    }
  }

  for (const [songId, song] of approvedSongsById.entries()) {
    const linkedRows = linksBySongId.get(songId) ?? [];
    song._searchBlob = buildSearchBlob(song, linkedRows);
  }

  return { approvedLinkRows, approvedSongsById, linksBySongId };
}

export function buildRecentEntries(approvedLinkRows) {
  const songsById = new Map();
  for (const row of approvedLinkRows) {
    if (!songsById.has(row.song_id)) {
      songsById.set(row.song_id, {
        song: {
          id: row.song_id,
          title: row.title,
          artist_name: row.artist_name,
          composer_name: row.composer_name,
          source_url: row.source_url,
          song_created_at: row.song_created_at
        },
        rows: []
      });
    }
    songsById.get(row.song_id).rows.push(row);
  }

  return Array.from(songsById.values()).map((item) => ({
    song: item.song,
    links: dedupeLabels(item.rows)
  }));
}

export function findEntriesForVerse(verse, approvedLinkRows, approvedSongsById) {
  const matches = approvedLinkRows.filter((row) =>
    rowContainsVerse(row, verse.book_number, verse.chapter_number, verse.verse_number)
  );

  const grouped = new Map();
  for (const row of matches) {
    if (!grouped.has(row.song_id)) grouped.set(row.song_id, []);
    grouped.get(row.song_id).push(row);
  }

  return Array.from(grouped.entries())
    .map(([songId, rows]) => {
      const song = approvedSongsById.get(songId) ?? {
        id: songId,
        title: rows[0]?.title || '(untitled)',
        artist_name: rows[0]?.artist_name || null,
        source_url: rows[0]?.source_url || null,
        created_at: rows[0]?.song_created_at || null
      };
      return { song, links: dedupeLabels(rows) };
    })
    .sort((a, b) => {
      const aDate = String(a.song.created_at || a.song.song_created_at || '');
      const bDate = String(b.song.created_at || b.song.song_created_at || '');
      return bDate.localeCompare(aDate);
    });
}

export function findEntriesBySearch(rawQuery, approvedSongsById, linksBySongId) {
  const terms = normalizeText(rawQuery).split(/\s+/).filter(Boolean);
  const matches = [];

  for (const [songId, song] of approvedSongsById.entries()) {
    const haystack = song._searchBlob || '';
    const isMatch = terms.every((term) => haystack.includes(term));
    if (!isMatch) continue;
    matches.push({
      song,
      links: dedupeLabels(linksBySongId.get(songId) ?? [])
    });
  }

  return matches.sort((a, b) => {
    const aDate = String(a.song.created_at || a.song.song_created_at || '');
    const bDate = String(b.song.created_at || b.song.song_created_at || '');
    return bDate.localeCompare(aDate);
  });
}

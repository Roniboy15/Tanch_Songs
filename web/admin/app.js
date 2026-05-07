import { supabase, formatDate } from '../shared/supabase.js';

window.__adminAppBooted = true;

const RELATIONSHIP_TYPES = ['exact', 'quotation', 'theme', 'allusion'];

const emailInput = document.getElementById('admin-email');
const sendLinkBtn = document.getElementById('send-link');
const logoutBtn = document.getElementById('logout');
const authStatus = document.getElementById('auth-status');
const queueBody = document.getElementById('queue-body');
const refreshQueueBtn = document.getElementById('refresh-queue');
const detailStatus = document.getElementById('detail-status');
const songMeta = document.getElementById('song-meta');
const detailExact = document.getElementById('detail-exact');
const detailRanges = document.getElementById('detail-ranges');

let selectedSongId = null;
let booksCache = [];
const chaptersCache = new Map();
const versesCache = new Map();

function setAuthStatus(text, tone = 'warn') {
  authStatus.textContent = text;
  authStatus.className = `status ${tone}`;
}

function setDetailStatus(text, tone = 'warn') {
  detailStatus.textContent = text;
  detailStatus.className = `status ${tone}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function optionalText(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed.length ? trimmed : null;
}

function relationshipOptions(selected) {
  return RELATIONSHIP_TYPES
    .map((value) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${value}</option>`)
    .join('');
}

function setOptions(selectEl, options, getLabel, getValue, includeBlank = false) {
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

async function fetchBooks() {
  const { data, error } = await supabase
    .from('books')
    .select('id, book_number, canonical_name')
    .order('book_number', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchChapters(bookId) {
  if (!bookId) return [];
  const { data, error } = await supabase
    .from('chapters')
    .select('id, chapter_number')
    .eq('book_id', bookId)
    .order('chapter_number', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchVerses(chapterId) {
  if (!chapterId) return [];
  const { data, error } = await supabase
    .from('verses')
    .select('id, reference, verse_number')
    .eq('chapter_id', chapterId)
    .order('verse_number', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function ensureBooksCache() {
  if (!booksCache.length) {
    booksCache = await fetchBooks();
  }
  return booksCache;
}

async function getChaptersForBook(bookId) {
  if (!bookId) return [];
  if (!chaptersCache.has(bookId)) {
    chaptersCache.set(bookId, await fetchChapters(bookId));
  }
  return chaptersCache.get(bookId) ?? [];
}

async function getVersesForChapter(chapterId) {
  if (!chapterId) return [];
  if (!versesCache.has(chapterId)) {
    versesCache.set(chapterId, await fetchVerses(chapterId));
  }
  return versesCache.get(chapterId) ?? [];
}

function buildRangeLabel(startReference, endReference) {
  return `${startReference} - ${endReference}`;
}

function renderEmptyDetail() {
  songMeta.innerHTML = '';
  detailExact.innerHTML = '<p>No song selected.</p>';
  detailRanges.innerHTML = '<p>No song selected.</p>';
}

async function requireSessionMessage() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setAuthStatus(`Session check failed: ${error.message}`, 'error');
    return;
  }

  if (data.session) {
    setAuthStatus(`Signed in as ${data.session.user.email}`, 'ok');
  } else {
    setAuthStatus('Not signed in. Use magic link with your admin email.', 'warn');
  }
}

async function sendMagicLink() {
  const email = emailInput.value.trim();
  if (!email) {
    setAuthStatus('Enter an email first.', 'error');
    return;
  }

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  setAuthStatus(`Sending magic link to ${email}...`, 'warn');
  sendLinkBtn.disabled = true;

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });

    if (error) {
      console.error('Magic link send failed', { email, redirectTo, error });
      setAuthStatus(`Could not send magic link: ${error.message}`, 'error');
      return;
    }

    console.info('Magic link request sent', { email, redirectTo });
    setAuthStatus('Magic link sent. Check inbox/spam and open it in this browser.', 'ok');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Magic link request threw', { email, redirectTo, error });
    setAuthStatus(`Could not send magic link: ${message}`, 'error');
  } finally {
    sendLinkBtn.disabled = false;
  }
}

async function loadQueue() {
  const { data, error } = await supabase
    .from('admin_song_review_queue')
    .select('id, title, moderation_status, total_link_count, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    queueBody.innerHTML = `<tr><td colspan="5" class="status error">${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data?.length) {
    queueBody.innerHTML = '<tr><td colspan="5">No pending songs.</td></tr>';
    if (selectedSongId) {
      selectedSongId = null;
      setDetailStatus('No pending songs left.', 'ok');
      renderEmptyDetail();
    }
    return;
  }

  const pendingIds = new Set(data.map((row) => row.id));
  if (selectedSongId && !pendingIds.has(selectedSongId)) {
    selectedSongId = null;
    setDetailStatus('Selected song is no longer pending. Choose another pending song.', 'warn');
    renderEmptyDetail();
  }

  queueBody.innerHTML = data
    .map(
      (row) => `<tr data-song-row="${row.id}">
        <td>${escapeHtml(row.title)}</td>
        <td><span class="pill pending">${escapeHtml(row.moderation_status)}</span></td>
        <td>${row.total_link_count}</td>
        <td>${escapeHtml(formatDate(row.created_at))}</td>
        <td>
          <div class="actions">
            <button class="secondary" data-id="${row.id}" data-action="view">View</button>
            <button data-id="${row.id}" data-action="approved">Approve</button>
            <button class="secondary" data-id="${row.id}" data-action="rejected">Reject</button>
          </div>
        </td>
      </tr>`
    )
    .join('');
}

async function fetchSongDetail(songId) {
  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('id, title, artist_name, composer_name, source_url, lyrics, notes, moderation_status, created_at')
    .eq('id', songId)
    .maybeSingle();

  if (songError) {
    throw new Error(songError.message);
  }

  if (!song) {
    throw new Error('Song not found or no access');
  }

  const { data: exactLinks, error: exactError } = await supabase
    .from('song_verse_links')
    .select('id, verse_id, relationship_type, note, sort_order')
    .eq('song_id', songId)
    .order('sort_order', { ascending: true });

  if (exactError) {
    throw new Error(exactError.message);
  }

  const { data: rangeLinks, error: rangeError } = await supabase
    .from('song_verse_ranges')
    .select('id, start_verse_id, end_verse_id, range_label, relationship_type, note, sort_order')
    .eq('song_id', songId)
    .order('sort_order', { ascending: true });

  if (rangeError) {
    throw new Error(rangeError.message);
  }

  const verseIds = new Set();
  for (const link of exactLinks ?? []) verseIds.add(link.verse_id);
  for (const range of rangeLinks ?? []) {
    verseIds.add(range.start_verse_id);
    verseIds.add(range.end_verse_id);
  }

  const verseMap = new Map();
  const chapterIds = new Set();

  if (verseIds.size > 0) {
    const { data: verses, error: verseError } = await supabase
      .from('verses')
      .select('id, reference, chapter_id, verse_number')
      .in('id', Array.from(verseIds));

    if (verseError) {
      throw new Error(verseError.message);
    }

    for (const verse of verses ?? []) {
      verseMap.set(verse.id, verse);
      chapterIds.add(verse.chapter_id);
    }
  }

  const chapterMap = new Map();
  if (chapterIds.size > 0) {
    const { data: chapters, error: chapterError } = await supabase
      .from('chapters')
      .select('id, book_id, chapter_number')
      .in('id', Array.from(chapterIds));

    if (chapterError) {
      throw new Error(chapterError.message);
    }

    for (const chapter of chapters ?? []) {
      chapterMap.set(chapter.id, chapter);
    }
  }

  return {
    song,
    exactLinks: (exactLinks ?? []).map((link) => {
      const verse = verseMap.get(link.verse_id);
      const chapter = verse ? chapterMap.get(verse.chapter_id) : null;
      return {
        ...link,
        reference: verse?.reference || '(missing reference)',
        book_id: chapter?.book_id || null,
        chapter_id: verse?.chapter_id || null
      };
    }),
    rangeLinks: (rangeLinks ?? []).map((range) => {
      const startVerse = verseMap.get(range.start_verse_id);
      const endVerse = verseMap.get(range.end_verse_id);
      const startChapter = startVerse ? chapterMap.get(startVerse.chapter_id) : null;
      const endChapter = endVerse ? chapterMap.get(endVerse.chapter_id) : null;

      return {
        ...range,
        start_reference: startVerse?.reference || '(missing start)',
        end_reference: endVerse?.reference || '(missing end)',
        book_id: startChapter?.book_id || endChapter?.book_id || null,
        start_chapter_id: startVerse?.chapter_id || null,
        end_chapter_id: endVerse?.chapter_id || null
      };
    })
  };
}

function renderSongMeta(song) {
  songMeta.innerHTML = `
    <form id="song-edit-form" class="detail-edit-form">
      <label for="edit-title">Title</label>
      <input id="edit-title" name="title" maxlength="180" required value="${escapeHtml(song.title)}" />

      <div class="row">
        <div>
          <label for="edit-artist">Artist</label>
          <input id="edit-artist" name="artist_name" maxlength="180" value="${escapeHtml(song.artist_name || '')}" />
        </div>
        <div>
          <label for="edit-composer">Composer</label>
          <input id="edit-composer" name="composer_name" maxlength="180" value="${escapeHtml(song.composer_name || '')}" />
        </div>
      </div>

      <label for="edit-source-url">Source URL</label>
      <input id="edit-source-url" name="source_url" type="url" maxlength="300" value="${escapeHtml(song.source_url || '')}" />

      <label for="edit-lyrics">Lyrics</label>
      <textarea id="edit-lyrics" name="lyrics" maxlength="10000">${escapeHtml(song.lyrics || '')}</textarea>

      <label for="edit-notes">Notes</label>
      <textarea id="edit-notes" name="notes" maxlength="2000">${escapeHtml(song.notes || '')}</textarea>

      <label for="edit-status">Moderation Status</label>
      <select id="edit-status" name="moderation_status">
        <option value="pending" ${song.moderation_status === 'pending' ? 'selected' : ''}>pending</option>
        <option value="approved" ${song.moderation_status === 'approved' ? 'selected' : ''}>approved</option>
        <option value="rejected" ${song.moderation_status === 'rejected' ? 'selected' : ''}>rejected</option>
      </select>

      <p><small>Submitted: ${escapeHtml(formatDate(song.created_at))}</small></p>

      <div class="actions">
        <button type="submit">Save Song Fields</button>
      </div>
    </form>
  `;
}

function renderExactLinks(links) {
  if (!links.length) {
    detailExact.innerHTML = '<p>No exact links.</p>';
    return;
  }

  detailExact.innerHTML = links
    .map(
      (link) => `<form class="detail-edit-form" data-exact-id="${link.id}" data-current-book-id="${escapeHtml(link.book_id || '')}" data-current-chapter-id="${escapeHtml(link.chapter_id || '')}" data-current-verse-id="${escapeHtml(link.verse_id || '')}">
        <p><strong>Current: ${escapeHtml(link.reference)}</strong></p>

        <div class="row">
          <div>
            <label>Book</label>
            <select name="book_id"></select>
          </div>
          <div>
            <label>Chapter</label>
            <select name="chapter_id"></select>
          </div>
        </div>

        <label>Verse</label>
        <select name="verse_id"></select>

        <div class="row">
          <div>
            <label>Relationship</label>
            <select name="relationship_type">${relationshipOptions(link.relationship_type)}</select>
          </div>
          <div>
            <label>Sort Order</label>
            <input name="sort_order" type="number" min="0" step="1" value="${link.sort_order}" />
          </div>
        </div>

        <label>Note</label>
        <input name="note" maxlength="500" value="${escapeHtml(link.note || '')}" />

        <div class="actions">
          <button type="submit">Save Exact Link</button>
          <button class="secondary" type="button" data-remove-exact="${link.id}">Remove Exact Link</button>
        </div>
      </form>`
    )
    .join('');
}

function renderRangeLinks(ranges) {
  if (!ranges.length) {
    detailRanges.innerHTML = '<p>No range links.</p>';
    return;
  }

  detailRanges.innerHTML = ranges
    .map(
      (range) => `<form class="detail-edit-form" data-range-id="${range.id}" data-current-book-id="${escapeHtml(range.book_id || '')}" data-current-start-chapter-id="${escapeHtml(range.start_chapter_id || '')}" data-current-end-chapter-id="${escapeHtml(range.end_chapter_id || '')}" data-current-start-verse-id="${escapeHtml(range.start_verse_id || '')}" data-current-end-verse-id="${escapeHtml(range.end_verse_id || '')}">
        <p><strong>Current: ${escapeHtml(range.start_reference)} -> ${escapeHtml(range.end_reference)}</strong></p>

        <label>Book</label>
        <select name="book_id"></select>

        <div class="row">
          <div>
            <label>Start Chapter</label>
            <select name="start_chapter_id"></select>
          </div>
          <div>
            <label>Start Verse</label>
            <select name="start_verse_id"></select>
          </div>
        </div>

        <div class="row">
          <div>
            <label>End Chapter</label>
            <select name="end_chapter_id"></select>
          </div>
          <div>
            <label>End Verse</label>
            <select name="end_verse_id"></select>
          </div>
        </div>

        <label>Range Label (auto)</label>
        <input name="range_label_preview" readonly value="${escapeHtml(range.range_label)}" />

        <div class="row">
          <div>
            <label>Relationship</label>
            <select name="relationship_type">${relationshipOptions(range.relationship_type)}</select>
          </div>
          <div>
            <label>Sort Order</label>
            <input name="sort_order" type="number" min="0" step="1" value="${range.sort_order}" />
          </div>
        </div>

        <label>Note</label>
        <input name="note" maxlength="500" value="${escapeHtml(range.note || '')}" />

        <div class="actions">
          <button type="submit">Save Range Link</button>
          <button class="secondary" type="button" data-remove-range="${range.id}">Remove Range Link</button>
        </div>
      </form>`
    )
    .join('');
}

function setSelectToFirstIfEmpty(selectEl) {
  if (!selectEl.value && selectEl.options.length > 0) {
    selectEl.value = selectEl.options[0].value;
  }
}

async function refreshExactChapters(formEl, preferredChapterId = null, preferredVerseId = null) {
  const bookSelect = formEl.querySelector('select[name="book_id"]');
  const chapterSelect = formEl.querySelector('select[name="chapter_id"]');
  const verseSelect = formEl.querySelector('select[name="verse_id"]');
  if (!(bookSelect && chapterSelect && verseSelect)) return;

  const chapters = await getChaptersForBook(bookSelect.value);
  setOptions(chapterSelect, chapters, (c) => `Chapter ${c.chapter_number}`, (c) => c.id, false);

  if (preferredChapterId && chapters.some((c) => c.id === preferredChapterId)) {
    chapterSelect.value = preferredChapterId;
  }
  setSelectToFirstIfEmpty(chapterSelect);

  await refreshExactVerses(formEl, preferredVerseId);
}

async function refreshExactVerses(formEl, preferredVerseId = null) {
  const chapterSelect = formEl.querySelector('select[name="chapter_id"]');
  const verseSelect = formEl.querySelector('select[name="verse_id"]');
  if (!(chapterSelect && verseSelect)) return;

  const verses = await getVersesForChapter(chapterSelect.value);
  setOptions(verseSelect, verses, (v) => v.reference, (v) => v.id, false);

  if (preferredVerseId && verses.some((v) => v.id === preferredVerseId)) {
    verseSelect.value = preferredVerseId;
  }
  setSelectToFirstIfEmpty(verseSelect);
}

async function hydrateExactForm(formEl) {
  const bookSelect = formEl.querySelector('select[name="book_id"]');
  if (!bookSelect) return;

  const books = await ensureBooksCache();
  setOptions(bookSelect, books, (b) => b.canonical_name, (b) => b.id, false);

  const preferredBookId = formEl.dataset.currentBookId;
  if (preferredBookId && books.some((b) => b.id === preferredBookId)) {
    bookSelect.value = preferredBookId;
  }
  setSelectToFirstIfEmpty(bookSelect);

  await refreshExactChapters(formEl, formEl.dataset.currentChapterId, formEl.dataset.currentVerseId);
}

async function refreshRangeVerses(formEl, side, preferredVerseId = null) {
  const chapterSelect = formEl.querySelector(`select[name="${side}_chapter_id"]`);
  const verseSelect = formEl.querySelector(`select[name="${side}_verse_id"]`);
  if (!(chapterSelect && verseSelect)) return;

  const verses = await getVersesForChapter(chapterSelect.value);
  setOptions(verseSelect, verses, (v) => v.reference, (v) => v.id, false);

  if (preferredVerseId && verses.some((v) => v.id === preferredVerseId)) {
    verseSelect.value = preferredVerseId;
  }
  setSelectToFirstIfEmpty(verseSelect);
}

async function refreshRangeChapters(formEl, side, preferredChapterId = null, preferredVerseId = null) {
  const bookSelect = formEl.querySelector('select[name="book_id"]');
  const chapterSelect = formEl.querySelector(`select[name="${side}_chapter_id"]`);
  if (!(bookSelect && chapterSelect)) return;

  const chapters = await getChaptersForBook(bookSelect.value);
  setOptions(chapterSelect, chapters, (c) => `Chapter ${c.chapter_number}`, (c) => c.id, false);

  if (preferredChapterId && chapters.some((c) => c.id === preferredChapterId)) {
    chapterSelect.value = preferredChapterId;
  }
  setSelectToFirstIfEmpty(chapterSelect);

  await refreshRangeVerses(formEl, side, preferredVerseId);
}

async function hydrateRangeForm(formEl) {
  const bookSelect = formEl.querySelector('select[name="book_id"]');
  if (!bookSelect) return;

  const books = await ensureBooksCache();
  setOptions(bookSelect, books, (b) => b.canonical_name, (b) => b.id, false);

  const preferredBookId = formEl.dataset.currentBookId;
  if (preferredBookId && books.some((b) => b.id === preferredBookId)) {
    bookSelect.value = preferredBookId;
  }
  setSelectToFirstIfEmpty(bookSelect);

  await refreshRangeChapters(formEl, 'start', formEl.dataset.currentStartChapterId, formEl.dataset.currentStartVerseId);
  await refreshRangeChapters(formEl, 'end', formEl.dataset.currentEndChapterId, formEl.dataset.currentEndVerseId);
  await updateRangePreview(formEl);
}

async function updateRangePreview(formEl) {
  const previewEl = formEl.querySelector('input[name="range_label_preview"]');
  const startVerseId = String(new FormData(formEl).get('start_verse_id') || '');
  const endVerseId = String(new FormData(formEl).get('end_verse_id') || '');

  if (!previewEl || !startVerseId || !endVerseId) return;

  const verseIds = [startVerseId, endVerseId];
  const { data, error } = await supabase
    .from('verses')
    .select('id, reference')
    .in('id', verseIds);

  if (error) {
    setDetailStatus(`Could not preview range label: ${error.message}`, 'error');
    return;
  }

  const refMap = new Map((data ?? []).map((row) => [row.id, row.reference]));
  const startReference = refMap.get(startVerseId);
  const endReference = refMap.get(endVerseId);

  if (startReference && endReference) {
    previewEl.value = buildRangeLabel(startReference, endReference);
  }
}

async function hydrateDetailSelectors() {
  const exactForms = Array.from(detailExact.querySelectorAll('form[data-exact-id]'));
  const rangeForms = Array.from(detailRanges.querySelectorAll('form[data-range-id]'));

  for (const formEl of exactForms) {
    await hydrateExactForm(formEl);
  }

  for (const formEl of rangeForms) {
    await hydrateRangeForm(formEl);
  }
}

async function selectSong(songId) {
  selectedSongId = songId;
  setDetailStatus('Loading detail...', 'warn');

  try {
    const detail = await fetchSongDetail(songId);
    renderSongMeta(detail.song);
    renderExactLinks(detail.exactLinks);
    renderRangeLinks(detail.rangeLinks);
    await hydrateDetailSelectors();
    setDetailStatus('Detail loaded. You can review and edit all fields before moderation.', 'ok');
  } catch (error) {
    renderEmptyDetail();
    setDetailStatus(`Could not load detail: ${error.message}`, 'error');
  }
}

async function saveSongFields(formEl) {
  if (!selectedSongId) {
    setDetailStatus('Select a song first.', 'error');
    return;
  }

  const formData = new FormData(formEl);
  const title = String(formData.get('title') || '').trim();
  const moderationStatus = String(formData.get('moderation_status') || 'pending').trim();

  if (!title) {
    setDetailStatus('Title cannot be empty.', 'error');
    return;
  }

  if (!['pending', 'approved', 'rejected'].includes(moderationStatus)) {
    setDetailStatus('Invalid moderation status.', 'error');
    return;
  }

  const payload = {
    title,
    artist_name: optionalText(formData.get('artist_name')),
    composer_name: optionalText(formData.get('composer_name')),
    source_url: optionalText(formData.get('source_url')),
    lyrics: optionalText(formData.get('lyrics')),
    notes: optionalText(formData.get('notes')),
    moderation_status: moderationStatus
  };

  const { error } = await supabase
    .from('songs')
    .update(payload)
    .eq('id', selectedSongId);

  if (error) {
    setDetailStatus(`Save song failed: ${error.message}`, 'error');
    return;
  }

  setDetailStatus('Song fields saved.', 'ok');
  await loadQueue();

  if (selectedSongId) {
    await selectSong(selectedSongId);
  }
}

async function saveExactLink(formEl) {
  const linkId = formEl.dataset.exactId;
  if (!linkId) return;

  const formData = new FormData(formEl);
  const relationshipType = String(formData.get('relationship_type') || 'exact').trim();
  const verseId = String(formData.get('verse_id') || '').trim();
  const parsedSort = Number.parseInt(String(formData.get('sort_order') || '0'), 10);

  if (!verseId) {
    setDetailStatus('Choose a verse for this exact link.', 'error');
    return;
  }

  if (!RELATIONSHIP_TYPES.includes(relationshipType)) {
    setDetailStatus('Invalid exact-link relationship type.', 'error');
    return;
  }

  const payload = {
    verse_id: verseId,
    relationship_type: relationshipType,
    note: optionalText(formData.get('note')),
    sort_order: Number.isFinite(parsedSort) && parsedSort >= 0 ? parsedSort : 0
  };

  const { error } = await supabase
    .from('song_verse_links')
    .update(payload)
    .eq('id', linkId);

  if (error) {
    setDetailStatus(`Save exact link failed: ${error.message}`, 'error');
    return;
  }

  setDetailStatus('Exact link updated.', 'ok');
  if (selectedSongId) {
    await selectSong(selectedSongId);
    await loadQueue();
  }
}

async function saveRangeLink(formEl) {
  const rangeId = formEl.dataset.rangeId;
  if (!rangeId) return;

  const formData = new FormData(formEl);
  const relationshipType = String(formData.get('relationship_type') || 'exact').trim();
  const startVerseId = String(formData.get('start_verse_id') || '').trim();
  const endVerseId = String(formData.get('end_verse_id') || '').trim();
  const parsedSort = Number.parseInt(String(formData.get('sort_order') || '0'), 10);

  if (!startVerseId || !endVerseId) {
    setDetailStatus('Select both range start and range end verses.', 'error');
    return;
  }

  if (startVerseId === endVerseId) {
    setDetailStatus('Range start and end cannot be the same verse.', 'error');
    return;
  }

  if (!RELATIONSHIP_TYPES.includes(relationshipType)) {
    setDetailStatus('Invalid range relationship type.', 'error');
    return;
  }

  const { data: verses, error: verseError } = await supabase
    .from('verses')
    .select('id, reference')
    .in('id', [startVerseId, endVerseId]);

  if (verseError) {
    setDetailStatus(`Could not validate range verses: ${verseError.message}`, 'error');
    return;
  }

  const refMap = new Map((verses ?? []).map((row) => [row.id, row.reference]));
  const startReference = refMap.get(startVerseId);
  const endReference = refMap.get(endVerseId);

  if (!startReference || !endReference) {
    setDetailStatus('Could not resolve selected start/end verses.', 'error');
    return;
  }

  const payload = {
    start_verse_id: startVerseId,
    end_verse_id: endVerseId,
    range_label: buildRangeLabel(startReference, endReference),
    relationship_type: relationshipType,
    note: optionalText(formData.get('note')),
    sort_order: Number.isFinite(parsedSort) && parsedSort >= 0 ? parsedSort : 0
  };

  const { error } = await supabase
    .from('song_verse_ranges')
    .update(payload)
    .eq('id', rangeId);

  if (error) {
    setDetailStatus(`Save range link failed: ${error.message}`, 'error');
    return;
  }

  setDetailStatus('Range link updated.', 'ok');
  if (selectedSongId) {
    await selectSong(selectedSongId);
    await loadQueue();
  }
}

async function removeExactLink(linkId) {
  const { error } = await supabase
    .from('song_verse_links')
    .delete()
    .eq('id', linkId);

  if (error) {
    setDetailStatus(`Remove exact link failed: ${error.message}`, 'error');
    return;
  }

  setDetailStatus('Exact link removed.', 'ok');
  if (selectedSongId) {
    await selectSong(selectedSongId);
    await loadQueue();
  }
}

async function removeRangeLink(rangeId) {
  const { error } = await supabase
    .from('song_verse_ranges')
    .delete()
    .eq('id', rangeId);

  if (error) {
    setDetailStatus(`Remove range link failed: ${error.message}`, 'error');
    return;
  }

  setDetailStatus('Range link removed.', 'ok');
  if (selectedSongId) {
    await selectSong(selectedSongId);
    await loadQueue();
  }
}

async function moderate(songId, targetStatus) {
  const { error } = await supabase.rpc('set_song_moderation', {
    p_song_id: songId,
    p_target_status: targetStatus
  });

  if (error) {
    setAuthStatus(`Moderation failed: ${error.message}`, 'error');
    return;
  }

  setAuthStatus(`Song marked as ${targetStatus}.`, 'ok');
  await loadQueue();

  if (selectedSongId === songId) {
    selectedSongId = null;
    setDetailStatus(`Selected song marked as ${targetStatus}. Pick another pending song.`, 'ok');
    renderEmptyDetail();
  }
}

sendLinkBtn.addEventListener('click', async () => {
  await sendMagicLink();
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  setAuthStatus('Signed out.', 'warn');
  await loadQueue();
  selectedSongId = null;
  renderEmptyDetail();
});

queueBody.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const songId = target.dataset.id;
  const action = target.dataset.action;
  if (!songId || !action) return;

  target.disabled = true;

  if (action === 'view') {
    await selectSong(songId);
  } else {
    await moderate(songId, action);
  }

  target.disabled = false;
});

songMeta.addEventListener('submit', async (event) => {
  const formEl = event.target;
  if (!(formEl instanceof HTMLFormElement)) return;
  if (formEl.id !== 'song-edit-form') return;

  event.preventDefault();
  const submitter = event.submitter;
  if (submitter instanceof HTMLButtonElement) submitter.disabled = true;

  await saveSongFields(formEl);

  if (submitter instanceof HTMLButtonElement) submitter.disabled = false;
});

detailExact.addEventListener('change', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const formEl = target.closest('form[data-exact-id]');
  if (!(formEl instanceof HTMLFormElement)) return;

  try {
    if (target.matches('select[name="book_id"]')) {
      await refreshExactChapters(formEl);
    } else if (target.matches('select[name="chapter_id"]')) {
      await refreshExactVerses(formEl);
    }
  } catch (error) {
    setDetailStatus(`Could not refresh exact selectors: ${error.message}`, 'error');
  }
});

detailExact.addEventListener('submit', async (event) => {
  const formEl = event.target;
  if (!(formEl instanceof HTMLFormElement)) return;
  if (!formEl.dataset.exactId) return;

  event.preventDefault();
  const submitter = event.submitter;
  if (submitter instanceof HTMLButtonElement) submitter.disabled = true;

  await saveExactLink(formEl);

  if (submitter instanceof HTMLButtonElement) submitter.disabled = false;
});

detailExact.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const linkId = target.dataset.removeExact;
  if (!linkId) return;

  const confirmed = window.confirm('Remove this exact verse link?');
  if (!confirmed) return;

  if (target instanceof HTMLButtonElement) target.disabled = true;
  await removeExactLink(linkId);
  if (target instanceof HTMLButtonElement) target.disabled = false;
});

detailRanges.addEventListener('change', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const formEl = target.closest('form[data-range-id]');
  if (!(formEl instanceof HTMLFormElement)) return;

  try {
    if (target.matches('select[name="book_id"]')) {
      await refreshRangeChapters(formEl, 'start');
      await refreshRangeChapters(formEl, 'end');
    } else if (target.matches('select[name="start_chapter_id"]')) {
      await refreshRangeVerses(formEl, 'start');
    } else if (target.matches('select[name="end_chapter_id"]')) {
      await refreshRangeVerses(formEl, 'end');
    }

    await updateRangePreview(formEl);
  } catch (error) {
    setDetailStatus(`Could not refresh range selectors: ${error.message}`, 'error');
  }
});

detailRanges.addEventListener('submit', async (event) => {
  const formEl = event.target;
  if (!(formEl instanceof HTMLFormElement)) return;
  if (!formEl.dataset.rangeId) return;

  event.preventDefault();
  const submitter = event.submitter;
  if (submitter instanceof HTMLButtonElement) submitter.disabled = true;

  await saveRangeLink(formEl);

  if (submitter instanceof HTMLButtonElement) submitter.disabled = false;
});

detailRanges.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const rangeId = target.dataset.removeRange;
  if (!rangeId) return;

  const confirmed = window.confirm('Remove this verse range link?');
  if (!confirmed) return;

  if (target instanceof HTMLButtonElement) target.disabled = true;
  await removeRangeLink(rangeId);
  if (target instanceof HTMLButtonElement) target.disabled = false;
});

refreshQueueBtn.addEventListener('click', () => {
  loadQueue();
});

supabase.auth.onAuthStateChange(() => {
  requireSessionMessage();
  loadQueue();
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? 'Unknown error');
  setAuthStatus(`Unexpected error: ${reason}`, 'error');
});

window.addEventListener('error', (event) => {
  const message = event.error instanceof Error ? event.error.message : event.message;
  setAuthStatus(`Unexpected error: ${message}`, 'error');
});

function init() {
  setAuthStatus('Admin app loaded. Ready to send magic link.', 'warn');
  requireSessionMessage();
  loadQueue();
  renderEmptyDetail();
}

init();

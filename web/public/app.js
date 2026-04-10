import { supabase, formatDate } from '../shared/supabase.js';

const form = document.getElementById('song-form');
const statusEl = document.getElementById('submit-status');
const submitBtn = document.getElementById('submit-btn');
const approvedList = document.getElementById('approved-list');
const refreshApprovedBtn = document.getElementById('refresh-approved');

const exactBookEl = document.getElementById('exact_book');
const exactChapterEl = document.getElementById('exact_chapter');
const exactVerseEl = document.getElementById('exact_verse');
const addExactBtn = document.getElementById('add-exact');
const exactSelectedEl = document.getElementById('exact-selected');

const rangeStartBookEl = document.getElementById('range_start_book');
const rangeStartChapterEl = document.getElementById('range_start_chapter');
const rangeStartVerseEl = document.getElementById('range_start_verse');
const rangeEndBookEl = document.getElementById('range_end_book');
const rangeEndChapterEl = document.getElementById('range_end_chapter');
const rangeEndVerseEl = document.getElementById('range_end_verse');

let books = [];
let selectedExactVerses = [];

function setStatus(text, tone = 'warn') {
  statusEl.textContent = text;
  statusEl.className = `status ${tone}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setOptions(selectEl, options, getLabel, getValue, includeBlank = false) {
  const oldValue = selectEl.value;
  selectEl.innerHTML = '';

  if (includeBlank) {
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '-- none --';
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

async function refreshExactChapters() {
  try {
    const chapters = await fetchChapters(exactBookEl.value);
    setOptions(exactChapterEl, chapters, (c) => `Chapter ${c.chapter_number}`, (c) => c.id, false);
    await refreshExactVerses();
  } catch (error) {
    setStatus(`Could not load exact chapters: ${error.message}`, 'error');
  }
}

async function refreshExactVerses() {
  try {
    const verses = await fetchVerses(exactChapterEl.value);
    setOptions(exactVerseEl, verses, (v) => v.reference, (v) => v.id, false);
  } catch (error) {
    setStatus(`Could not load exact verses: ${error.message}`, 'error');
  }
}

async function refreshRangeStartChapters() {
  try {
    const chapters = await fetchChapters(rangeStartBookEl.value);
    setOptions(rangeStartChapterEl, chapters, (c) => `Chapter ${c.chapter_number}`, (c) => c.id, true);
    await refreshRangeStartVerses();
  } catch (error) {
    setStatus(`Could not load range-start chapters: ${error.message}`, 'error');
  }
}

async function refreshRangeStartVerses() {
  try {
    const verses = await fetchVerses(rangeStartChapterEl.value);
    setOptions(rangeStartVerseEl, verses, (v) => v.reference, (v) => v.id, true);
  } catch (error) {
    setStatus(`Could not load range-start verses: ${error.message}`, 'error');
  }
}

async function refreshRangeEndChapters() {
  try {
    const chapters = await fetchChapters(rangeEndBookEl.value);
    setOptions(rangeEndChapterEl, chapters, (c) => `Chapter ${c.chapter_number}`, (c) => c.id, true);
    await refreshRangeEndVerses();
  } catch (error) {
    setStatus(`Could not load range-end chapters: ${error.message}`, 'error');
  }
}

async function refreshRangeEndVerses() {
  try {
    const verses = await fetchVerses(rangeEndChapterEl.value);
    setOptions(rangeEndVerseEl, verses, (v) => v.reference, (v) => v.id, true);
  } catch (error) {
    setStatus(`Could not load range-end verses: ${error.message}`, 'error');
  }
}

function renderSelectedExact() {
  if (!selectedExactVerses.length) {
    exactSelectedEl.innerHTML = 'No exact verses selected yet.';
    return;
  }

  exactSelectedEl.innerHTML = selectedExactVerses
    .map(
      (v) => `<span class="pill approved">${escapeHtml(v.reference)}</span> <button class="secondary" type="button" data-remove-verse="${v.verse_id}">remove</button>`
    )
    .join('<br />');
}

function addCurrentExactVerse() {
  const verseId = exactVerseEl.value;
  const reference = exactVerseEl.options[exactVerseEl.selectedIndex]?.textContent;
  if (!verseId || !reference) return;

  if (selectedExactVerses.some((v) => v.verse_id === verseId)) {
    setStatus('That exact verse is already added.', 'warn');
    return;
  }

  selectedExactVerses.push({ verse_id: verseId, reference });
  renderSelectedExact();
  setStatus('Exact verse added.', 'ok');
}

async function loadSelectors() {
  try {
    books = await fetchBooks();

    setOptions(exactBookEl, books, (b) => b.canonical_name, (b) => b.id, false);
    setOptions(rangeStartBookEl, books, (b) => b.canonical_name, (b) => b.id, true);
    setOptions(rangeEndBookEl, books, (b) => b.canonical_name, (b) => b.id, true);

    await refreshExactChapters();
    await refreshRangeStartChapters();
    await refreshRangeEndChapters();
    renderSelectedExact();
  } catch (error) {
    setStatus(`Could not load selector data: ${error.message}`, 'error');
  }
}

function renderApprovedRows(rows) {
  if (!rows.length) {
    approvedList.innerHTML = '<p>No approved songs with links yet.</p>';
    return;
  }

  const html = rows
    .map((row) => {
      const artist = row.artist_name ? ` • ${escapeHtml(row.artist_name)}` : '';
      return `<p><strong>${escapeHtml(row.title)}</strong>${artist}<br /><small>${escapeHtml(formatDate(row.song_created_at))}</small></p>`;
    })
    .join('');

  approvedList.innerHTML = html;
}

async function loadApproved() {
  const { data, error } = await supabase
    .from('approved_song_links')
    .select('song_id, title, artist_name, song_created_at')
    .order('song_created_at', { ascending: false })
    .limit(50);

  if (error) {
    approvedList.innerHTML = `<p class="status error">Could not load approved songs: ${escapeHtml(error.message)}</p>`;
    return;
  }

  const uniqueBySong = new Map();
  for (const row of data ?? []) {
    if (!uniqueBySong.has(row.song_id)) {
      uniqueBySong.set(row.song_id, row);
    }
  }

  renderApprovedRows(Array.from(uniqueBySong.values()));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Submitting...', 'warn');
  submitBtn.disabled = true;

  const formData = new FormData(form);
  const rangeStartId = rangeStartVerseEl.value || null;
  const rangeEndId = rangeEndVerseEl.value || null;

  const hasExact = selectedExactVerses.length > 0;
  const hasRange = Boolean(rangeStartId && rangeEndId);

  if (!hasExact && !hasRange) {
    submitBtn.disabled = false;
    setStatus('Add at least one exact verse or one full range.', 'error');
    return;
  }

  if ((rangeStartId && !rangeEndId) || (!rangeStartId && rangeEndId)) {
    submitBtn.disabled = false;
    setStatus('Range needs both start and end verse.', 'error');
    return;
  }

  const payload = {
    p_title: String(formData.get('title') || '').trim(),
    p_artist_name: String(formData.get('artist_name') || '').trim() || null,
    p_composer_name: String(formData.get('composer_name') || '').trim() || null,
    p_source_url: String(formData.get('source_url') || '').trim() || null,
    p_lyrics: null,
    p_notes: String(formData.get('notes') || '').trim() || null,
    p_exact_verse_ids: selectedExactVerses.map((v) => v.verse_id),
    p_range_start_verse_id: rangeStartId,
    p_range_end_verse_id: rangeEndId,
    p_range_relationship_type: String(formData.get('range_relationship_type') || 'quotation')
  };

  const { data, error } = await supabase.rpc('submit_song_with_links', payload);

  submitBtn.disabled = false;

  if (error) {
    setStatus(`Submit failed: ${error.message}`, 'error');
    return;
  }

  setStatus(`Submission received (ID: ${data}). It is now pending review with verse links.`, 'ok');
  form.reset();
  selectedExactVerses = [];
  await loadSelectors();
});

addExactBtn.addEventListener('click', () => {
  addCurrentExactVerse();
});

exactSelectedEl.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const idToRemove = target.dataset.removeVerse;
  if (!idToRemove) return;

  selectedExactVerses = selectedExactVerses.filter((v) => v.verse_id !== idToRemove);
  renderSelectedExact();
  setStatus('Exact verse removed.', 'warn');
});

exactBookEl.addEventListener('change', refreshExactChapters);
exactChapterEl.addEventListener('change', refreshExactVerses);
rangeStartBookEl.addEventListener('change', refreshRangeStartChapters);
rangeStartChapterEl.addEventListener('change', refreshRangeStartVerses);
rangeEndBookEl.addEventListener('change', refreshRangeEndChapters);
rangeEndChapterEl.addEventListener('change', refreshRangeEndVerses);

refreshApprovedBtn.addEventListener('click', () => {
  loadApproved();
});

loadSelectors();
loadApproved();

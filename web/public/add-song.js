import { fetchBooks, fetchChapters, fetchVerses, setOptions, setStatus, supabase, escapeHtml } from './common.js';

const form = document.getElementById('song-form');
const statusEl = document.getElementById('submit-status');
const submitBtn = document.getElementById('submit-btn');
const confirmationEl = document.getElementById('submit-confirmation');

const exactSection = document.getElementById('exact-section');
const rangeSection = document.getElementById('range-section');

const exactBookEl = document.getElementById('exact_book');
const exactChapterEl = document.getElementById('exact_chapter');
const exactVerseEl = document.getElementById('exact_verse');
const addExactBtn = document.getElementById('add-exact');
const exactSelectedEl = document.getElementById('exact-selected');

const rangeBookEl = document.getElementById('range_book');
const rangeStartChapterEl = document.getElementById('range_start_chapter');
const rangeStartVerseEl = document.getElementById('range_start_verse');
const rangeEndChapterEl = document.getElementById('range_end_chapter');
const rangeEndVerseEl = document.getElementById('range_end_verse');

let selectedExactVerses = [];

function setSubmitStatus(text, tone = 'warn') {
  setStatus(statusEl, text, tone);
}

function clearSubmissionConfirmation() {
  confirmationEl.hidden = true;
  confirmationEl.innerHTML = '';
}

function showSubmissionConfirmation(songId, title) {
  confirmationEl.hidden = false;
  confirmationEl.innerHTML = `
    <div class="success-box">
      <h3>Submission Received</h3>
      <p><strong>${escapeHtml(title)}</strong> was submitted successfully.</p>
      <p>Your song is now pending admin review. It will appear publicly after approval.</p>
      <p><small>Submission ID: ${escapeHtml(songId)}</small></p>
    </div>
  `;
}

function currentMode() {
  const checked = form.querySelector('input[name="link_mode"]:checked');
  return checked?.value || 'exact';
}

function updateModeUI() {
  const mode = currentMode();
  exactSection.style.display = mode === 'exact' ? '' : 'none';
  rangeSection.style.display = mode === 'range' ? '' : 'none';
}

async function refreshExactChapters() {
  try {
    const chapters = await fetchChapters(exactBookEl.value);
    setOptions(exactChapterEl, chapters, (c) => `Chapter ${c.chapter_number}`, (c) => c.id, false);
    await refreshExactVerses();
  } catch (error) {
    setSubmitStatus(`Could not load exact chapters: ${error.message}`, 'error');
  }
}

async function refreshExactVerses() {
  try {
    const verses = await fetchVerses(exactChapterEl.value);
    setOptions(exactVerseEl, verses, (v) => v.reference, (v) => v.id, false);
  } catch (error) {
    setSubmitStatus(`Could not load exact verses: ${error.message}`, 'error');
  }
}

async function refreshRangeStartChapters() {
  try {
    const chapters = await fetchChapters(rangeBookEl.value);
    setOptions(rangeStartChapterEl, chapters, (c) => `Chapter ${c.chapter_number}`, (c) => c.id, true);
    await refreshRangeStartVerses();
  } catch (error) {
    setSubmitStatus(`Could not load range-start chapters: ${error.message}`, 'error');
  }
}

async function refreshRangeStartVerses() {
  try {
    const verses = await fetchVerses(rangeStartChapterEl.value);
    setOptions(rangeStartVerseEl, verses, (v) => v.reference, (v) => v.id, true);
  } catch (error) {
    setSubmitStatus(`Could not load range-start verses: ${error.message}`, 'error');
  }
}

async function refreshRangeEndChapters() {
  try {
    const chapters = await fetchChapters(rangeBookEl.value);
    setOptions(rangeEndChapterEl, chapters, (c) => `Chapter ${c.chapter_number}`, (c) => c.id, true);
    await refreshRangeEndVerses();
  } catch (error) {
    setSubmitStatus(`Could not load range-end chapters: ${error.message}`, 'error');
  }
}

async function refreshRangeEndVerses() {
  try {
    const verses = await fetchVerses(rangeEndChapterEl.value);
    setOptions(rangeEndVerseEl, verses, (v) => v.reference, (v) => v.id, true);
  } catch (error) {
    setSubmitStatus(`Could not load range-end verses: ${error.message}`, 'error');
  }
}

function renderSelectedExact() {
  if (!selectedExactVerses.length) {
    exactSelectedEl.innerHTML = 'No exact verses selected yet.';
    return;
  }

  const chips = selectedExactVerses
    .map(
      (v) => `<span class="exact-chip"><span class="exact-chip-label">${escapeHtml(v.reference)}</span><button class="exact-chip-remove" type="button" data-remove-verse="${v.verse_id}" aria-label="Remove ${escapeHtml(v.reference)}">x</button></span>`
    )
    .join('');

  const addMore = `<button class="pill approved add-more-pill" type="button" data-action="add-more-exact" aria-label="Add another exact verse">+</button>`;
  exactSelectedEl.innerHTML = `<div class="exact-chip-list">${chips}${addMore}</div>`;
}

function addCurrentExactVerse() {
  const verseId = exactVerseEl.value;
  const reference = exactVerseEl.options[exactVerseEl.selectedIndex]?.textContent;
  if (!verseId || !reference) return;

  if (selectedExactVerses.some((v) => v.verse_id === verseId)) {
    setSubmitStatus('That exact verse is already added.', 'warn');
    return;
  }

  selectedExactVerses.push({ verse_id: verseId, reference });
  renderSelectedExact();
  setSubmitStatus('Exact verse added.', 'ok');
}

async function loadSelectors() {
  try {
    const books = await fetchBooks();
    setOptions(exactBookEl, books, (b) => b.canonical_name, (b) => b.id, false);
    setOptions(rangeBookEl, books, (b) => b.canonical_name, (b) => b.id, true);

    await refreshExactChapters();
    await refreshRangeStartChapters();
    await refreshRangeEndChapters();
    updateModeUI();
    renderSelectedExact();
  } catch (error) {
    setSubmitStatus(`Could not load selector data: ${error.message}`, 'error');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearSubmissionConfirmation();
  setSubmitStatus('Submitting...', 'warn');
  submitBtn.disabled = true;

  const formData = new FormData(form);
  const mode = currentMode();

  const rangeStartId = rangeStartVerseEl.value || null;
  const rangeEndId = rangeEndVerseEl.value || null;

  let exactVerseIds = [];
  let payloadRangeStart = null;
  let payloadRangeEnd = null;

  if (mode === 'exact') {
    exactVerseIds = selectedExactVerses.map((v) => v.verse_id);
    if (!exactVerseIds.length) {
      submitBtn.disabled = false;
      setSubmitStatus('Please add at least one exact verse.', 'error');
      return;
    }
  } else {
    if (!rangeBookEl.value || !rangeStartId || !rangeEndId) {
      submitBtn.disabled = false;
      setSubmitStatus('Please choose book, range start, and range end.', 'error');
      return;
    }
    payloadRangeStart = rangeStartId;
    payloadRangeEnd = rangeEndId;
  }

  const payload = {
    p_title: String(formData.get('title') || '').trim(),
    p_artist_name: String(formData.get('artist_name') || '').trim() || null,
    p_composer_name: String(formData.get('composer_name') || '').trim() || null,
    p_source_url: String(formData.get('source_url') || '').trim() || null,
    p_lyrics: String(formData.get('lyrics') || '').trim() || null,
    p_notes: String(formData.get('notes') || '').trim() || null,
    p_exact_verse_ids: exactVerseIds,
    p_range_start_verse_id: payloadRangeStart,
    p_range_end_verse_id: payloadRangeEnd,
    p_range_relationship_type: 'exact'
  };

  const { data, error } = await supabase.rpc('submit_song_with_links', payload);
  submitBtn.disabled = false;

  if (error) {
    setSubmitStatus(`Submit failed: ${error.message}`, 'error');
    return;
  }

  setSubmitStatus('Submission saved.', 'ok');
  showSubmissionConfirmation(data, payload.p_title);
  form.reset();
  selectedExactVerses = [];
  await loadSelectors();
});

exactBookEl.addEventListener('change', refreshExactChapters);
exactChapterEl.addEventListener('change', refreshExactVerses);
rangeBookEl.addEventListener('change', async () => {
  await refreshRangeStartChapters();
  await refreshRangeEndChapters();
});
rangeStartChapterEl.addEventListener('change', refreshRangeStartVerses);
rangeEndChapterEl.addEventListener('change', refreshRangeEndVerses);

addExactBtn.addEventListener('click', addCurrentExactVerse);
exactSelectedEl.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.action === 'add-more-exact') {
    exactBookEl.focus();
    setSubmitStatus('Select another verse and click Add Exact Verse To List.', 'ok');
    return;
  }

  const idToRemove = target.dataset.removeVerse;
  if (!idToRemove) return;

  const shouldDelete = window.confirm('Remove this verse from the song links?');
  if (!shouldDelete) return;

  selectedExactVerses = selectedExactVerses.filter((v) => v.verse_id !== idToRemove);
  renderSelectedExact();
  setSubmitStatus('Exact verse removed.', 'warn');
});

form.querySelectorAll('input[name="link_mode"]').forEach((el) => {
  el.addEventListener('change', updateModeUI);
});

loadSelectors();

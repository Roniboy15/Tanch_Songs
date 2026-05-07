import {
  fetchBooks,
  fetchChapters,
  fetchVerses,
  fetchVerseCatalogById,
  findEntriesBySearch,
  findEntriesForVerse,
  loadApprovedData,
  renderSongCards,
  setOptions,
  setStatus
} from './common.js';

const lookupBookEl = document.getElementById('lookup_book');
const lookupChapterEl = document.getElementById('lookup_chapter');
const lookupVerseEl = document.getElementById('lookup_verse');
const lookupBtn = document.getElementById('lookup-btn');
const lookupStatusEl = document.getElementById('lookup-status');
const lookupResultsEl = document.getElementById('lookup-results');

const songSearchInput = document.getElementById('song-search');
const songSearchBtn = document.getElementById('song-search-btn');
const clearSearchBtn = document.getElementById('clear-search-btn');
const searchStatusEl = document.getElementById('search-status');
const searchResultsEl = document.getElementById('search-results');

let approvedLinkRows = [];
let approvedSongsById = new Map();
let linksBySongId = new Map();

function setLookupStatus(text, tone = 'warn') {
  setStatus(lookupStatusEl, text, tone);
}

function setSearchStatus(text, tone = 'warn') {
  setStatus(searchStatusEl, text, tone);
}

async function refreshLookupChapters() {
  try {
    const chapters = await fetchChapters(lookupBookEl.value);
    setOptions(lookupChapterEl, chapters, (c) => `Chapter ${c.chapter_number}`, (c) => c.id, false);
    await refreshLookupVerses();
  } catch (error) {
    setLookupStatus(`Could not load lookup chapters: ${error.message}`, 'error');
  }
}

async function refreshLookupVerses() {
  try {
    const verses = await fetchVerses(lookupChapterEl.value);
    setOptions(lookupVerseEl, verses, (v) => v.reference, (v) => v.id, false);
  } catch (error) {
    setLookupStatus(`Could not load lookup verses: ${error.message}`, 'error');
  }
}

async function loadSelectors() {
  try {
    const books = await fetchBooks();
    setOptions(lookupBookEl, books, (b) => b.canonical_name, (b) => b.id, false);
    await refreshLookupChapters();
    setLookupStatus('Choose a verse and click Find Linked Songs.', 'warn');
  } catch (error) {
    setLookupStatus(`Could not load selector data: ${error.message}`, 'error');
  }
}

async function loadData() {
  try {
    const state = await loadApprovedData();
    approvedLinkRows = state.approvedLinkRows;
    approvedSongsById = state.approvedSongsById;
    linksBySongId = state.linksBySongId;
    setSearchStatus('Enter text to search approved songs.', 'warn');
  } catch (error) {
    setLookupStatus(`Could not load approved songs: ${error.message}`, 'error');
    setSearchStatus(`Could not load approved songs: ${error.message}`, 'error');
  }
}

async function findSongsForVerse() {
  const verseId = lookupVerseEl.value;
  if (!verseId) {
    setLookupStatus('Please choose a verse first.', 'error');
    return;
  }

  setLookupStatus('Finding linked songs...', 'warn');

  try {
    const verse = await fetchVerseCatalogById(verseId);
    if (!verse) {
      setLookupStatus('Could not resolve selected verse.', 'error');
      return;
    }

    const entries = findEntriesForVerse(verse, approvedLinkRows, approvedSongsById);
    renderSongCards(lookupResultsEl, entries, 'No approved songs are linked to this verse yet.');
    setLookupStatus(`Found ${entries.length} song(s) linked to ${verse.reference}.`, entries.length ? 'ok' : 'warn');
  } catch (error) {
    setLookupStatus(`Verse lookup failed: ${error.message}`, 'error');
  }
}

function runSongSearch() {
  const rawQuery = songSearchInput.value.trim();
  if (rawQuery.length < 2) {
    searchResultsEl.innerHTML = '';
    setSearchStatus('Type at least 2 letters to search.', 'warn');
    return;
  }

  const matches = findEntriesBySearch(rawQuery, approvedSongsById, linksBySongId);
  renderSongCards(searchResultsEl, matches, 'No songs matched that search.');
  setSearchStatus(`Found ${matches.length} result(s) for "${rawQuery}".`, matches.length ? 'ok' : 'warn');
}

lookupBookEl.addEventListener('change', refreshLookupChapters);
lookupChapterEl.addEventListener('change', refreshLookupVerses);
lookupBtn.addEventListener('click', findSongsForVerse);

songSearchBtn.addEventListener('click', runSongSearch);
clearSearchBtn.addEventListener('click', () => {
  songSearchInput.value = '';
  searchResultsEl.innerHTML = '';
  setSearchStatus('Type at least 2 letters to search.', 'warn');
});
songSearchInput.addEventListener('input', () => {
  runSongSearch();
});
songSearchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') event.preventDefault();
});

await Promise.all([loadSelectors(), loadData()]);

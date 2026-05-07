import { buildRecentEntries, loadApprovedData, renderSongCards } from './common.js';

const approvedList = document.getElementById('approved-list');
const refreshApprovedBtn = document.getElementById('refresh-approved');

let autoScrollTimer = null;
let autoScrollPauseUntil = 0;
let autoScrollListenersBound = false;

function stopAutoScroll() {
  if (autoScrollTimer !== null) {
    clearInterval(autoScrollTimer);
    autoScrollTimer = null;
  }
}

function pauseAutoScroll(ms = 2500) {
  autoScrollPauseUntil = Date.now() + ms;
}

function bindAutoScrollListeners() {
  if (autoScrollListenersBound) return;
  autoScrollListenersBound = true;

  approvedList.addEventListener('wheel', () => pauseAutoScroll());
  approvedList.addEventListener('touchstart', () => pauseAutoScroll());
  approvedList.addEventListener('mousedown', () => pauseAutoScroll());
}

function ensureListOverflow() {
  for (const clone of Array.from(approvedList.querySelectorAll('.approved-song-card[data-approved-clone="1"]'))) {
    clone.remove();
  }

  const originals = Array.from(approvedList.querySelectorAll('.approved-song-card'));
  if (!originals.length) return false;

  let guard = 0;
  while (approvedList.scrollHeight <= approvedList.clientHeight + 2 && guard < 8) {
    for (const item of originals) {
      const clone = item.cloneNode(true);
      if (clone instanceof HTMLElement) {
        clone.dataset.approvedClone = '1';
        approvedList.appendChild(clone);
      }
    }
    guard += 1;
  }

  return approvedList.scrollHeight > approvedList.clientHeight + 2;
}

function startAutoScroll() {
  stopAutoScroll();
  bindAutoScrollListeners();

  const canScroll = ensureListOverflow();
  if (!canScroll) return;
  approvedList.scrollTop = 0;

  autoScrollTimer = window.setInterval(() => {
    if (Date.now() < autoScrollPauseUntil) return;
    approvedList.scrollTop += 1.5;
    const maxTop = approvedList.scrollHeight - approvedList.clientHeight;
    if (approvedList.scrollTop >= maxTop - 1) {
      approvedList.scrollTop = 0;
    }
  }, 32);
}

async function loadRecentSongs() {
  try {
    const state = await loadApprovedData();
    const entries = buildRecentEntries(state.approvedLinkRows);
    renderSongCards(approvedList, entries, 'No approved songs with links yet.');
    startAutoScroll();
  } catch (error) {
    approvedList.innerHTML = `<p class="status error">Could not load approved songs: ${error.message}</p>`;
    stopAutoScroll();
  }
}

refreshApprovedBtn.addEventListener('click', () => {
  loadRecentSongs();
});

loadRecentSongs();

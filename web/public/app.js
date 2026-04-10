import { supabase, formatDate } from '../shared/supabase.js';

const form = document.getElementById('song-form');
const statusEl = document.getElementById('submit-status');
const submitBtn = document.getElementById('submit-btn');
const approvedList = document.getElementById('approved-list');
const refreshApprovedBtn = document.getElementById('refresh-approved');

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

function renderApprovedRows(rows) {
  if (!rows.length) {
    approvedList.innerHTML = '<p>No approved songs yet.</p>';
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
    .limit(30);

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
  const payload = {
    p_title: String(formData.get('title') || '').trim(),
    p_artist_name: String(formData.get('artist_name') || '').trim() || null,
    p_composer_name: String(formData.get('composer_name') || '').trim() || null,
    p_source_url: String(formData.get('source_url') || '').trim() || null,
    p_lyrics: null,
    p_notes: String(formData.get('notes') || '').trim() || null
  };

  const { data, error } = await supabase.rpc('submit_song', payload);

  submitBtn.disabled = false;

  if (error) {
    setStatus(`Submit failed: ${error.message}`, 'error');
    return;
  }

  setStatus(`Submission received (ID: ${data}). It is now pending review.`, 'ok');
  form.reset();
});

refreshApprovedBtn.addEventListener('click', () => {
  loadApproved();
});

loadApproved();

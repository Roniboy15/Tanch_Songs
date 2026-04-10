import { supabase, formatDate } from '../shared/supabase.js';

const emailInput = document.getElementById('admin-email');
const sendLinkBtn = document.getElementById('send-link');
const logoutBtn = document.getElementById('logout');
const authStatus = document.getElementById('auth-status');
const queueBody = document.getElementById('queue-body');
const refreshQueueBtn = document.getElementById('refresh-queue');

function setAuthStatus(text, tone = 'warn') {
  authStatus.textContent = text;
  authStatus.className = `status ${tone}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function requireSessionMessage() {
  const { data } = await supabase.auth.getSession();
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
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo }
  });

  if (error) {
    setAuthStatus(`Could not send magic link: ${error.message}`, 'error');
    return;
  }

  setAuthStatus('Magic link sent. Open it in this browser to sign in.', 'ok');
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
    return;
  }

  queueBody.innerHTML = data
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.title)}</td>
        <td><span class="pill pending">${escapeHtml(row.moderation_status)}</span></td>
        <td>${row.total_link_count}</td>
        <td>${escapeHtml(formatDate(row.created_at))}</td>
        <td>
          <div class="actions">
            <button data-id="${row.id}" data-action="approved">Approve</button>
            <button class="secondary" data-id="${row.id}" data-action="rejected">Reject</button>
          </div>
        </td>
      </tr>`
    )
    .join('');
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
}

sendLinkBtn.addEventListener('click', () => {
  sendMagicLink();
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  setAuthStatus('Signed out.', 'warn');
  await loadQueue();
});

queueBody.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const songId = target.dataset.id;
  const action = target.dataset.action;
  if (!songId || !action) return;

  target.disabled = true;
  await moderate(songId, action);
  target.disabled = false;
});

refreshQueueBtn.addEventListener('click', () => {
  loadQueue();
});

supabase.auth.onAuthStateChange(async () => {
  await requireSessionMessage();
  await loadQueue();
});

await requireSessionMessage();
await loadQueue();

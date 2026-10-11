// Shared helpers used by every page
const Auth = {
  get token() { return localStorage.getItem('rh_token'); },
  get user() { try { return JSON.parse(localStorage.getItem('rh_user')); } catch { return null; } },
  save(d) { localStorage.setItem('rh_token', d.token); localStorage.setItem('rh_user', JSON.stringify(d.user)); },
  clear() { localStorage.removeItem('rh_token'); localStorage.removeItem('rh_user'); },
};

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(Auth.token ? { Authorization: 'Bearer ' + Auth.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && Auth.token) { Auth.clear(); }
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function toast(msg, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CAT = { mobile: 'Mobile', bike: 'Bike', auto: 'Auto / Car', electronics: 'Electronics' };
const stars = (r) => r ? `<span class="stars" aria-label="${r} out of 5">${'★'.repeat(Math.round(r))}${'☆'.repeat(5 - Math.round(r))}</span> ${r}` : '<span class="muted">No reviews yet</span>';

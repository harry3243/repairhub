const state = { category: new URLSearchParams(location.search).get('category') || '', q: '', open: false, lat: null, lng: null };

function card(s) {
  return `<a class="box shop-card" href="shop.html?id=${s.id}">
    <div><span class="pill cat">${CAT[s.category]}</span>
      <span class="pill ${s.open_now ? 'open' : 'closed'}">${s.open_now ? 'Open now' : 'Closed'}</span></div>
    <h3>${esc(s.name)}</h3>
    <div>${stars(s.rating)} ${s.review_count ? `<span class="muted">(${s.review_count})</span>` : ''}</div>
    <div class="muted">${esc(s.address)}${s.distance_km != null ? ` · ${s.distance_km} km away` : ''}</div>
    <div>${s.from_price != null ? `Repairs from <b>₹${s.from_price}</b>` : '<span class="muted">Prices not listed yet</span>'}</div>
    <div class="muted">${s.open_time}–${s.close_time}</div>
  </a>`;
}

async function load() {
  const p = new URLSearchParams();
  if (state.category) p.set('category', state.category);
  if (state.q) p.set('q', state.q);
  if (state.open) p.set('open', '1');
  if (state.lat != null) { p.set('lat', state.lat); p.set('lng', state.lng); }
  const list = document.getElementById('list');
  try {
    const shops = await api('/shops?' + p);
    document.getElementById('count').textContent = `${shops.length} shop${shops.length === 1 ? '' : 's'} found${state.lat != null ? ', nearest first' : ''}`;
    list.innerHTML = shops.length ? shops.map(card).join('')
      : '<div class="box">No shops match. Try another category or clear the search.</div>';
  } catch (e) { list.innerHTML = `<div class="box">${esc(e.message)}</div>`; }
}

document.querySelectorAll('#cats .chip').forEach(b => {
  if (b.dataset.c === state.category) { document.querySelector('#cats .on')?.classList.remove('on'); b.classList.add('on'); }
  b.onclick = () => {
    document.querySelector('#cats .on').classList.remove('on'); b.classList.add('on');
    state.category = b.dataset.c; load();
  };
});
const doSearch = () => { state.q = document.getElementById('q').value.trim(); load(); };
document.getElementById('searchBtn').onclick = doSearch;
document.getElementById('q').onkeydown = e => { if (e.key === 'Enter') doSearch(); };
document.getElementById('openOnly').onchange = e => { state.open = e.target.checked; load(); };
document.getElementById('nearBtn').onclick = () => {
  if (!navigator.geolocation) return toast('Your browser does not support location.', true);
  navigator.geolocation.getCurrentPosition(
    pos => { state.lat = pos.coords.latitude; state.lng = pos.coords.longitude; toast('Showing nearest shops first.'); load(); },
    () => toast('Location blocked. Allow it in your browser to sort by distance.', true));
};
load();

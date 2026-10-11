const shopId = new URLSearchParams(location.search).get('id');
const app = document.getElementById('app');
let shop;

function render() {
  const s = shop, u = Auth.user;
  const maps = s.lat != null ? `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address + ' ' + s.city)}`;
  app.innerHTML = `
  <div class="box">
    <span class="pill cat">${CAT[s.category]}</span>
    <span class="pill ${s.open_now ? 'open' : 'closed'}">${s.open_now ? 'Open now' : 'Closed'}</span>
    <h2 style="margin-top:.4em">${esc(s.name)}</h2>
    <div>${stars(s.rating)} <span class="muted">${s.review_count ? `(${s.review_count} reviews)` : ''}</span></div>
    <p class="muted" style="margin:.5em 0">${esc(s.description)}</p>
    <div>${esc(s.address)}, ${esc(s.city)} · ${s.open_time}–${s.close_time}</div>
    <div style="margin-top:.7em">
      <a class="btn btn-light btn-sm" href="${maps}" target="_blank" rel="noopener">Get directions</a>
      ${s.phone ? `<a class="btn btn-outline-light btn-sm" href="tel:${esc(s.phone)}">Call ${esc(s.phone)}</a>` : ''}
    </div>
  </div>

  <div class="two">
    <div>
      <div class="box"><h3>Repairs and prices</h3>
        ${s.services.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Service</th><th>Price</th><th>Time</th></tr></thead><tbody>
        ${s.services.map(v => `<tr><td>${esc(v.name)}</td><td>₹${v.price_min} – ₹${v.price_max}</td><td>${v.est_minutes} min</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">This shop has not listed services yet.</p>'}
        <p class="muted" style="margin-top:.6em">Final price is confirmed after inspection.</p>
      </div>

      <div class="box"><h3>Spare parts</h3>
        ${s.spares.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Part</th><th>Fits</th><th>Price</th><th>Stock</th></tr></thead><tbody>
        ${s.spares.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.compatible_with)}</td><td>₹${p.price}</td>
          <td><span class="pill ${p.stock > 0 ? 'stock' : 'out'}">${p.stock > 0 ? p.stock + ' in stock' : 'Out of stock'}</span></td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">No spare parts listed.</p>'}
      </div>

      <div class="box"><h3>Reviews</h3>
        ${s.reviews.length ? s.reviews.map(r => `<div style="margin-bottom:.8em"><b>${esc(r.user_name)}</b> ${stars(r.rating)}
          <div>${esc(r.comment)}</div></div>`).join('') : '<p class="muted">Be the first to review this shop.</p>'}
        ${u && u.role === 'customer' ? `
        <hr>
        <div class="d-flex gap-2 flex-wrap">
          <select id="rate" class="form-select" style="max-width:110px" aria-label="Rating">
            ${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${n} ★</option>`).join('')}</select>
          <input id="rcomment" class="form-control" style="flex:1;min-width:200px" placeholder="How was your repair?">
          <button class="btn btn-light" id="rsend">Post review</button>
        </div>` : ''}
      </div>
    </div>

    <div>
      <div class="box"><h3>Ask about your repair</h3>
        <p class="muted">Example: “Can you fix an iPhone 11 screen? Is the display in stock?”</p>
        <div class="chat">
          <div class="chat-log" id="log" aria-live="polite"></div>
          <div class="d-flex gap-2" style="margin-top:.5em">
            <input id="msg" class="form-control" placeholder="Type your question">
            <button class="btn btn-light" id="send">Ask</button>
          </div>
        </div>
      </div>

      <div class="box"><h3>Book this shop</h3>
        ${u && u.role === 'customer' ? `
        <label class="form-label">Repair needed</label>
        <select id="bsvc" class="form-select mb-2"><option value="">Not sure / other</option>
          ${s.services.map(v => `<option value="${v.id}">${esc(v.name)} (from ₹${v.price_min})</option>`).join('')}</select>
        <label class="form-label">Device or vehicle</label>
        <input id="bdev" class="form-control mb-2" placeholder="e.g. iPhone 11, Honda Activa">
        <label class="form-label">What is wrong?</label>
        <textarea id="bissue" class="form-control mb-2" rows="2"></textarea>
        <label class="form-label">Preferred time</label>
        <input id="bslot" type="datetime-local" class="form-control mb-3">
        <button class="btn btn-light w-100" id="book">Send booking request</button>`
        : u ? '<p class="muted">Log in with a customer account to book.</p>'
            : '<p class="muted"><a href="login.html">Log in</a> to book and pay online.</p>'}
      </div>
    </div>
  </div>`;
  wire();
  addBubble('bot', 'Hi! Ask me if a repair is possible here, what it costs, or whether a part is in stock.');
}

function addBubble(who, text) {
  const log = document.getElementById('log');
  const b = document.createElement('div'); b.className = 'bubble ' + who; b.textContent = text;
  log.appendChild(b); log.scrollTop = log.scrollHeight;
}

function wire() {
  const send = async () => {
    const i = document.getElementById('msg'), m = i.value.trim(); if (!m) return;
    i.value = ''; addBubble('me', m);
    try { addBubble('bot', (await api('/chat', { method: 'POST', body: { shop_id: shop.id, message: m } })).reply); }
    catch (e) { addBubble('bot', e.message); }
  };
  document.getElementById('send').onclick = send;
  document.getElementById('msg').onkeydown = e => { if (e.key === 'Enter') send(); };

  const book = document.getElementById('book');
  if (book) book.onclick = async () => {
    try {
      await api('/bookings', { method: 'POST', body: {
        shop_id: shop.id, service_id: document.getElementById('bsvc').value || null,
        device: document.getElementById('bdev').value.trim(), issue: document.getElementById('bissue').value.trim(),
        slot: document.getElementById('bslot').value } });
      toast('Booking sent. You can pay once the shop accepts it.');
      setTimeout(() => location.href = 'dashboard.html', 900);
    } catch (e) { toast(e.message, true); }
  };
  const rs = document.getElementById('rsend');
  if (rs) rs.onclick = async () => {
    try {
      await api(`/shops/${shop.id}/reviews`, { method: 'POST', body: { rating: document.getElementById('rate').value, comment: document.getElementById('rcomment').value } });
      shop = await api('/shops/' + shopId); render(); toast('Review saved.');
    } catch (e) { toast(e.message, true); }
  };
}

(async () => {
  try { shop = await api('/shops/' + shopId); render(); document.title = shop.name + ' – RepairHub'; }
  catch (e) { app.innerHTML = `<div class="box">${esc(e.message)} <a href="index.html">Back to shops</a></div>`; }
})();

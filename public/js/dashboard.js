const app = document.getElementById('app');
const user = Auth.user;
const when = (s) => (s ? s.replace('T', ' ') : 'Any time');

if (!user) {
  app.innerHTML = '<div class="box">Please <a href="login.html">log in</a> to see your dashboard.</div>';
} else if (user.role === 'owner') ownerView(); else customerView();

/* ---------------- Customer ---------------- */
async function customerView() {
  try {
    const rows = await api('/bookings/mine');
    app.innerHTML = `<div class="box"><h2>My bookings</h2>
      ${rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Shop</th><th>Repair</th><th>Device</th><th>When</th><th>Status</th><th>Amount</th><th></th></tr></thead><tbody>
      ${rows.map(b => `<tr><td><a href="shop.html?id=${b.shop_id}">${esc(b.shop_name)}</a></td><td>${esc(b.service_name || 'General')}</td><td>${esc(b.device)}</td>
        <td>${esc(when(b.slot))}</td><td class="status">${b.status}${b.payment_status === 'paid' ? ' · paid' : ''}</td><td>₹${b.amount}</td>
        <td>${b.payment_status === 'unpaid' && ['accepted', 'completed'].includes(b.status) ? `<button class="btn btn-light btn-sm" data-pay="${b.id}">Pay ₹${b.amount}</button>` : ''}
            ${['pending', 'accepted'].includes(b.status) && b.payment_status === 'unpaid' ? `<button class="btn btn-outline-light btn-sm" data-cancel="${b.id}">Cancel</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<p>No bookings yet. <a href="index.html">Find a shop</a> to book your first repair.</p>'}</div>`;
    app.querySelectorAll('[data-pay]').forEach(b => b.onclick = async () => {
      try {
        const c = await api('/payments/checkout', { method: 'POST', body: { booking_id: +b.dataset.pay } });
        // MOCK: confirm immediately. With Razorpay, open its checkout here, then call /confirm in its success handler.
        await api('/payments/confirm', { method: 'POST', body: { payment_id: c.payment_id } });
        toast('Payment received.'); customerView();
      } catch (e) { toast(e.message, true); }
    });
    app.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => {
      try { await api(`/bookings/${b.dataset.cancel}/status`, { method: 'PATCH', body: { status: 'cancelled' } }); customerView(); }
      catch (e) { toast(e.message, true); }
    });
  } catch (e) { app.innerHTML = `<div class="box">${esc(e.message)} <a href="login.html">Log in</a></div>`; }
}

/* ---------------- Owner ---------------- */
async function ownerView() {
  const shop = await api('/shops/mine/info');
  if (!shop) return shopForm(null);
  const bookings = await api('/bookings/shop');
  app.innerHTML = `
  <div class="box d-flex justify-content-between flex-wrap gap-2 align-items-center">
    <div><h2 style="margin:0">${esc(shop.name)}</h2><span class="muted">${CAT[shop.category]} · ${shop.open_time}–${shop.close_time}</span></div>
    <label class="toggle"><input type="checkbox" id="avail" ${shop.is_open ? 'checked' : ''}> Accepting customers today</label>
    <button class="btn btn-outline-light btn-sm" id="editShop">Edit shop details</button>
  </div>

  <div class="box"><h3>Booking requests</h3>
    ${bookings.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Customer</th><th>Repair</th><th>Device / issue</th><th>When</th><th>Status</th><th>Amount ₹</th><th></th></tr></thead><tbody>
    ${bookings.map(b => `<tr><td>${esc(b.customer_name)}</td><td>${esc(b.service_name || 'General')}</td><td>${esc(b.device)}<div class="muted">${esc(b.issue)}</div></td>
      <td>${esc(when(b.slot))}</td><td class="status">${b.status}${b.payment_status === 'paid' ? ' · paid' : ''}</td>
      <td><input type="number" class="form-control form-control-sm" style="width:90px" value="${b.amount}" data-amt="${b.id}"></td>
      <td>${b.status === 'pending' ? `<button class="btn btn-light btn-sm" data-st="accepted" data-id="${b.id}">Accept</button> <button class="btn btn-outline-light btn-sm" data-st="rejected" data-id="${b.id}">Decline</button>` : ''}
          ${b.status === 'accepted' ? `<button class="btn btn-light btn-sm" data-st="completed" data-id="${b.id}">Mark done</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted">No booking requests yet.</p>'}</div>

  <div class="two">
    <div class="box"><h3>Repairs and prices</h3>
      ${shop.services.length ? `<table class="t"><tbody>${shop.services.map(v => `<tr><td>${esc(v.name)}</td><td>₹${v.price_min}–₹${v.price_max}</td><td>${v.est_minutes} min</td>
        <td><button class="btn btn-outline-light btn-sm" data-delsvc="${v.id}">Remove</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Add your first repair so customers can see prices.</p>'}
      <hr>
      <div class="row g-2">
        <div class="col-12"><input id="svName" class="form-control" placeholder="Repair name"></div>
        <div class="col-4"><input id="svMin" type="number" class="form-control" placeholder="Min ₹"></div>
        <div class="col-4"><input id="svMax" type="number" class="form-control" placeholder="Max ₹"></div>
        <div class="col-4"><input id="svMin2" type="number" class="form-control" placeholder="Minutes"></div>
        <div class="col-12"><button class="btn btn-light" id="addSvc">Add repair</button></div>
      </div>
    </div>

    <div class="box"><h3>Spare parts stock</h3>
      ${shop.spares.length ? `<table class="t"><tbody>${shop.spares.map(p => `<tr><td>${esc(p.name)}<div class="muted">${esc(p.compatible_with)}</div></td>
        <td><input type="number" class="form-control form-control-sm" style="width:80px" value="${p.price}" data-pp="${p.id}" aria-label="Price"></td>
        <td><input type="number" class="form-control form-control-sm" style="width:70px" value="${p.stock}" data-ps="${p.id}" aria-label="Stock"></td>
        <td><button class="btn btn-outline-light btn-sm" data-delsp="${p.id}">Remove</button></td></tr>`).join('')}</tbody></table>
        <button class="btn btn-light btn-sm" id="saveSpares" style="margin-top:.5em">Save price and stock changes</button>` : '<p class="muted">Add parts so the chatbot can answer stock questions.</p>'}
      <hr>
      <div class="row g-2">
        <div class="col-6"><input id="spName" class="form-control" placeholder="Part (e.g. Display)"></div>
        <div class="col-6"><input id="spFit" class="form-control" placeholder="Fits (e.g. iPhone 11)"></div>
        <div class="col-6"><input id="spPrice" type="number" class="form-control" placeholder="Price ₹"></div>
        <div class="col-6"><input id="spStock" type="number" class="form-control" placeholder="Stock"></div>
        <div class="col-12"><button class="btn btn-light" id="addSp">Add part</button></div>
      </div>
    </div>
  </div>`;

  const run = (fn) => async (...a) => { try { await fn(...a); ownerView(); } catch (e) { toast(e.message, true); } };
  const val = (id) => document.getElementById(id).value;

  document.getElementById('avail').onchange = run(e => api(`/shops/${shop.id}/availability`, { method: 'PATCH', body: { is_open: e.target.checked } }));
  document.getElementById('editShop').onclick = () => shopForm(shop);
  app.querySelectorAll('[data-st]').forEach(b => b.onclick = run(() =>
    api(`/bookings/${b.dataset.id}/status`, { method: 'PATCH', body: { status: b.dataset.st, amount: document.querySelector(`[data-amt="${b.dataset.id}"]`).value } })));
  document.getElementById('addSvc').onclick = run(() => api(`/shops/${shop.id}/services`, { method: 'POST',
    body: { name: val('svName'), price_min: val('svMin'), price_max: val('svMax'), est_minutes: val('svMin2') } }));
  app.querySelectorAll('[data-delsvc]').forEach(b => b.onclick = run(() => api(`/shops/${shop.id}/services/${b.dataset.delsvc}`, { method: 'DELETE' })));
  document.getElementById('addSp').onclick = run(() => api(`/shops/${shop.id}/spares`, { method: 'POST',
    body: { name: val('spName'), compatible_with: val('spFit'), price: val('spPrice'), stock: val('spStock') } }));
  app.querySelectorAll('[data-delsp]').forEach(b => b.onclick = run(() => api(`/shops/${shop.id}/spares/${b.dataset.delsp}`, { method: 'DELETE' })));
  const ss = document.getElementById('saveSpares');
  if (ss) ss.onclick = run(async () => {
    for (const el of app.querySelectorAll('[data-pp]')) {
      const id = el.dataset.pp, stock = app.querySelector(`[data-ps="${id}"]`).value;
      await api(`/shops/${shop.id}/spares/${id}`, { method: 'PATCH', body: { price: +el.value, stock: +stock } });
    }
    toast('Stock updated.');
  });
}

function shopForm(shop) {
  const s = shop || { category: 'mobile', open_time: '09:00', close_time: '20:00' };
  app.innerHTML = `<div class="box" style="max-width:640px"><h2>${shop ? 'Edit shop details' : 'Set up your shop'}</h2>
    <div class="mb-2"><label class="form-label">Shop name</label><input id="f_name" class="form-control" value="${esc(s.name)}"></div>
    <div class="mb-2"><label class="form-label">Type of repairs</label><select id="f_cat" class="form-select">
      ${Object.entries(CAT).map(([k, v]) => `<option value="${k}" ${s.category === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="mb-2"><label class="form-label">Description</label><textarea id="f_desc" class="form-control" rows="2">${esc(s.description)}</textarea></div>
    <div class="mb-2"><label class="form-label">Address</label><input id="f_addr" class="form-control" value="${esc(s.address)}"></div>
    <div class="row g-2 mb-2">
      <div class="col-md-6"><label class="form-label">City</label><input id="f_city" class="form-control" value="${esc(s.city)}"></div>
      <div class="col-md-6"><label class="form-label">Phone</label><input id="f_phone" class="form-control" value="${esc(s.phone)}"></div>
      <div class="col-md-6"><label class="form-label">Opens</label><input id="f_open" type="time" class="form-control" value="${s.open_time}"></div>
      <div class="col-md-6"><label class="form-label">Closes</label><input id="f_close" type="time" class="form-control" value="${s.close_time}"></div>
      <div class="col-md-5"><label class="form-label">Latitude</label><input id="f_lat" class="form-control" value="${s.lat ?? ''}"></div>
      <div class="col-md-5"><label class="form-label">Longitude</label><input id="f_lng" class="form-control" value="${s.lng ?? ''}"></div>
      <div class="col-md-2 d-flex align-items-end"><button class="btn btn-outline-light w-100" id="here" type="button">Use GPS</button></div>
    </div>
    <button class="btn btn-light" id="saveShop">Save shop</button>
  </div>`;
  const v = (id) => document.getElementById(id).value;
  document.getElementById('here').onclick = () => navigator.geolocation?.getCurrentPosition(
    p => { document.getElementById('f_lat').value = p.coords.latitude.toFixed(5); document.getElementById('f_lng').value = p.coords.longitude.toFixed(5); },
    () => toast('Location blocked in your browser.', true));
  document.getElementById('saveShop').onclick = async () => {
    const body = { name: v('f_name'), category: v('f_cat'), description: v('f_desc'), address: v('f_addr'), city: v('f_city'),
      phone: v('f_phone'), open_time: v('f_open'), close_time: v('f_close'), lat: v('f_lat'), lng: v('f_lng') };
    try { await api(shop ? '/shops/' + shop.id : '/shops', { method: shop ? 'PUT' : 'POST', body }); toast('Shop saved.'); ownerView(); }
    catch (e) { toast(e.message, true); }
  };
}

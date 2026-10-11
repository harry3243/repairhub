// Builds the top bar, sidebar and footer around <main id="app"> so every page shares one shell.
(function () {
  const user = Auth.user;
  const page = location.pathname.split('/').pop() || 'index.html';
  const active = (p) => (page === p ? 'active' : '');

  const nav = `
  <nav class="topbar">
    <span class="brand">RepairHub</span>
    <div>
      ${user ? `<span class="who">${esc(user.name)} (${user.role})</span><button class="btn btn-dark btn-sm" id="logout">Log out</button>`
             : `<a class="btn btn-dark btn-sm" href="login.html">Log in / Sign up</a>`}
    </div>
  </nav>`;

  const sidebar = `
  <aside id="sidebar"><ul>
    <li><button id="toggle-btn" aria-label="Collapse sidebar"><span class="arrow">«</span></button></li>
    <li class="${active('index.html')}"><a href="index.html"><span class="ico">⌂</span><span class="t">Find a shop</span></a></li>
    <li>
      <button class="dropdown-btn" data-submenu><span class="ico">☰</span><span class="t">Categories</span><span class="chev">▾</span></button>
      <div class="sub-menu"><ul>
        <li><a href="index.html?category=mobile">Mobile repair</a></li>
        <li><a href="index.html?category=bike">Bike mechanics</a></li>
        <li><a href="index.html?category=auto">Auto / Car garages</a></li>
        <li><a href="index.html?category=electronics">Electronics repair</a></li>
      </ul></div>
    </li>
    <li class="${active('dashboard.html')}"><a href="dashboard.html"><span class="ico">▦</span><span class="t">${user && user.role === 'owner' ? 'My shop' : 'My bookings'}</span></a></li>
  </ul></aside>`;

  document.body.insertAdjacentHTML('afterbegin', nav + sidebar);
  document.body.insertAdjacentHTML('beforeend', '<footer class="foot">© RepairHub · Symbiosys Technology</footer>');

  const sb = document.getElementById('sidebar');
  if (localStorage.getItem('rh_sb') === 'close') sb.classList.add('close');
  document.getElementById('toggle-btn').onclick = () => {
    sb.classList.toggle('close');
    localStorage.setItem('rh_sb', sb.classList.contains('close') ? 'close' : 'open');
    sb.querySelectorAll('.sub-menu.show').forEach(m => { m.classList.remove('show'); m.previousElementSibling.classList.remove('rotate'); });
  };
  sb.querySelectorAll('[data-submenu]').forEach(btn => btn.onclick = () => {
    if (sb.classList.contains('close')) { sb.classList.remove('close'); localStorage.setItem('rh_sb', 'open'); }
    btn.nextElementSibling.classList.toggle('show');
    btn.classList.toggle('rotate');
  });
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = () => { Auth.clear(); location.href = 'index.html'; };
})();

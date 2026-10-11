const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

const CATS = ['mobile', 'bike', 'auto', 'electronics'];

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// "Open now" = owner toggle is on AND current time is inside working hours
function openNow(s) {
  if (!s.is_open) return false;
  const n = new Date();
  const cur = n.getHours() * 60 + n.getMinutes();
  const [oh, om] = (s.open_time || '00:00').split(':').map(Number);
  const [ch, cm] = (s.close_time || '23:59').split(':').map(Number);
  return cur >= oh * 60 + om && cur <= ch * 60 + cm;
}

// GET /api/shops?category=&q=&lat=&lng=&open=1&maxKm=
router.get('/', (req, res) => {
  const { category, q, lat, lng, open, maxKm } = req.query;
  let sql = `SELECT s.*,
      (SELECT ROUND(AVG(rating),1) FROM reviews WHERE shop_id=s.id) AS rating,
      (SELECT COUNT(*) FROM reviews WHERE shop_id=s.id) AS review_count,
      (SELECT MIN(price_min) FROM services WHERE shop_id=s.id) AS from_price
    FROM shops s WHERE 1=1`;
  const p = [];
  if (CATS.includes(category)) { sql += ' AND s.category=?'; p.push(category); }
  if (q) {
    sql += ` AND (s.name LIKE ? OR s.address LIKE ? OR s.city LIKE ?
      OR EXISTS (SELECT 1 FROM services v WHERE v.shop_id=s.id AND v.name LIKE ?)
      OR EXISTS (SELECT 1 FROM spares sp WHERE sp.shop_id=s.id AND (sp.name LIKE ? OR sp.compatible_with LIKE ?)))`;
    const l = `%${q}%`; p.push(l, l, l, l, l, l);
  }
  let rows = db.prepare(sql).all(...p).map(s => ({ ...s, open_now: openNow(s) }));
  if (open === '1') rows = rows.filter(s => s.open_now);
  if (lat && lng) {
    rows.forEach(s => { s.distance_km = s.lat != null ? +distanceKm(+lat, +lng, s.lat, s.lng).toFixed(1) : null; });
    if (maxKm) rows = rows.filter(s => s.distance_km != null && s.distance_km <= +maxKm);
    rows.sort((a, b) => (a.distance_km ?? 9e9) - (b.distance_km ?? 9e9));
  } else {
    rows.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }
  res.json(rows);
});

// Owner's own shop
router.get('/mine/info', auth('owner'), (req, res) => {
  const s = db.prepare('SELECT * FROM shops WHERE owner_id=?').get(req.user.id);
  if (!s) return res.json(null);
  s.services = db.prepare('SELECT * FROM services WHERE shop_id=? ORDER BY price_min').all(s.id);
  s.spares = db.prepare('SELECT * FROM spares WHERE shop_id=? ORDER BY name').all(s.id);
  res.json(s);
});

router.get('/:id', (req, res) => {
  const s = db.prepare(`SELECT s.*,
      (SELECT ROUND(AVG(rating),1) FROM reviews WHERE shop_id=s.id) AS rating,
      (SELECT COUNT(*) FROM reviews WHERE shop_id=s.id) AS review_count
    FROM shops s WHERE id=?`).get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Shop not found.' });
  s.open_now = openNow(s);
  s.services = db.prepare('SELECT * FROM services WHERE shop_id=? ORDER BY price_min').all(s.id);
  s.spares = db.prepare('SELECT * FROM spares WHERE shop_id=? ORDER BY name').all(s.id);
  s.reviews = db.prepare(`SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id=r.user_id
    WHERE shop_id=? ORDER BY r.created_at DESC`).all(s.id);
  res.json(s);
});

function shopFields(b) {
  const num = v => (v === '' || v == null ? null : +v);
  return [b.name, b.category, b.description || '', b.address || '', b.city || '',
    num(b.lat), num(b.lng), b.phone || '', b.open_time || '09:00', b.close_time || '20:00'];
}

router.post('/', auth('owner'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !CATS.includes(b.category)) return res.status(400).json({ error: 'Shop name and a valid category are required.' });
  if (db.prepare('SELECT 1 FROM shops WHERE owner_id=?').get(req.user.id))
    return res.status(409).json({ error: 'You already have a shop. Edit it instead.' });
  const i = db.prepare(`INSERT INTO shops (owner_id,name,category,description,address,city,lat,lng,phone,open_time,close_time)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, ...shopFields(b));
  res.json({ id: i.lastInsertRowid });
});

function ownShop(req, res, next) {
  const s = db.prepare('SELECT * FROM shops WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Shop not found.' });
  if (s.owner_id !== req.user.id) return res.status(403).json({ error: 'This is not your shop.' });
  req.shop = s; next();
}

router.put('/:id', auth('owner'), ownShop, (req, res) => {
  const b = req.body || {};
  if (!b.name || !CATS.includes(b.category)) return res.status(400).json({ error: 'Shop name and a valid category are required.' });
  db.prepare(`UPDATE shops SET name=?,category=?,description=?,address=?,city=?,lat=?,lng=?,phone=?,open_time=?,close_time=? WHERE id=?`)
    .run(...shopFields(b), req.shop.id);
  res.json({ ok: true });
});

router.patch('/:id/availability', auth('owner'), ownShop, (req, res) => {
  db.prepare('UPDATE shops SET is_open=? WHERE id=?').run(req.body.is_open ? 1 : 0, req.shop.id);
  res.json({ ok: true });
});

// services
router.post('/:id/services', auth('owner'), ownShop, (req, res) => {
  const { name, price_min, price_max, est_minutes } = req.body || {};
  if (!name || price_min == null || price_max == null) return res.status(400).json({ error: 'Service name and price range are required.' });
  const i = db.prepare('INSERT INTO services (shop_id,name,price_min,price_max,est_minutes) VALUES (?,?,?,?,?)')
    .run(req.shop.id, name, +price_min, +price_max, +est_minutes || 60);
  res.json({ id: i.lastInsertRowid });
});
router.delete('/:id/services/:sid', auth('owner'), ownShop, (req, res) => {
  db.prepare('DELETE FROM services WHERE id=? AND shop_id=?').run(req.params.sid, req.shop.id);
  res.json({ ok: true });
});

// spares
router.post('/:id/spares', auth('owner'), ownShop, (req, res) => {
  const { name, compatible_with, price, stock } = req.body || {};
  if (!name || price == null) return res.status(400).json({ error: 'Spare part name and price are required.' });
  const i = db.prepare('INSERT INTO spares (shop_id,name,compatible_with,price,stock) VALUES (?,?,?,?,?)')
    .run(req.shop.id, name, compatible_with || '', +price, +stock || 0);
  res.json({ id: i.lastInsertRowid });
});
router.patch('/:id/spares/:pid', auth('owner'), ownShop, (req, res) => {
  const { price, stock } = req.body || {};
  db.prepare('UPDATE spares SET price=COALESCE(?,price), stock=COALESCE(?,stock) WHERE id=? AND shop_id=?')
    .run(price ?? null, stock ?? null, req.params.pid, req.shop.id);
  res.json({ ok: true });
});
router.delete('/:id/spares/:pid', auth('owner'), ownShop, (req, res) => {
  db.prepare('DELETE FROM spares WHERE id=? AND shop_id=?').run(req.params.pid, req.shop.id);
  res.json({ ok: true });
});

// reviews (one per customer per shop; posting again updates it)
router.post('/:id/reviews', auth('customer'), (req, res) => {
  const rating = +req.body.rating;
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Choose a rating from 1 to 5.' });
  if (!db.prepare('SELECT 1 FROM shops WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Shop not found.' });
  db.prepare(`INSERT INTO reviews (shop_id,user_id,rating,comment) VALUES (?,?,?,?)
    ON CONFLICT(shop_id,user_id) DO UPDATE SET rating=excluded.rating, comment=excluded.comment, created_at=CURRENT_TIMESTAMP`)
    .run(req.params.id, req.user.id, rating, (req.body.comment || '').slice(0, 500));
  res.json({ ok: true });
});

module.exports = router;

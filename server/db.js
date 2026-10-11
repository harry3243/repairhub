const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbFile = path.join(__dirname, '..', 'data', 'repairhub.db');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer','owner')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('mobile','bike','auto','electronics')),
  description TEXT,
  address TEXT,
  city TEXT,
  lat REAL, lng REAL,
  phone TEXT,
  is_open INTEGER DEFAULT 1,
  open_time TEXT DEFAULT '09:00',
  close_time TEXT DEFAULT '20:00',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_min INTEGER NOT NULL,
  price_max INTEGER NOT NULL,
  est_minutes INTEGER DEFAULT 60
);
CREATE TABLE IF NOT EXISTS spares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  compatible_with TEXT,
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (shop_id, user_id)
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  device TEXT,
  issue TEXT,
  slot TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','completed','cancelled')),
  amount INTEGER DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

function seed() {
  const hash = bcrypt.hashSync('password123', 10);
  const addUser = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)');
  const addShop = db.prepare(`INSERT INTO shops (owner_id,name,category,description,address,city,lat,lng,phone,is_open,open_time,close_time)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const addSvc = db.prepare('INSERT INTO services (shop_id,name,price_min,price_max,est_minutes) VALUES (?,?,?,?,?)');
  const addSpare = db.prepare('INSERT INTO spares (shop_id,name,compatible_with,price,stock) VALUES (?,?,?,?,?)');

  addUser.run('Demo Customer', 'customer@demo.com', hash, 'customer');

  const shops = [
    ['Whitefield Mobile Care', 'mobile', 'Screen, battery and charging-port repairs for all major phone brands.', '12 ITPL Main Rd, Whitefield', 'Bengaluru', 12.9698, 77.7500, '9800000001', 1, '00:00', '23:59',
      [['Screen replacement', 1500, 6000, 45], ['Battery replacement', 600, 1800, 30], ['Charging port repair', 400, 900, 40]],
      [['Display', 'iPhone 11', 4200, 3], ['Display', 'Samsung A52', 2800, 0], ['Battery', 'Redmi Note 10', 650, 8]]],
    ['Koramangala Phone Clinic', 'mobile', 'Same-day repairs, water damage and motherboard work.', '80 Feet Rd, Koramangala', 'Bengaluru', 12.9352, 77.6245, '9800000002', 1, '10:00', '20:00',
      [['Screen replacement', 1800, 7500, 60], ['Water damage cleaning', 800, 2500, 120]],
      [['Display', 'OnePlus 9', 5200, 2], ['Battery', 'iPhone 12', 1800, 4]]],
    ['Indiranagar Bike Works', 'bike', 'Two-wheeler servicing, puncture, chain and brake work.', '100 Feet Rd, Indiranagar', 'Bengaluru', 12.9784, 77.6408, '9800000003', 1, '08:00', '19:00',
      [['General service', 500, 1200, 90], ['Brake pad replacement', 250, 600, 30], ['Puncture repair', 80, 200, 15]],
      [['Brake pads', 'Honda Activa', 280, 10], ['Chain set', 'Royal Enfield Classic 350', 1400, 2], ['Air filter', 'Bajaj Pulsar 150', 220, 0]]],
    ['Marathahalli Auto Garage', 'auto', 'Car servicing, AC repair, denting and painting.', 'Outer Ring Rd, Marathahalli', 'Bengaluru', 12.9569, 77.7011, '9800000004', 0, '09:00', '18:00',
      [['Full car service', 2500, 6000, 240], ['AC gas refill', 1200, 2500, 90], ['Brake overhaul', 1500, 4000, 120]],
      [['Oil filter', 'Maruti Swift', 250, 12], ['Brake pads', 'Hyundai i20', 1800, 3]]],
    ['HSR Electronics Repair Hub', 'electronics', 'TV, laptop, washing machine, mixer and microwave repairs.', '27th Main, HSR Layout', 'Bengaluru', 12.9116, 77.6474, '9800000005', 1, '10:00', '19:30',
      [['Laptop screen replacement', 2500, 7000, 120], ['TV panel diagnosis', 300, 800, 45], ['Washing machine repair', 500, 2500, 90]],
      [['Laptop SSD 512GB', 'Any laptop', 3200, 5], ['Laptop display', 'Dell Inspiron 15', 4500, 1]]],
  ];

  shops.forEach((s, i) => {
    const o = addUser.run(`Owner ${i + 1}`, `owner${i + 1}@demo.com`, hash, 'owner');
    const sh = addShop.run(o.lastInsertRowid, ...s.slice(0, 11));
    s[11].forEach(v => addSvc.run(sh.lastInsertRowid, ...v));
    s[12].forEach(v => addSpare.run(sh.lastInsertRowid, ...v));
  });
  const c = db.prepare('SELECT id FROM users WHERE email=?').get('customer@demo.com').id;
  db.prepare('INSERT INTO reviews (shop_id,user_id,rating,comment) VALUES (?,?,?,?)')
    .run(1, c, 5, 'Fixed my screen in under an hour. Price matched what was shown.');
}

if (process.argv.includes('--reseed')) {
  db.exec('DELETE FROM payments; DELETE FROM bookings; DELETE FROM reviews; DELETE FROM spares; DELETE FROM services; DELETE FROM shops; DELETE FROM users;');
  seed();
  console.log('Database reseeded.');
} else if (db.prepare('SELECT COUNT(*) c FROM shops').get().c === 0) {
  seed();
  console.log('Seeded demo data.');
}

module.exports = db;

# RepairHub

Find repair shops (mobile, bike, auto/car, electronics) with live availability, price ranges,
spare-part stock, reviews, an "is this repair possible?" chatbot, booking and payment.

## Run it
```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm start
```
Open http://localhost:3000. Demo data is created on first run.

Demo logins (password `password123`): `customer@demo.com`, `owner1@demo.com` ... `owner5@demo.com`.
Reset demo data: `npm run seed`.

## Structure
```
repairhub/
├── server/
│   ├── index.js              Express app, mounts routes, serves /public
│   ├── db.js                 SQLite schema + demo seed
│   ├── middleware/auth.js    JWT login, role check (customer / owner)
│   ├── routes/
│   │   ├── auth.js           register, login
│   │   ├── shops.js          search/nearby, detail, owner edits, services, spares, reviews, availability
│   │   ├── bookings.js       create, list, accept/decline/complete/cancel
│   │   ├── payments.js       checkout + confirm (mock now, Razorpay notes inside)
│   │   └── chat.js           chatbot endpoint
│   └── services/chatbot.js   rule-based answers from shop data; uses Claude if ANTHROPIC_API_KEY is set
├── public/
│   ├── index.html + js/home.js        search, category filter, open-now, nearest first
│   ├── shop.html  + js/shop.js        prices, spares, reviews, chatbot, booking
│   ├── login.html + js/auth.js
│   ├── dashboard.html + js/dashboard.js   owner: shop, availability, services, stock, bookings. customer: bookings, pay
│   ├── js/layout.js                   shared top bar + sidebar + footer
│   ├── js/api.js                      fetch helper, login state
│   └── css/style.css
└── data/                     SQLite file is created here
```

## Main API
| Method | Path | Who |
|---|---|---|
| GET | /api/shops?category=&q=&lat=&lng=&open=1 | anyone |
| GET | /api/shops/:id | anyone |
| POST/PUT | /api/shops, /api/shops/:id | owner |
| PATCH | /api/shops/:id/availability | owner |
| POST/DELETE | /api/shops/:id/services, /spares | owner |
| POST | /api/shops/:id/reviews | customer |
| POST | /api/chat  `{shop_id, message}` | anyone |
| POST | /api/bookings | customer |
| PATCH | /api/bookings/:id/status | owner or customer |
| POST | /api/payments/checkout, /confirm | customer |

## Next steps
1. Real payments: follow the Razorpay notes at the top of `server/routes/payments.js`.
2. Map view: add Leaflet + OpenStreetMap on `index.html` using each shop's lat/lng.
3. Live availability: add SSE or WebSocket so "Open now" and stock update instantly.
4. Move SQLite to PostgreSQL once you have many shops.
5. Shop photo upload, owner verification (GST / shop licence), SMS/WhatsApp booking alerts.
6. Use HTTPS and set a strong `JWT_SECRET` before going live.

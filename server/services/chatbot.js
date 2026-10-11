const db = require('../db');

const STOP = new Set(['can','you','the','my','is','are','do','does','have','has','any','for','a','an','and','or','of','to','in','on','it','i','me','please','how','much','what','will','this','that','with','available','repair','fix','price','cost','stock']);
const tokens = (t) => (t.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w) && w.length > 1);

// Built-in answer: looks at this shop's real services and spares. Works without any API key.
function ruleBased(shop, services, spares, message) {
  const words = tokens(message);
  const hit = (text) => words.filter(w => text.toLowerCase().includes(w)).length;

  const svc = services.map(s => ({ s, score: hit(s.name) })).filter(x => x.score).sort((a, b) => b.score - a.score)[0];
  const part = spares.map(p => ({ p, score: hit(p.name + ' ' + (p.compatible_with || '')) })).filter(x => x.score).sort((a, b) => b.score - a.score)[0];

  const lines = [];
  if (svc) lines.push(`Yes, ${shop.name} offers "${svc.s.name}": ₹${svc.s.price_min}–₹${svc.s.price_max}, about ${svc.s.est_minutes} min.`);
  if (part) {
    const p = part.p;
    lines.push(p.stock > 0
      ? `Spare in stock: ${p.name} for ${p.compatible_with || 'various models'} at ₹${p.price} (${p.stock} left).`
      : `The ${p.name} for ${p.compatible_with || 'this model'} is out of stock right now (₹${p.price} when available). Call ${shop.phone || 'the shop'} to ask about ordering it.`);
  }
  if (!svc && !part) {
    lines.push(`I could not find that in ${shop.name}'s list.`);
    if (services.length) lines.push('They currently list: ' + services.map(s => s.name).join(', ') + '.');
    lines.push(`Call ${shop.phone || 'the shop'} to confirm before visiting.`);
  } else {
    lines.push('The final price is confirmed after the technician inspects the device.');
  }
  return lines.join(' ');
}

async function askClaude(shop, services, spares, message) {
  const context = JSON.stringify({
    shop: { name: shop.name, category: shop.category, hours: `${shop.open_time}-${shop.close_time}`, phone: shop.phone },
    services, spares
  });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 400,
      system: 'You are the assistant for a repair shop listing. Answer only from the JSON data provided: whether the repair is offered, price range, time, and whether the spare part is in stock. If the data does not cover it, say so and suggest calling the shop. Never invent prices or stock. Keep answers under 80 words.',
      messages: [{ role: 'user', content: `Shop data: ${context}\n\nCustomer question: ${message}` }]
    })
  });
  if (!r.ok) throw new Error('Claude API ' + r.status);
  const d = await r.json();
  return d.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
}

async function answer(shopId, message) {
  const shop = db.prepare('SELECT * FROM shops WHERE id=?').get(shopId);
  if (!shop) return 'Shop not found.';
  const services = db.prepare('SELECT name,price_min,price_max,est_minutes FROM services WHERE shop_id=?').all(shopId);
  const spares = db.prepare('SELECT name,compatible_with,price,stock FROM spares WHERE shop_id=?').all(shopId);
  if (process.env.ANTHROPIC_API_KEY) {
    try { return await askClaude(shop, services, spares, message); } catch (e) { console.warn('Chatbot fallback:', e.message); }
  }
  return ruleBased(shop, services, spares, message);
}
module.exports = { answer };

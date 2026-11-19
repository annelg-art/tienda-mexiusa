/**
 * MEXIUSA · Servidor de cobro con tarjeta (Cloudflare Worker, plan gratuito) · Openpay by BBVA
 *
 * Recibe el token de tarjeta que genera openpay.js en la tienda (nunca el número de tarjeta),
 * RECALCULA el total con precios.json (no confía en el precio que manda el navegador)
 * y crea el cargo en Openpay con la llave privada, que vive solo aquí como secreto.
 * El dinero se deposita en la cuenta BBVA registrada en el panel de Openpay.
 *
 * Variables del Worker (Settings → Variables and Secrets):
 *   OPENPAY_MERCHANT_ID  (Text)    ID de comercio de Openpay (empieza con m…)
 *   OPENPAY_PRIVATE_KEY  (Secret)  Llave privada de Openpay (empieza con sk_)
 *   OPENPAY_SANDBOX      (Text)    true mientras pruebas · false en producción
 *   USE_3DS              (Text)    true para pedir confirmación del banco (3-D Secure) en cada compra
 *   SITE_URL             (Text)    https://annelg-art.github.io/tienda-mexiusa/
 *   ALLOWED_ORIGINS      (Text)    https://annelg-art.github.io   (separa varios con coma)
 */

let cache = { at: 0, data: null };

const json = (body, status, cors) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors },
});
const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const round2 = (n) => Math.round(n * 100) / 100;

async function precios(env) {
  if (cache.data && Date.now() - cache.at < 5 * 60 * 1000) return cache.data;
  const r = await fetch(new URL('precios.json', env.SITE_URL).toString(), { cf: { cacheTtl: 60 } });
  if (!r.ok) throw new Error('precios ' + r.status);
  cache = { at: Date.now(), data: await r.json() };
  return cache.data;
}

function shipCost(P, zone, kg) {
  const tiers = P.weightTiers, i = tiers.findIndex((t) => kg <= t);
  if (i >= 0) return zone.prices[i];
  const extra = Math.ceil((kg - tiers.at(-1)) / 10);
  return Math.round(zone.prices.at(-1) + extra * zone.prices[3] * P.extraPer10kg);
}

function openpay(env, path, init = {}) {
  const base = env.OPENPAY_SANDBOX === 'false' ? 'https://api.openpay.mx' : 'https://sandbox-api.openpay.mx';
  return fetch(`${base}/v1/${env.OPENPAY_MERCHANT_ID}${path}`, {
    ...init,
    headers: { Authorization: 'Basic ' + btoa(env.OPENPAY_PRIVATE_KEY + ':'), 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}
const last4 = (masked) => (String(masked || '').match(/(\d{4})$/) || [])[1] || '';

export default {
  async fetch(req, env) {
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    if (url.pathname === '/' && req.method === 'GET') return json({ ok: true, servicio: 'MEXIUSA pagos' }, 200, cors);
    if (!env.OPENPAY_MERCHANT_ID || !env.OPENPAY_PRIVATE_KEY || !env.SITE_URL) return json({ error: 'config' }, 500, cors);

    // ---- estado de un cargo (regreso de 3-D Secure) ----
    if (url.pathname === '/estado' && req.method === 'GET') {
      const id = url.searchParams.get('id') || '';
      if (!/^[a-z0-9]{10,40}$/i.test(id)) return json({ error: 'id' }, 400, cors);
      const r = await openpay(env, `/charges/${id}`).catch(() => null);
      const c = r && await r.json().catch(() => null);
      if (!r?.ok || !c) return json({ error: 'not_found' }, 404, cors);
      return json({ status: c.status, folio: c.order_id, amount: c.amount, last4: last4(c.card?.card_number) }, 200, cors);
    }

    if (url.pathname !== '/pagar' || req.method !== 'POST') return json({ error: 'not_found' }, 404, cors);
    if (!allowed.includes(origin)) return json({ error: 'origin' }, 403, cors);
    if (Number(req.headers.get('Content-Length') || 0) > 20000) return json({ error: 'too_large' }, 413, cors);

    let b;
    try { b = await req.json(); } catch { return json({ error: 'bad_json' }, 400, cors); }

    let P;
    try { P = await precios(env); } catch { return json({ error: 'precios' }, 503, cors); }

    // ---- validar pedido y recalcular el total con los precios oficiales ----
    const folio = str(b.folio, 40);
    if (!/^MXU-[A-Z0-9]{4,10}-[A-F0-9]{4}$/.test(folio)) return json({ error: 'folio' }, 400, cors);
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 60) return json({ error: 'items' }, 400, cors);
    const lines = [];
    for (const it of b.items) {
      const p = P.products[it?.id], qty = Number(it?.qty);
      if (!p || !Number.isInteger(qty) || qty < 1 || qty > (P.maxQtyPerItem || 5)) return json({ error: 'items' }, 400, cors);
      lines.push({ id: it.id, name: p.name, price: p.price, qty, kg: p.kg });
    }
    const buyer = b.buyer || {};
    const B = {
      name: str(buyer.name, 80), email: str(buyer.email, 120), phone: str(buyer.phone, 14).replace(/\D/g, ''),
      street: str(buyer.street, 80), col: str(buyer.col, 80), cp: str(buyer.cp, 5), city: str(buyer.city, 80), state: str(buyer.state, 40),
    };
    if (!B.name || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(B.email) || B.phone.length !== 10 || !/^\d{5}$/.test(B.cp)) return json({ error: 'buyer' }, 400, cors);
    const zone = P.zones.find((z) => z.states.includes(B.state));
    if (!zone) return json({ error: 'state' }, 400, cors);

    const subtotal = round2(lines.reduce((a, l) => a + round2(l.price * l.qty), 0));
    const kg = lines.reduce((a, l) => a + l.kg * l.qty, 0);
    const total = round2(subtotal + shipCost(P, zone, kg));
    if (Math.abs(total - Number(b.amount)) > 0.01) return json({ error: 'price_changed', total }, 409, cors);

    const token = str(b.token, 60), device = str(b.deviceSessionId, 255);
    if (!/^[a-z0-9]{10,60}$/i.test(token) || !device) return json({ error: 'card' }, 400, cors);

    const [first, ...rest] = B.name.split(' ');
    const use3ds = env.USE_3DS === 'true';
    const charge = {
      method: 'card',
      source_id: token,
      amount: total,
      currency: 'MXN',
      description: `Pedido ${folio} MEXIUSA: ${lines.map((l) => `${l.id}x${l.qty}`).join(', ')}`.slice(0, 250),
      order_id: folio,
      device_session_id: device,
      customer: { name: first, last_name: rest.join(' ') || first, phone_number: B.phone, email: B.email },
      ...(use3ds ? { use_3d_secure: true, redirect_url: new URL(`?pago=${folio}`, env.SITE_URL).toString() } : {}),
    };

    let r, res;
    try {
      r = await openpay(env, '/charges', { method: 'POST', body: JSON.stringify(charge) });
      res = await r.json();
    } catch {
      return json({ error: 'gateway_unreachable' }, 502, cors);
    }
    if (!r.ok) return json({ error: 'declined', error_code: res?.error_code || 0 }, 402, cors);
    if (res.payment_method?.url) return json({ status: res.status, redirect: res.payment_method.url }, 200, cors);

    // Solo devolvemos al navegador lo necesario para mostrar el resultado.
    return json({ id: res.id, status: res.status, amount: res.amount, last4: last4(res.card?.card_number), auth: res.authorization || '' }, 200, cors);
  },
};

/**
 * MEXIUSA · Servidor de cobro con tarjeta (Cloudflare Worker, plan gratuito).
 *
 * Recibe el token de tarjeta que genera el formulario de Mercado Pago en la tienda,
 * RECALCULA el total con precios.json (nunca confía en el precio que manda el navegador)
 * y crea el cobro en Mercado Pago con el Access Token, que vive solo aquí como secreto.
 *
 * Variables del Worker (Settings → Variables and Secrets):
 *   MP_ACCESS_TOKEN  (Secret)  Access Token de Mercado Pago (TEST-… para pruebas, APP_USR-… real)
 *   SITE_URL         (Text)    https://annelg-art.github.io/tienda-mexiusa/
 *   ALLOWED_ORIGINS  (Text)    https://annelg-art.github.io   (separa varios con coma)
 */

const MP_API = 'https://api.mercadopago.com/v1/payments';
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

export default {
  async fetch(req, env) {
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    if (url.pathname === '/' && req.method === 'GET') return json({ ok: true, servicio: 'MEXIUSA pagos' }, 200, cors);
    if (url.pathname !== '/pagar' || req.method !== 'POST') return json({ error: 'not_found' }, 404, cors);
    if (!allowed.includes(origin)) return json({ error: 'origin' }, 403, cors);
    if (!env.MP_ACCESS_TOKEN || !env.SITE_URL) return json({ error: 'config' }, 500, cors);
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
      street: str(buyer.street, 80), col: str(buyer.col, 80), cp: str(buyer.cp, 5), city: str(buyer.city, 80),
      state: str(buyer.state, 40), ref: str(buyer.ref, 140),
    };
    if (!B.name || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(B.email) || B.phone.length !== 10 || !/^\d{5}$/.test(B.cp)) return json({ error: 'buyer' }, 400, cors);
    const zone = P.zones.find((z) => z.states.includes(B.state));
    if (!zone) return json({ error: 'state' }, 400, cors);

    const subtotal = round2(lines.reduce((a, l) => a + round2(l.price * l.qty), 0));
    const kg = lines.reduce((a, l) => a + l.kg * l.qty, 0);
    const ship = shipCost(P, zone, kg);
    const total = round2(subtotal + ship);
    if (Math.abs(total - Number(b.amount)) > 0.01) return json({ error: 'price_changed', total }, 409, cors);

    // ---- datos de la tarjeta (solo el token de Mercado Pago, nunca el número) ----
    const c = b.card || {};
    const token = str(c.token, 100), method = str(c.payment_method_id, 40);
    const installments = Number(c.installments) || 1;
    if (!token || !method || !Number.isInteger(installments) || installments < 1 || installments > 24) return json({ error: 'card' }, 400, cors);
    const ident = c.payer?.identification;

    const [first, ...rest] = B.name.split(' ');
    const gift = b.gift ? { para: str(b.gift.to, 60), de: str(b.gift.from, 60), mensaje: str(b.gift.msg, 140) } : null;
    const invoice = b.invoice ? { rfc: str(b.invoice.rfc, 13), cp: str(b.invoice.cp, 5), regimen: str(b.invoice.regimen, 80) } : null;

    const payment = {
      transaction_amount: total,
      token,
      installments,
      payment_method_id: method,
      ...(c.issuer_id ? { issuer_id: String(c.issuer_id).slice(0, 20) } : {}),
      description: `Pedido ${folio} · MEXIUSA`,
      statement_descriptor: 'MEXIUSA',
      external_reference: folio,
      payer: {
        email: B.email,
        first_name: first, last_name: rest.join(' ') || first,
        ...(ident?.type && ident?.number ? { identification: { type: str(ident.type, 10), number: str(ident.number, 20) } } : {}),
      },
      additional_info: {
        items: lines.map((l) => ({ id: l.id, title: l.name.slice(0, 250), quantity: l.qty, unit_price: l.price })),
        payer: { first_name: first, last_name: rest.join(' ') || first, phone: { area_code: B.phone.slice(0, 2), number: B.phone.slice(2) } },
        shipments: { receiver_address: { zip_code: B.cp, street_name: `${B.street}, Col. ${B.col}, ${B.city}, ${B.state}` } },
      },
      metadata: {
        folio, envio: ship, subtotal, total,
        entrega: { nombre: B.name, telefono: B.phone, correo: B.email, calle: B.street, colonia: B.col, cp: B.cp, ciudad: B.city, estado: B.state, referencias: B.ref },
        regalo: gift, factura: invoice, acepta_ofertas: !!b.marketing,
      },
    };

    let r, res;
    try {
      r = await fetch(MP_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `${folio}-${token.slice(-16)}`,
        },
        body: JSON.stringify(payment),
      });
      res = await r.json();
    } catch {
      return json({ error: 'mp_unreachable' }, 502, cors);
    }
    if (!r.ok && !res?.status) return json({ error: 'mp_error', status_detail: res?.cause?.[0]?.code ? String(res.cause[0].code) : '' }, 402, cors);

    // Solo devolvemos al navegador lo necesario para mostrar el resultado.
    return json({
      id: res.id, status: res.status, status_detail: res.status_detail,
      amount: res.transaction_amount, last4: res.card?.last_four_digits || '',
    }, 200, cors);
  },
};

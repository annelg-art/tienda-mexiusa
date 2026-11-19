// Genera precios.json: la lista oficial de precios y envíos que usa el servidor de cobro.
// Ejecutar después de cambiar precios, productos o tarifas:
//   node herramientas/generar-precios.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['data.js', 'products.js']) vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });

const S = ctx.window.STORE || ctx.STORE, P = ctx.window.PRODUCTS, KG = ctx.window.SHIP_KG || {};
if (!S || !Array.isArray(P)) throw new Error('No se pudo leer STORE o PRODUCTS');

const out = {
  generado: new Date().toISOString(),
  maxQtyPerItem: S.maxQtyPerItem,
  weightTiers: S.weightTiers,
  extraPer10kg: S.extraPer10kg,
  zones: S.shippingZones.map((z) => ({ id: z.id, states: z.states, prices: z.prices })),
  products: Object.fromEntries(P.map((p) => [p.id, { name: p.name, price: p.price, kg: KG[p.id] || 3 }])),
};
writeFileSync(join(root, 'precios.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`precios.json listo: ${P.length} productos, ${out.zones.length} zonas de envío.`);

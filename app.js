/* ===========================================================
   MEXIUSA — lógica de tienda (temporada navideña)
   Seguridad en el cliente:
   - Toda salida se escapa con esc(); nada del usuario va a innerHTML sin escapar.
   - El carrito guardado se revalida contra el catálogo.
   - Los totales siempre salen del catálogo. En producción el servidor
     los recalcula y es la única fuente de verdad.
   - Datos de tarjeta: nunca se guardan ni se envían desde este código.
     En producción este bloque es el iframe del procesador (PCI DSS + 3-D Secure).
   =========================================================== */
'use strict';
(() => {
  const { STORE, PRODUCTS, CATEGORIES, GIFT_GUIDE, BUDGETS, LEGAL } = window;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v).replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
  const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = (n) => money.format(n);
  const fmt0 = (n) => '$' + Math.round(n).toLocaleString('es-MX');
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const catName = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smooth = reduceMotion ? 'auto' : 'smooth';
  const img = (p, cls = '', lazy = true) => `<img ${cls ? `class="${cls}"` : ''} src="${esc(p.img)}" alt="${esc(p.name)}" width="249" height="249" ${lazy ? 'loading="lazy"' : ''} decoding="async">`;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  };

  /* ---------- estado ---------- */
  const maxQty = () => STORE.maxQtyPerItem; // en producción: min(existencias del servidor, máximo por pedido)
  const sanitizeCart = (raw) => {
    const out = {};
    if (raw && typeof raw === 'object') for (const [id, q] of Object.entries(raw)) {
      const n = Math.floor(Number(q));
      if (byId[id] && Number.isFinite(n) && n > 0) out[id] = Math.min(n, maxQty());
    }
    return out;
  };
  const state = {
    cart: sanitizeCart(store.get('mexiusa.cart', {})),
    favs: new Set((store.get('mexiusa.favs', []) || []).filter((id) => byId[id])),
    q: '', cats: null, catLabel: '', budget: null, sort: 'dest', favOnly: false,
  };
  const saveCart = () => store.set('mexiusa.cart', state.cart);
  const saveFavs = () => store.set('mexiusa.favs', [...state.favs]);

  /* ---------- utilidades UI ---------- */
  let toastT;
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); };
  const bump = (el) => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  const lockSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V8a6 6 0 1112 0v2M5 10h14v10H5z" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const goCatalog = () => $('#catalogo').scrollIntoView({ behavior: smooth });

  /* ---------- totales (misma fórmula que debe usar el servidor) ---------- */
  // Envío: gratis en CDMX; fuera de CDMX el costo depende del estado de destino.
  const zoneFor = (st) => STORE.shippingZones.find((z) => z.states.includes(st)) || null;
  const kgOf = (id) => window.SHIP_KG[id] || 3; // sin dato: se asume caja chica (3 kg)
  // Precio por zona según peso facturable total del pedido (tabla de tramos + excedente por cada 10 kg arriba de 30 kg)
  function shipCost(zone, kg) {
    if (!zone) return 0;
    const tiers = STORE.weightTiers, i = tiers.findIndex((t) => kg <= t);
    if (i >= 0) return zone.prices[i];
    const extra = Math.ceil((kg - tiers.at(-1)) / 10);
    return Math.round(zone.prices.at(-1) + extra * zone.prices[3] * STORE.extraPer10kg);
  }
  function totals(st) {
    const lines = Object.entries(state.cart).map(([id, qty]) => ({ p: byId[id], qty, sub: Math.round(byId[id].price * qty * 100) / 100 }));
    const subtotal = Math.round(lines.reduce((a, l) => a + l.sub, 0) * 100) / 100;
    const zone = zoneFor(st);
    const quote = !!st && !zone; // solo si el estado no estuviera en ninguna zona
    const kg = lines.reduce((a, l) => a + kgOf(l.p.id) * l.qty, 0);
    const ship = shipCost(zone, kg);
    const total = subtotal + ship;
    const iva = total - total / (1 + STORE.ivaRate);
    const count = lines.reduce((a, l) => a + l.qty, 0);
    return { lines, subtotal, ship, total, iva, count, zone, quote, kg };
  }

  /* ---------- HERO ---------- */
  const words = ['que sí van a usar', 'con luces y magia', 'para los peques', 'para su mascota', 'para tu casa'];
  let wi = 0; const rot = $('#rotWord');
  if (!reduceMotion) setInterval(() => {
    rot.classList.add('out');
    setTimeout(() => { wi = (wi + 1) % words.length; rot.textContent = words[wi]; rot.classList.remove('out'); rot.classList.add('in'); requestAnimationFrame(() => requestAnimationFrame(() => rot.classList.remove('in'))); }, 420);
  }, 2800);

  // carrusel de escenas (crossfade + Ken Burns), pausa al pasar el cursor o con la pestaña oculta
  (function heroSlider() {
    const hero = $('#hero'), slides = $$('.slide', hero), dots = $('#heroDots'), cap = $('#heroCaption');
    const DUR = 6500; let i = 0, timer = null;
    dots.innerHTML = slides.map((s, k) => `<button role="tab" aria-selected="${k === 0}" aria-label="Escena ${k + 1}: ${esc(s.dataset.caption)}" style="--dur:${DUR}ms"><i></i></button>`).join('');
    const btns = $$('button', dots);
    const go = (n) => {
      slides[i].classList.remove('is-active'); btns[i].setAttribute('aria-selected', 'false');
      i = (n + slides.length) % slides.length;
      const img0 = slides[i].querySelector('img'); img0.loading = 'eager';
      slides[i].classList.add('is-active'); btns[i].setAttribute('aria-selected', 'true');
      btns[i].querySelector('i').style.animation = 'none'; void btns[i].offsetWidth; btns[i].querySelector('i').style.animation = '';
      cap.classList.add('fade'); setTimeout(() => { cap.textContent = slides[i].dataset.caption; cap.classList.remove('fade'); }, 400);
      schedule();
    };
    const schedule = () => { clearTimeout(timer); if (!hero.classList.contains('paused')) timer = setTimeout(() => go(i + 1), DUR); };
    btns.forEach((b, k) => b.addEventListener('click', () => go(k)));
    // precarga las siguientes escenas cuando el navegador esté libre
    (window.requestIdleCallback || setTimeout)(() => slides.forEach((s) => { s.querySelector('img').loading = 'eager'; }));
    hero.addEventListener('mouseenter', () => { hero.classList.add('paused'); clearTimeout(timer); });
    hero.addEventListener('mouseleave', () => { hero.classList.remove('paused'); schedule(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else schedule(); });
    // deslizar en táctil
    let x0 = null;
    hero.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1)); x0 = null; });
    schedule();
  })();

  // nieve (canvas, ligera, se pausa fuera de pantalla)
  (function snow() {
    const c = $('#snow'); if (!c || reduceMotion) return;
    const ctx = c.getContext('2d'); let w, h, flakes = [], running = true, dpr = Math.min(devicePixelRatio || 1, 2);
    const resize = () => { w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(140, w * h / 9000)); flakes = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 2.4 + .6, s: Math.random() * .6 + .25, d: Math.random() * Math.PI * 2 })); };
    const tick = () => { if (!running) return; ctx.clearRect(0, 0, w, h); ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (const f of flakes) { f.y += f.s; f.d += .01; f.x += Math.sin(f.d) * .35; if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
        ctx.globalAlpha = .35 + f.r / 4; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); }
      requestAnimationFrame(tick); };
    resize(); addEventListener('resize', resize);
    new IntersectionObserver(([e]) => { const was = running; running = e.isIntersecting; if (running && !was) tick(); }).observe(c);
    tick();
  })();

  // cuenta regresiva (fecha real: 25 de diciembre)
  const xmas = new Date(STORE.christmas).getTime();
  const pad = (n) => String(n).padStart(2, '0');
  function countdown() {
    const ms = Math.max(0, xmas - Date.now());
    $('#cdD').textContent = Math.floor(ms / 864e5); $('#cdH').textContent = pad(Math.floor(ms / 36e5) % 24); $('#cdM').textContent = pad(Math.floor(ms / 6e4) % 60);
  }
  countdown(); setInterval(countdown, 30000);

  // fechas límite
  const dShort = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' });
  const toDate = (s) => new Date(s + 'T23:59:00-06:00');
  $('#cutStd').textContent = dShort.format(toDate(STORE.cutoffStd));
  $$('.topbar b').forEach((b) => { b.textContent = dShort.format(toDate(STORE.cutoffStd)); });
  const tl = [
    { d: toDate(STORE.cutoffStd), t: 'Último día para pedir fuera de CDMX' },
    { d: toDate(STORE.cutoffCdmx), t: 'Último día para pedir en CDMX (envío gratis)' },
    { d: new Date('2026-12-24T12:00:00-06:00'), t: 'Nochebuena: tu regalo ya está en casa' },
  ];
  const now = Date.now(); const nextIdx = tl.findIndex((x) => x.d.getTime() > now);
  $('#timeline').innerHTML = tl.map((x, i) => `<li class="${x.d.getTime() < now ? 'past' : i === nextIdx ? 'next' : ''}"><b>${esc(dShort.format(x.d))}</b><span>${esc(x.t)}</span></li>`).join('');

  /* ---------- destellos mágicos: estela del cursor y explosión al agregar ---------- */
  const magic = (function () {
    const c = $('#magic'); if (!c || reduceMotion) return { burst() {} };
    const ctx = c.getContext('2d'); const dpr = Math.min(devicePixelRatio || 1, 2); let ps = [], raf = 0;
    const size = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); addEventListener('resize', size);
    const cols = ['#fff3c4', '#f4d98f', '#ffffff', '#ffd27a', '#ff8a9b'];
    const star = (x, y, r) => { ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * .38 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); };
    const loop = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ps = ps.filter((p) => p.life > 0);
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= .97; p.life -= p.decay; p.rot += .1;
        ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 8;
        star(p.x, p.y, p.r * (0.6 + p.life * .4));
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      raf = ps.length ? requestAnimationFrame(loop) : 0;
    };
    const add = (p) => { ps.push(p); if (ps.length > 260) ps.splice(0, ps.length - 260); if (!raf) raf = requestAnimationFrame(loop); };
    let last = 0;
    if (matchMedia('(pointer: fine)').matches) addEventListener('pointermove', (e) => {
      const t = performance.now(); if (t - last < 28) return; last = t;
      add({ x: e.clientX + (Math.random() - .5) * 6, y: e.clientY + (Math.random() - .5) * 6, vx: (Math.random() - .5) * .8, vy: Math.random() * .6 + .2, g: .02, r: Math.random() * 3 + 2, life: 1, decay: .025, c: cols[Math.floor(Math.random() * cols.length)], rot: 0 });
    }, { passive: true });
    return {
      burst(x, y, n = 26) {
        for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, v = Math.random() * 5 + 2;
          add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: .14, r: Math.random() * 4 + 3, life: 1, decay: .018 + Math.random() * .012, c: cols[Math.floor(Math.random() * cols.length)], rot: 0 }); }
      },
    };
  })();

  /* ---------- parallax suave en banners ---------- */
  if (!reduceMotion) {
    const promos = $$('.promo__media img'); let tick = false;
    const par = () => { tick = false; const vh = innerHeight;
      for (const im of promos) { const r = im.parentElement.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) continue;
        const p = (r.top + r.height / 2 - vh / 2) / vh; im.style.setProperty('--py', `${(p * -6).toFixed(2)}%`); } };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(par); } }, { passive: true }); par();
  }

  /* ---------- reveal ---------- */
  const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), { threshold: 0.1 });
  $$('.reveal').forEach((el, i) => { el.style.transitionDelay = `${(i % 5) * 70}ms`; io.observe(el); });

  /* ---------- nav ---------- */
  addEventListener('scroll', () => $('#nav').classList.toggle('scrolled', scrollY > 40), { passive: true });
  const menuBtn = $('#menuBtn'), menuPanel = $('#menuPanel');
  const setMenu = (open) => { menuPanel.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menuPanel.hidden); });
  document.addEventListener('click', (e) => { if (!menuPanel.contains(e.target)) setMenu(false); });
  menuPanel.addEventListener('click', (e) => { if (e.target.closest('a,button')) setMenu(false); });

  /* ---------- guía de regalos ---------- */
  const gTrack = $('#guideTrack');
  gTrack.innerHTML = GIFT_GUIDE.map((g) => {
    const items = PRODUCTS.filter((p) => g.cats.includes(p.cat));
    const pick = items.slice(0, 3);
    const min = Math.min(...items.map((p) => p.price));
    return `<button class="gift reveal" data-guide="${esc(g.id)}">
      <div class="gift__art gift__art--${esc(g.tone)}">${pick.map((p) => `<span>${img(p)}</span>`).join('')}</div>
      <h3>${esc(g.title)}</h3><p>${esc(g.text)}</p><small>${items.length} productos · desde ${fmt0(min)}</small></button>`;
  }).join('');
  $$('.gift', gTrack).forEach((el) => io.observe(el));
  gTrack.addEventListener('click', (e) => {
    const b = e.target.closest('[data-guide]'); if (!b) return;
    const g = GIFT_GUIDE.find((x) => x.id === b.dataset.guide);
    setFilter({ cats: g.cats, label: g.title }); goCatalog();
  });
  const gStep = () => (gTrack.querySelector('.gift')?.offsetWidth || 300) + 18;
  $('#gNext').addEventListener('click', () => gTrack.scrollBy({ left: gStep(), behavior: smooth }));
  $('#gPrev').addEventListener('click', () => gTrack.scrollBy({ left: -gStep(), behavior: smooth }));

  // botones de banners → filtran el catálogo
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go-cats]'); if (!b) return;
    setFilter({ cats: b.dataset.goCats.split(','), label: b.dataset.label || '' }); goCatalog();
  });

  /* ---------- presupuesto ---------- */
  const countBudget = (b) => PRODUCTS.filter((p) => p.price >= b.min && p.price <= b.max).length;
  $('#budgetBand').innerHTML = BUDGETS.map((b) => `<button data-budget="${b.id}">${esc(b.label)} <small>${countBudget(b)}</small></button>`).join('');
  $('#budgetBand').addEventListener('click', (e) => { const b = e.target.closest('[data-budget]'); if (b) { setBudget(b.dataset.budget); goCatalog(); } });
  const budgets = $('#budgets'), budgetBtn = $('#budgetBtn');
  budgets.innerHTML = BUDGETS.map((b) => `<button type="button" class="bud" data-budget="${b.id}" aria-pressed="false">${esc(b.label)}</button>`).join('');
  budgetBtn.addEventListener('click', (e) => { e.stopPropagation(); budgets.hidden = !budgets.hidden; budgetBtn.setAttribute('aria-expanded', String(!budgets.hidden)); });
  document.addEventListener('click', (e) => { if (!budgets.contains(e.target) && !budgetBtn.contains(e.target)) { budgets.hidden = true; budgetBtn.setAttribute('aria-expanded', 'false'); } });
  budgets.addEventListener('click', (e) => { const b = e.target.closest('[data-budget]'); if (b) { setBudget(state.budget === b.dataset.budget ? null : b.dataset.budget); budgets.hidden = true; goCatalog(); } });
  function setBudget(id) {
    state.budget = id; $$('.bud').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.budget === id))); renderGrid();
  }

  /* ---------- chips de categoría ---------- */
  const chips = $('#chips');
  chips.innerHTML = [{ id: 'all', name: 'Todo' }, ...CATEGORIES].map((c) =>
    `<button class="chip ${c.id === 'navidad' ? 'chip--xmas' : ''}" data-cat="${esc(c.id)}" aria-pressed="${c.id === 'all'}">${c.id === 'navidad' ? '🎄 ' : ''}${esc(c.name)}</button>`).join('');
  chips.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) setFilter(b.dataset.cat === 'all' ? { cats: null } : { cats: [b.dataset.cat], label: catName[b.dataset.cat] }); });

  function setFilter({ cats, label = '' }) {
    state.cats = cats; state.catLabel = label; state.favOnly = false;
    const single = cats && cats.length === 1 ? cats[0] : null;
    $$('.chip', chips).forEach((b) => b.setAttribute('aria-pressed', String(cats ? b.dataset.cat === single : b.dataset.cat === 'all')));
    $$('#catsList button').forEach((b) => b.classList.toggle('active', b.dataset.cat === single));
    renderGrid();
  }

  /* ---------- lista tipográfica de categorías ---------- */
  const catsList = $('#catsList'), preview = $('#catsPreview');
  catsList.innerHTML = CATEGORIES.map((c) => `<li><button data-cat="${esc(c.id)}">${esc(c.name)}<span class="cats__count">${PRODUCTS.filter((p) => p.cat === c.id).length}</span></button></li>`).join('');
  const showPreview = (catId) => {
    const items = PRODUCTS.filter((p) => p.cat === catId); if (!items.length) return;
    const p = items[Math.floor(Math.random() * items.length)];
    preview.dataset.label = `${catName[catId]} · desde ${fmt0(Math.min(...items.map((x) => x.price)))}`;
    preview.innerHTML = img(p, '', false);
  };
  catsList.addEventListener('mouseover', (e) => { const b = e.target.closest('[data-cat]'); if (b && preview.dataset.cat !== b.dataset.cat) { preview.dataset.cat = b.dataset.cat; showPreview(b.dataset.cat); } });
  catsList.addEventListener('focusin', (e) => { const b = e.target.closest('[data-cat]'); if (b) showPreview(b.dataset.cat); });
  catsList.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { setFilter({ cats: [b.dataset.cat], label: catName[b.dataset.cat] }); goCatalog(); } });
  showPreview('navidad');

  /* ---------- búsqueda y orden ---------- */
  let qT;
  $('#searchInput').addEventListener('input', (e) => { clearTimeout(qT); qT = setTimeout(() => { state.q = e.target.value.trim().slice(0, 60); renderGrid(); }, 160); });
  $('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); goCatalog(); });
  $('#sortSel').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });

  /* ---------- grid ---------- */
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function filtered() {
    const q = norm(state.q); const b = BUDGETS.find((x) => x.id === state.budget);
    const list = PRODUCTS.filter((p) =>
      (!state.cats || state.cats.includes(p.cat)) &&
      (!b || (p.price >= b.min && p.price <= b.max)) &&
      (!state.favOnly || state.favs.has(p.id)) &&
      (!q || norm(`${p.name} ${p.specs.join(' ')} ${catName[p.cat]} ${p.id}`).includes(q)));
    const prio = { navidad: 0, juguetes: 1, tecnologia: 2 }; // destacados de temporada primero
    const pr = (p) => prio[p.cat] ?? 3;
    const s = { dest: (a, c) => pr(a) - pr(c) || a.rank - c.rank, asc: (a, c) => a.price - c.price, desc: (a, c) => c.price - a.price, az: (a, c) => a.name.localeCompare(c.name, 'es') }[state.sort];
    return list.sort(s);
  }
  function cardHTML(p, i) {
    const fav = state.favs.has(p.id);
    const tag = p.cat === 'navidad' ? '<span class="card__tag card__tag--xmas">Navidad</span>' : '';
    return `<article class="card" style="animation-delay:${Math.min(i, 10) * 40}ms">
      <div class="card__frame">
        <button class="card__media" data-quick="${esc(p.id)}" aria-label="Ver detalles de ${esc(p.name)}">${img(p)}</button>
        ${tag}
        <button class="card__fav" data-fav="${esc(p.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Quitar de' : 'Agregar a'} favoritos: ${esc(p.name)}">${heart}</button>
        <button class="btn btn--red card__add" data-add="${esc(p.id)}">Agregar al carrito</button>
      </div>
      <div class="card__info">
        <span class="card__cat">${esc(catName[p.cat])}</span>
        <h3 class="card__name">${esc(p.name)}</h3>
        <p class="card__price">${fmt(p.price)}<small>MXN</small></p>
      </div>
    </article>`;
  }
  function renderGrid() {
    const list = filtered(); const grid = $('#grid');
    grid.innerHTML = list.length ? list.map(cardHTML).join('') : `<div class="empty"><p>No encontramos productos con esos filtros.</p></div>`;
    const parts = [];
    if (state.catLabel && state.cats) parts.push(state.catLabel);
    if (state.budget) parts.push(BUDGETS.find((x) => x.id === state.budget).label);
    if (state.favOnly) parts.push('Favoritos');
    if (state.q) parts.push(`“${state.q}”`);
    const info = $('#resultInfo');
    info.textContent = `${list.length} ${list.length === 1 ? 'producto' : 'productos'}${parts.length ? ' · ' + parts.join(' · ') : ''}`;
    if (parts.length) { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Quitar filtros'; b.addEventListener('click', clearFilters); info.appendChild(b); }
  }
  function clearFilters() { state.q = ''; $('#searchInput').value = ''; state.budget = null; $$('.bud').forEach((x) => x.setAttribute('aria-pressed', 'false')); setFilter({ cats: null }); }

  $('#grid').addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]'), fav = e.target.closest('[data-fav]'), q = e.target.closest('[data-quick]');
    if (add) { const r = add.getBoundingClientRect(); magic.burst(r.left + r.width / 2, r.top + r.height / 2); addToCart(add.dataset.add, add.closest('.card').querySelector('.card__media img')); }
    else if (fav) toggleFav(fav.dataset.fav, fav);
    else if (q) openQuick(q.dataset.quick);
  });

  /* ---------- favoritos ---------- */
  function toggleFav(id, btn) {
    const on = !state.favs.has(id); on ? state.favs.add(id) : state.favs.delete(id);
    saveFavs(); updateBadges();
    if (btn) { btn.setAttribute('aria-pressed', String(on)); btn.setAttribute('aria-label', `${on ? 'Quitar de' : 'Agregar a'} favoritos: ${byId[id].name}`); }
    toast(on ? 'Guardado en favoritos ♥' : 'Quitado de favoritos');
    if (state.favOnly) renderGrid();
  }
  $('#favBtn').addEventListener('click', () => {
    if (!state.favs.size) { toast('Aún no tienes favoritos. Toca el ♥ de un producto.'); return; }
    state.favOnly = !state.favOnly; renderGrid(); goCatalog();
  });

  /* ---------- carrito ---------- */
  function addToCart(id, fromEl) {
    const p = byId[id]; if (!p) return;
    const cur = state.cart[id] || 0;
    if (cur >= maxQty()) { toast(`Máximo ${maxQty()} piezas por producto en cada pedido`); return; }
    state.cart[id] = cur + 1; saveCart(); updateBadges(); renderCart();
    if (fromEl && !reduceMotion) flyToCart(fromEl, p); else { bump($('#cartCount')); toast(`Agregado: ${p.name}`); }
  }
  function setQty(id, qty) {
    if (!byId[id]) return;
    if (qty <= 0) delete state.cart[id]; else state.cart[id] = Math.min(qty, maxQty());
    saveCart(); updateBadges(); renderCart();
  }
  function flyToCart(fromEl, p) {
    const a = fromEl.getBoundingClientRect(), b = $('#cartBtn').getBoundingClientRect();
    const f = document.createElement('div'); f.className = 'fly'; f.innerHTML = img(p, '', false);
    f.style.left = `${a.left + a.width / 2 - 27}px`; f.style.top = `${a.top + a.height / 2 - 27}px`;
    document.body.appendChild(f);
    requestAnimationFrame(() => { f.style.transform = `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(.35) rotate(20deg)`; f.style.opacity = '.6'; });
    setTimeout(() => { f.remove(); bump($('#cartCount')); magic.burst(b.left + b.width / 2, b.top + b.height / 2, 18); toast(`Agregado: ${p.name}`); }, 760);
  }
  function updateBadges() {
    $('#cartCount').textContent = Object.values(state.cart).reduce((a, b) => a + b, 0);
    $('#favCount').textContent = state.favs.size;
  }
  function renderCart() {
    const t = totals(null); const list = $('#cartList'), foot = $('#drawerFoot'), meter = $('#shipMeter');
    if (!t.count) {
      list.innerHTML = `<li class="empty-cart"><span class="bigico" aria-hidden="true">🎁</span><p>Tu carrito está vacío.<br>Encuentra el regalo perfecto.</p><button class="btn btn--red" id="goShop">Ver guía de regalos</button></li>`;
      foot.innerHTML = ''; meter.innerHTML = '';
      $('#goShop').addEventListener('click', () => { closeDrawer(); $('#regalos').scrollIntoView({ behavior: smooth }); });
      return;
    }
    const fromMin = shipCost(STORE.shippingZones[1], t.kg), fromMax = shipCost(STORE.shippingZones.at(-1), t.kg);
    meter.innerHTML = `<div class="ship-note"><span aria-hidden="true">🚚</span><p><strong>Envío gratis en CDMX.</strong> Otros estados: de ${fmt(fromMin)} a ${fmt(fromMax)} según destino (paquete de ~${t.kg} kg). Lo ves exacto al capturar tu estado.</p></div>`;
    list.innerHTML = t.lines.map(({ p, qty, sub }) => `<li class="cart-item">
        <div class="cart-item__img">${img(p, '', false)}</div>
        <div><h4>${esc(p.name)}</h4><p class="small muted">${fmt(p.price)} c/u</p>
          <div class="qty" role="group" aria-label="Cantidad de ${esc(p.name)}">
            <button data-dec="${esc(p.id)}" aria-label="Quitar uno">−</button><span>${qty}</span>
            <button data-inc="${esc(p.id)}" aria-label="Agregar uno" ${qty >= maxQty() ? 'disabled' : ''}>+</button></div>
          <button class="rm" data-rm="${esc(p.id)}">Eliminar</button></div>
        <p class="cart-item__price">${fmt(sub)}</p></li>`).join('');
    foot.innerHTML = `
      <div class="sum-row"><span>Subtotal (${t.count} ${t.count === 1 ? 'producto' : 'productos'})</span><span>${fmt(t.subtotal)}</span></div>
      <div class="sum-row"><span>Envío</span><span>Gratis en CDMX · otros estados se calcula</span></div>
      <div class="sum-row sum-row--total"><span>Total en productos</span><span>${fmt(t.total)}</span></div>
      <div class="sum-row"><span class="muted">IVA incluido</span><span class="muted">${fmt(t.iva)}</span></div>
      <button class="btn btn--red btn--block" id="goCheckout">Continuar con la compra</button>
      <p class="secure-line">${lockSvg} Pago seguro · Revisas todo antes de pagar</p>`;
    $('#goCheckout').addEventListener('click', () => { closeDrawer(); openCheckout(); });
  }
  $('#cartList').addEventListener('click', (e) => {
    const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]'), rm = e.target.closest('[data-rm]');
    if (inc) setQty(inc.dataset.inc, (state.cart[inc.dataset.inc] || 0) + 1);
    if (dec) setQty(dec.dataset.dec, (state.cart[dec.dataset.dec] || 0) - 1);
    if (rm) { const n = byId[rm.dataset.rm].name; setQty(rm.dataset.rm, 0); toast(`Eliminado: ${n}`); }
  });

  const drawer = $('#drawer'), scrim = $('#scrim'); let lastFocus;
  let drawerRaf = 0, scrimT = 0;
  function openDrawer() {
    lastFocus = document.activeElement; renderCart(); clearTimeout(scrimT);
    scrim.hidden = false; drawer.setAttribute('aria-hidden', 'false'); document.body.classList.add('lock');
    drawerRaf = requestAnimationFrame(() => { drawerRaf = 0; scrim.classList.add('on'); drawer.classList.add('on'); });
    setTimeout(() => $('#drawerClose').focus(), 60);
  }
  function closeDrawer() {
    cancelAnimationFrame(drawerRaf); drawerRaf = 0; // si se cierra antes del primer cuadro, no debe quedar abierto
    scrim.classList.remove('on'); drawer.classList.remove('on'); drawer.setAttribute('aria-hidden', 'true'); document.body.classList.remove('lock');
    scrimT = setTimeout(() => { scrim.hidden = true; }, 350); lastFocus?.focus?.();
  }
  $('#cartBtn').addEventListener('click', openDrawer);
  $('#drawerClose').addEventListener('click', closeDrawer);
  scrim.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('on')) closeDrawer();
    if (e.key === 'Tab' && drawer.classList.contains('on')) {
      const f = $$('button:not([disabled]), a[href], input', drawer); if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ---------- vista rápida ---------- */
  const quick = $('#quick');
  function openQuick(id) {
    const p = byId[id]; if (!p) return;
    quick.innerHTML = `<button class="round modal__x" data-close aria-label="Cerrar">×</button>
      <div class="pd"><div class="pd__media">${img(p, '', false)}</div>
      <div class="pd__body">
        <p class="small muted">${esc(catName[p.cat])} · SKU ${esc(p.id)}</p>
        <h2 id="qTitle">${esc(p.name)}</h2>
        <p class="pd__price">${fmt(p.price)}<small>Precio total con IVA incluido. El envío se calcula antes de pagar.</small></p>
        <p class="stock">Disponible · sale en 24–48 h hábiles</p>
        <ul class="specs">${p.specs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
        <ul class="pd__meta">
          <li><span>Garantía</span><span><button class="link" data-legal="garantia">Por escrito</button></span></li>
          <li><span>Devolución</span><span><button class="link" data-legal="devoluciones">5 días hábiles</button></span></li>
          <li><span>Cambios de regalo</span><span>Hasta el 15 de enero</span></li>
          <li><span>Envío</span><span>Gratis en CDMX · otros estados ${fmt(shipCost(STORE.shippingZones[1], kgOf(p.id)))}–${fmt(shipCost(STORE.shippingZones.at(-1), kgOf(p.id)))}</span></li>
        </ul>
        <div style="display:flex;gap:10px">
          <button class="btn btn--red btn--lg" style="flex:1" data-qadd="${esc(p.id)}">Agregar al carrito</button>
          <button class="round" data-qfav="${esc(p.id)}" aria-pressed="${state.favs.has(p.id)}" aria-label="Favorito">${heart}</button>
        </div>
      </div></div>`;
    quick.showModal();
  }
  quick.addEventListener('click', (e) => {
    if (e.target === quick || e.target.closest('[data-close]')) quick.close();
    const a = e.target.closest('[data-qadd]'); if (a) { addToCart(a.dataset.qadd); quick.close(); openDrawer(); }
    const f = e.target.closest('[data-qfav]'); if (f) { toggleFav(f.dataset.qfav, null); f.setAttribute('aria-pressed', String(state.favs.has(f.dataset.qfav))); renderGrid(); }
  });

  /* ---------- legales ---------- */
  const legal = $('#legal');
  function openLegal(key) {
    const d = LEGAL[key]; if (!d) return;
    if (legal.open) legal.close();
    legal.innerHTML = `<button class="round modal__x" data-close aria-label="Cerrar">×</button><div class="legal"><h2 id="legalTitle">${esc(d.title)}</h2>${d.html}</div>`;
    legal.showModal();
  }
  legal.addEventListener('click', (e) => { if (e.target === legal || e.target.closest('[data-close]')) legal.close(); });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-legal]'); if (b) { e.preventDefault(); openLegal(b.dataset.legal); } });

  /* ---------- checkout ---------- */
  const ESTADOS = ['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'];
  const co = $('#checkout');
  const order = { step: 1, pay: 'card', data: {}, last4: '', busy: false };
  const curState = () => $('#f_state', co)?.value || order.data.state || '';
  // Solo Visa y Mastercard (débito o crédito)
  const cardBrand = (n) => /^4/.test(n) ? 'Visa' : /^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/.test(n) ? 'Mastercard' : '';
  const payLabel = (p, total) => `${p === 'card' ? 'Pagar' : 'Generar datos de transferencia por'} ${fmt(total)}`;
  function shipQuoteHTML(st) {
    const z = zoneFor(st);
    if (!st) return `<span aria-hidden="true">🚚</span><p>Elige tu estado. <strong>Envío gratis en CDMX</strong>; para Estado de México y demás estados el costo se calcula según destino y tamaño del paquete.</p>`;
    if (!z) return `<span aria-hidden="true">💬</span><p>El envío a <strong>${esc(st)}</strong> se cotiza por WhatsApp. Al continuar te damos una referencia; <strong>no se cobra nada</strong> hasta confirmarte el total.</p>`;
    const t = totals(st);
    return `<span aria-hidden="true">${t.ship ? '🚚' : '🎉'}</span><p>Envío a <strong>${esc(st)}</strong>: <strong>${t.ship ? fmt(t.ship) : 'GRATIS'}</strong> · ${z.days[0]} a ${z.days[1]} días hábiles, con guía de rastreo${t.ship ? ` · paquete de ~${t.kg} kg facturables` : ''}.</p>`;
  }

  const V = {
    name: (v) => /^[\p{L}][\p{L} .'-]{2,79}$/u.test(v) || 'Escribe tu nombre completo',
    email: (v) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,}$/i.test(v) || 'Correo no válido',
    phone: (v) => /^\d{10}$/.test(v.replace(/\D/g, '')) || 'Teléfono a 10 dígitos',
    street: (v) => v.length >= 4 || 'Calle y número',
    col: (v) => v.length >= 2 || 'Colonia requerida',
    cp: (v) => /^\d{5}$/.test(v) || 'C.P. de 5 dígitos',
    city: (v) => v.length >= 2 || 'Ciudad o municipio',
    state: (v) => ESTADOS.includes(v) || 'Elige tu estado',
    rfc: (v) => /^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$/i.test(v) || 'RFC no válido (12 o 13 caracteres)',
    cfdiCp: (v) => /^\d{5}$/.test(v) || 'C.P. fiscal de 5 dígitos',
    giftTo: (v) => !order.data.gift || v.length >= 2 || 'Nombre de quien recibe',
    ccnum: (v) => { const n = v.replace(/\s/g, ''); if (!luhn(n)) return 'Número de tarjeta no válido'; return cardBrand(n) ? true : 'Solo aceptamos tarjetas Visa o Mastercard'; },
    ccexp: (v) => validExp(v) || 'Fecha MM/AA vigente',
    cvv: (v) => /^\d{3,4}$/.test(v) || 'CVV de 3 o 4 dígitos',
    ccname: (v) => /^[\p{L}][\p{L} .'-]{2,59}$/u.test(v) || 'Nombre como aparece en la tarjeta',
  };
  function luhn(n) { if (!/^\d{13,19}$/.test(n)) return false; let s = 0; for (let i = 0; i < n.length; i++) { let d = +n[n.length - 1 - i]; if (i % 2) { d *= 2; if (d > 9) d -= 9; } s += d; } return s % 10 === 0; }
  function validExp(v) { const m = /^(\d{2})\s?\/\s?(\d{2})$/.exec(v); if (!m) return false; const mm = +m[1], yy = 2000 + +m[2]; if (mm < 1 || mm > 12) return false; const n = new Date(); return yy > n.getFullYear() || (yy === n.getFullYear() && mm >= n.getMonth() + 1); }
  const field = (id, label, o = {}) => `<label class="field ${o.full ? 'full' : ''}" data-f="${id}">${label}${o.opt ? ' <span class="muted">(opcional)</span>' : ''}
      ${o.select ? `<select id="f_${id}" ${o.ac ? `autocomplete="${o.ac}"` : ''}><option value="">Selecciona…</option>${o.select.map((s) => `<option ${order.data[id] === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`
      : o.area ? `<textarea id="f_${id}" maxlength="${o.max || 140}" placeholder="${esc(o.ph || '')}">${esc(order.data[id] || '')}</textarea>`
      : `<input id="f_${id}" type="${o.type || 'text'}" ${o.ac ? `autocomplete="${o.ac}"` : ''} ${o.im ? `inputmode="${o.im}"` : ''} maxlength="${o.max || 80}" value="${esc(order.data[id] || '')}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''}>`}
      <span class="err" aria-live="polite"></span></label>`;
  function addBusinessDays(d, n) { const r = new Date(d); let k = 0; while (k < n) { r.setDate(r.getDate() + 1); const w = r.getDay(); if (w && w !== 6) k++; } return r; }
  const dfmt = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });

  function sideHTML() {
    const st = curState(); const t = totals(st);
    let eta = '<p class="info-box">Elige tu estado para ver el costo de envío y la fecha estimada de entrega.</p>';
    if (t.quote) eta = `<p class="info-box">💬 El envío a <strong>${esc(st)}</strong> se cotiza por WhatsApp. Te confirmamos el total final antes de cualquier cobro.</p>`;
    if (t.zone) {
      const from = addBusinessDays(new Date(), t.zone.days[0] + 1), to = addBusinessDays(new Date(), t.zone.days[1] + 1);
      const beforeXmas = to.getTime() < new Date('2026-12-24T12:00:00-06:00').getTime();
      eta = `<p class="info-box">Entrega estimada: <strong>${dfmt.format(from)} – ${dfmt.format(to)}</strong>${beforeXmas ? '<br>🎄 Llega antes de Nochebuena' : ''}</p>`;
    }
    return `<h3>Resumen del pedido</h3>
      ${t.lines.map(({ p, qty, sub }) => `<div class="co__line"><span>${esc(p.name)} × ${qty}</span><span>${fmt(sub)}</span></div>`).join('')}
      <hr style="border:0;border-top:1px solid var(--line);margin:6px 0">
      <div class="co__line"><span>Subtotal</span><span>${fmt(t.subtotal)}</span></div>
      <div class="co__line"><span>Envío${st ? ' · ' + esc(st) : ''}</span><span>${t.zone ? (t.ship ? fmt(t.ship) : 'Gratis') : t.quote ? 'Por cotizar' : 'Elige tu estado'}</span></div>
      <div class="co__line sum-row--total"><span>${t.quote ? 'Total en productos' : 'Total a pagar'}</span><span>${fmt(t.total)}</span></div>
      <div class="co__line"><span class="muted small">IVA incluido (16%)</span><span class="muted small">${fmt(t.iva)}</span></div>
      ${eta}
      <div class="paymarks" aria-label="Aceptamos Visa, Mastercard y transferencia bancaria"><span class="pm pm--visa">VISA</span><span class="pm pm--mc"><i></i><i></i>mastercard</span><span class="pm">Transferencia</span></div>
      <p class="secure-line" style="justify-content:flex-start">${lockSvg} Conexión cifrada · No almacenamos tu tarjeta</p>
      <p class="small muted">Tienes <button class="link" data-legal="devoluciones">5 días hábiles</button> para revocar tu compra.</p>`;
  }
  /* ---------- pago con tarjeta en la página (Openpay by BBVA) ----------
     El formulario es de MEXIUSA. Al pagar, openpay.js envía la tarjeta directo a Openpay
     (BBVA, certificado PCI DSS) y devuelve un token de un solo uso: el número nunca llega
     a nuestro servidor ni se guarda. El servidor cobra el token después de recalcular el
     total con los precios oficiales (precios.json). */
  const OP = STORE.openpay || {};
  const cardOnline = () => !!(OP.merchantId && OP.publicKey && OP.apiUrl);
  let opSdk = null;
  const loadScript = (src) => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error('sdk')); document.head.appendChild(s); });
  function loadOpenpay() {
    if (!opSdk) {
      opSdk = loadScript('https://js.openpay.mx/openpay.v1.min.js')
        .then(() => loadScript('https://js.openpay.mx/openpay-data.v1.min.js'))
        .then(() => { window.OpenPay.setId(OP.merchantId); window.OpenPay.setApiKey(OP.publicKey); window.OpenPay.setSandboxMode(!!OP.sandbox); })
        .catch((e) => { opSdk = null; throw e; });
    }
    return opSdk;
  }
  const newFolio = () => 'MXU-' + Date.now().toString(36).toUpperCase().slice(-6) + '-' + crypto.getRandomValues(new Uint16Array(1))[0].toString(16).toUpperCase().padStart(4, '0');
  const REJECT = {
    1006: 'Este pedido ya fue pagado. Revisa tu correo o escríbenos con tu folio.',
    2004: 'El número de tarjeta no es válido. Revísalo.',
    2005: 'La fecha de vencimiento ya pasó.',
    2006: 'Falta el código de seguridad (CVV).',
    2009: 'El código de seguridad (CVV) no es válido.',
    3001: 'Tu banco rechazó la tarjeta. Prueba con otra o paga por transferencia.',
    3002: 'La tarjeta está vencida.',
    3003: 'La tarjeta no tiene fondos suficientes.',
    3004: 'Tu banco rechazó la tarjeta. Prueba con otra o paga por transferencia.',
    3005: 'El pago fue rechazado por seguridad. Prueba con otra tarjeta o paga por transferencia.',
    3006: 'Tu tarjeta no permite compras en línea. Actívalas en la app de tu banco.',
    3009: 'Tu banco rechazó la tarjeta. Prueba con otra o paga por transferencia.',
    3010: 'Tu banco rechazó la tarjeta. Prueba con otra o paga por transferencia.',
    3011: 'Tu banco pide que te comuniques con ellos para autorizar el pago.',
    3012: 'Tu banco pide que autorices este pago. Hazlo en su app e inténtalo de nuevo.',
    price_changed: 'Los precios se actualizaron. Cierra y vuelve a abrir tu carrito para ver el total correcto.',
  };
  const tokenize = (card) => new Promise((ok, fail) => window.OpenPay.token.create(card, (r) => ok(r.data.id), (e) => fail(e?.data || e)));
  const brandOf = (n) => cardBrand(n.replace(/\D/g, ''));
  function cardPreview() {
    const num = ($('#f_ccnum', co)?.value || '').replace(/\D/g, ''), b = brandOf(num);
    const shown = (num + '•'.repeat(Math.max(0, 16 - num.length))).slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
    const pv = $('#ccPreview', co); if (!pv) return;
    pv.dataset.brand = b.toLowerCase();
    $('.ccard__num', pv).textContent = shown;
    $('.ccard__name', pv).textContent = ($('#f_ccname', co)?.value || 'NOMBRE DEL TITULAR').toUpperCase().slice(0, 26);
    $('.ccard__exp', pv).textContent = $('#f_ccexp', co)?.value || 'MM/AA';
    $('.ccard__brand', pv).innerHTML = b === 'Visa' ? '<span class="pm pm--visa">VISA</span>' : b === 'Mastercard' ? '<span class="pm pm--mc"><i></i><i></i></span>' : '';
  }
  async function payWithCard() {
    const btn = $('#payBtn', co), err = $('#payErr', co), t = totals(order.data.state), d = order.data;
    err.textContent = ''; order.busy = true; btn.disabled = true; btn.textContent = 'Procesando pago…';
    const [mm, yy] = $('#f_ccexp', co).value.split('/').map((s) => s.trim());
    try {
      await loadOpenpay();
      const deviceSessionId = window.OpenPay.deviceData.setup('coForm', 'deviceIdHidden');
      const token = await tokenize({
        card_number: $('#f_ccnum', co).value.replace(/\D/g, ''), holder_name: $('#f_ccname', co).value.trim(),
        expiration_month: mm, expiration_year: yy, cvv2: $('#f_cvv', co).value,
      });
      $('#f_ccnum', co).value = ''; $('#f_cvv', co).value = ''; // no dejar datos sensibles en pantalla
      if (!order.folio) order.folio = newFolio();
      const r = await fetch(OP.apiUrl.replace(/\/$/, '') + '/pagar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: order.folio, amount: t.total, token, deviceSessionId,
          items: t.lines.map(({ p, qty }) => ({ id: p.id, qty })),
          buyer: { name: d.name, email: d.email, phone: d.phone, street: d.street, col: d.col, cp: d.cp, city: d.city, state: d.state, ref: d.ref || '' },
          gift: d.gift ? { to: d.giftTo, from: d.giftFrom || '', msg: d.giftMsg || '' } : null,
          invoice: d.invoice ? { rfc: d.rfc, cp: d.cfdiCp, regimen: d.regimen || '' } : null,
          marketing: !!order.marketing,
        }),
      });
      const res = await r.json().catch(() => ({}));
      if (res.redirect) { location.href = res.redirect; return; } // 3-D Secure: el banco confirma y regresa a la tienda
      if (res.status === 'completed') {
        order.payment = res; order.step = 3; renderCheckout();
        state.cart = {}; saveCart(); updateBadges(); renderCart(); confetti();
        return;
      }
      throw res;
    } catch (e) {
      err.textContent = e?.message === 'sdk' ? 'No se pudo cargar el pago con tarjeta. Revisa tu conexión o elige transferencia.'
        : e instanceof TypeError ? 'No pudimos conectar con el servidor de pagos. No se hizo ningún cargo; inténtalo de nuevo.'
        : REJECT[e?.error_code] || REJECT[e?.error] || 'Tu banco rechazó el pago. Revisa los datos o prueba con otra tarjeta.';
    } finally {
      order.busy = false;
      if (btn.isConnected) { btn.disabled = false; btn.textContent = `Pagar ${fmt(t.total)}`; }
    }
  }
  // Regreso desde la verificación 3-D Secure del banco: ?pago=FOLIO&id=CARGO
  (async () => {
    const q = new URLSearchParams(location.search), id = q.get('id'), folio = q.get('pago');
    if (!id || !folio || !cardOnline()) return;
    history.replaceState(null, '', location.pathname);
    try {
      const res = await fetch(`${OP.apiUrl.replace(/\/$/, '')}/estado?id=${encodeURIComponent(id)}`).then((r) => r.json());
      if (res.status === 'completed') { state.cart = {}; saveCart(); updateBadges(); renderCart(); confetti(); toast(`¡Pago aprobado! Folio ${res.folio || folio}`); }
      else toast('El pago no se completó. No se hizo ningún cargo; puedes intentarlo de nuevo.');
    } catch { toast(`No pudimos confirmar tu pago. Escríbenos a ${STORE.ordersEmail} con tu folio ${folio}.`); }
  })();

  const stepsHTML = () => `<ol class="steps">${(order.quote ? ['Entrega', 'Cotiza tu envío', 'Pago'] : ['Entrega', 'Pago y revisión', 'Confirmación']).map((n, i) => `<li class="${i + 1 === order.step ? 'on' : i + 1 < order.step ? 'done' : ''}" ${i + 1 === order.step ? 'aria-current="step"' : ''}>${i + 1}. ${n}</li>`).join('')}</ol>`;

  function renderCheckout() {
    const t = totals(order.data.state); let main = '';
    if (order.step === 1) {
      main = `<h2 id="coTitle">Datos de entrega</h2>
      <form id="coForm" novalidate>
        <div class="fgrid">
          ${field('name', 'Nombre completo de quien compra', { full: true, ac: 'name' })}
          ${field('email', 'Correo electrónico', { type: 'email', ac: 'email', im: 'email', max: 120 })}
          ${field('phone', 'Teléfono', { type: 'tel', ac: 'tel-national', im: 'tel', max: 14, ph: '10 dígitos' })}
          ${field('street', 'Calle, número exterior e interior', { full: true, ac: 'address-line1' })}
          ${field('col', 'Colonia', { ac: 'address-line2' })}
          ${field('cp', 'Código postal', { ac: 'postal-code', im: 'numeric', max: 5 })}
          ${field('city', 'Ciudad / municipio / alcaldía', { ac: 'address-level2' })}
          ${field('state', 'Estado', { select: ESTADOS, ac: 'address-level1' })}
          ${field('ref', 'Referencias para el repartidor', { full: true, opt: true, max: 140 })}
        </div>
        <div class="ship-note ship-note--co" id="shipQuote" aria-live="polite">${shipQuoteHTML(order.data.state)}</div>
        <div class="gift-box">
          <label class="checks" style="margin:0"><span style="display:flex;gap:10px"><input type="checkbox" id="isGift" ${order.data.gift ? 'checked' : ''}> <span><strong>🎁 Es un regalo</strong> — el paquete va sin precios y con tu mensaje. Sin costo.</span></span></label>
          <div id="giftFields" class="fgrid" ${order.data.gift ? '' : 'hidden'}>
            ${field('giftTo', 'Para', { max: 60 })}
            ${field('giftFrom', 'De parte de', { max: 60, opt: true })}
            ${field('giftMsg', 'Mensaje', { full: true, area: true, max: 140, opt: true, ph: '¡Feliz Navidad! (máx. 140 caracteres)' })}
          </div>
        </div>
        <div class="checks"><label><input type="checkbox" id="wantInvoice" ${order.data.invoice ? 'checked' : ''}> Requiero factura (CFDI 4.0)</label></div>
        <div id="invoiceBox" ${order.data.invoice ? '' : 'hidden'}><div class="fgrid" style="margin-top:12px">
          ${field('rfc', 'RFC', { max: 13 })}
          ${field('cfdiCp', 'C.P. fiscal', { im: 'numeric', max: 5 })}
          ${field('regimen', 'Régimen fiscal', { full: true, select: ['601 General de Ley Personas Morales', '605 Sueldos y Salarios', '612 Personas Físicas con Actividades Empresariales', '616 Sin obligaciones fiscales', '626 Régimen Simplificado de Confianza'] })}
        </div></div>
        <input class="hp" type="text" name="company_site" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="co__nav"><button type="button" class="btn btn--ghost" data-close>Seguir comprando</button><button class="btn btn--red btn--lg" type="submit" id="coNext">${order.data.state && !zoneFor(order.data.state) ? 'Continuar a cotización' : 'Continuar al pago'}</button></div>
      </form>`;
    } else if (order.step === 2 && order.quote) {
      main = `<h2 id="coTitle">Cotiza tu envío por WhatsApp</h2>
      <div class="quote">
        <p>El envío a <strong>${esc(order.data.state)}</strong> tiene costo adicional según el estado de destino. Envíanos tu referencia por WhatsApp y te confirmamos el costo y el <strong>total final antes de cualquier cobro</strong>.</p>
        <div class="quote__ref"><span>Tu referencia</span><b class="folio">${esc(order.ref)}</b></div>
        <ol class="quote__steps">
          <li>Copia el resumen de tu pedido.</li>
          <li>Abre WhatsApp (o escanea el código) y pégalo en el chat.</li>
          <li>Te respondemos con el costo de envío y el total para pagar con tarjeta o transferencia.</li>
        </ol>
        <div class="quote__grid">
          <div class="quote__actions">
            <a class="btn btn--wa btn--lg" href="${esc(STORE.whatsappUrl)}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 00-7.8 13.5L3 21l4.6-1.2A9 9 0 1012 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 8.5c.3 2.6 2.4 5 5 6l1.3-1.3 2 .9c-.2 1.2-1.2 1.9-2.3 1.8-4-.4-7.1-3.6-7.4-7.5-.1-1.1.6-2.1 1.8-2.3l.9 2z" fill="currentColor"/></svg>Abrir WhatsApp</a>
            <button type="button" class="btn btn--ghost btn--lg" id="copyQuote">Copiar resumen del pedido</button>
            <p class="small muted" id="copyMsg" role="status"></p>
          </div>
          <figure class="quote__qr"><img src="${esc(STORE.whatsappQr)}" width="450" height="450" alt="Código QR para cotizar tu envío por WhatsApp"><figcaption>Escanea con tu celular</figcaption></figure>
        </div>
        <details class="quote__preview"><summary>Ver el resumen que vas a enviar</summary><pre id="quoteText"></pre></details>
        <p class="small muted">Por tu privacidad, el resumen solo incluye productos, estado y código postal. Tu carrito se conserva en este dispositivo.</p>
      </div>
      <div class="co__nav"><button type="button" class="btn btn--ghost" id="backStep">Atrás</button><button type="button" class="btn btn--ghost" data-close>Seguir comprando</button></div>`;
    } else if (order.step === 2) {
      const d = order.data, online = order.pay === 'card' && cardOnline();
      main = `<h2 id="coTitle">${online ? 'Paga tu pedido' : 'Revisa y envía tu pedido'}</h2>
      <form id="coForm" novalidate>
        <div class="info-box"><strong>Enviar a:</strong> ${esc(d.gift && d.giftTo ? d.giftTo : d.name)} · ${esc(d.street)}, ${esc(d.col)}, C.P. ${esc(d.cp)}, ${esc(d.city)}, ${esc(d.state)} · Tel. ${esc(d.phone)}${d.gift ? ' · 🎁 Envío como regalo' : ''} <button type="button" class="link" id="editAddr">Editar</button></div>
        <h3 style="margin:16px 0 10px;font-size:16px">¿Cómo quieres pagar?</h3>
        <div class="opts">
          <label class="opt"><input type="radio" name="pay" value="card" ${order.pay === 'card' ? 'checked' : ''}><div><strong>Tarjeta de débito o crédito</strong><span class="muted">${cardOnline() ? 'Visa o Mastercard · paga aquí mismo de forma segura' : 'Visa o Mastercard · te enviamos un enlace de pago seguro'}</span></div><span class="paymarks paymarks--sm" aria-hidden="true"><span class="pm pm--visa">VISA</span><span class="pm pm--mc"><i></i><i></i></span></span></label>
          <label class="opt"><input type="radio" name="pay" value="spei" ${order.pay === 'spei' ? 'checked' : ''}><div><strong>Transferencia bancaria</strong><span class="muted">Te enviamos la CLABE y el monto exacto</span></div></label>
        </div>
        <div class="checks">
          <label><input type="checkbox" id="acceptTerms"> <span>He leído y acepto los <button type="button" class="link" data-legal="terminos">Términos y condiciones</button> y el <button type="button" class="link" data-legal="privacidad">Aviso de privacidad</button>.</span></label>
          <label><input type="checkbox" id="acceptMkt"> <span>Quiero recibir ofertas por correo <span class="muted">(opcional)</span>.</span></label>
          <p class="small" id="termsErr" style="color:var(--err)" aria-live="polite"></p>
        </div>
        ${online ? `<section class="cardpay" aria-labelledby="cardpayT">
          <header class="cardpay__head"><h3 id="cardpayT">Datos de tu tarjeta</h3><span class="cardpay__lock">${lockSvg} Pago cifrado · Visa y Mastercard</span></header>
          <div class="cardpay__body">
            <div class="ccard" id="ccPreview" aria-hidden="true"><span class="ccard__chip"></span><span class="ccard__brand"></span><span class="ccard__num">•••• •••• •••• ••••</span><span class="ccard__name">NOMBRE DEL TITULAR</span><span class="ccard__exp">MM/AA</span></div>
            <div class="fgrid cardpay__fields">
              ${field('ccnum', 'Número de tarjeta', { full: true, ac: 'cc-number', im: 'numeric', max: 23, ph: '1234 5678 9012 3456' })}
              ${field('ccname', 'Nombre como aparece en la tarjeta', { full: true, ac: 'cc-name', max: 60 })}
              ${field('ccexp', 'Vencimiento', { ac: 'cc-exp', im: 'numeric', max: 5, ph: 'MM/AA' })}
              ${field('cvv', 'Código de seguridad', { type: 'password', ac: 'cc-csc', im: 'numeric', max: 4, ph: 'CVV' })}
            </div>
          </div>
          <p class="cardpay__err" id="payErr" role="alert"></p>
          <p class="small muted">Tarjetas de débito o crédito Visa y Mastercard. Tus datos viajan cifrados directo al procesador de BBVA (Openpay); MEXIUSA no ve ni guarda el número de tu tarjeta. Al pagar aceptas el cargo de <strong>${fmt(t.total)}</strong> MXN.</p>
        </section>
        <div class="co__nav"><button type="button" class="btn btn--ghost" id="backStep">Atrás</button><button class="btn btn--red btn--lg" type="submit" id="payBtn">Pagar ${fmt(t.total)}</button></div>`
        : `<div class="ship-note ship-note--co"><span aria-hidden="true">✉️</span><p><strong>Así funciona:</strong> al confirmar se abre tu correo con el pedido completo dirigido a <strong>${esc(STORE.ordersEmail)}</strong>. Solo presiona <em>Enviar</em>. Te respondemos con el ${order.pay === 'card' ? 'enlace de pago' : 'número de CLABE'} y el total. <strong>No se cobra nada</strong> hasta que tú pagues; nunca te pediremos datos de tarjeta por correo.</p></div>
        <div class="co__nav"><button type="button" class="btn btn--ghost" id="backStep">Atrás</button>
          <button class="btn btn--red btn--lg" type="submit" id="payBtn">Enviar pedido por correo · ${fmt(t.total)}</button></div>`}
      </form>`;
    } else if (order.payment) {
      const pay = order.payment, ok = pay.status === 'completed';
      main = `<div class="done-wrap">
        <svg class="check-anim" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="40" fill="none" stroke="${ok ? 'var(--ok)' : 'var(--gold)'}" stroke-width="4"/><path d="M26 43l11 11 21-23" fill="none" stroke="${ok ? 'var(--ok)' : 'var(--gold)'}" stroke-width="5" stroke-linecap="round"/></svg>
        <h2 id="coTitle">${ok ? '¡Pago aprobado! 🎄' : 'Tu pago está en revisión'}</h2>
        <p>Folio <span class="folio">${esc(order.folio)}</span></p>
        ${pay.last4 ? `<p class="muted">Tarjeta terminación <strong>${esc(pay.last4)}</strong>${pay.id ? ` · Operación ${esc(String(pay.id))}` : ''}</p>` : ''}
        <p class="muted">${ok ? `Recibimos tu pago de <strong>${fmt(pay.amount || 0)}</strong>. Te enviaremos la confirmación a <strong>${esc(order.data.email)}</strong> y después la guía de rastreo. En tu estado de cuenta aparecerá como MEXIUSA.` : 'Tu banco está revisando el pago. Te avisaremos por correo; si se rechaza no se hará ningún cargo.'}</p>
        <div class="quote__actions" style="width:min(380px,100%)">
          <a class="btn btn--ghost btn--lg" href="${esc(mailtoHref())}">Enviar copia del pedido a MEXIUSA</a>
          <button type="button" class="btn btn--red btn--lg" data-close>Listo</button></div>
        <p class="info-box">Guarda tu folio. Tienes 5 días hábiles desde la entrega para revocar tu compra, y los regalos se pueden cambiar hasta el 15 de enero.</p>
      </div>`;
    } else {
      main = `<div class="done-wrap">
        <svg class="check-anim" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="40" fill="none" stroke="var(--ok)" stroke-width="4"/><path d="M26 43l11 11 21-23" fill="none" stroke="var(--ok)" stroke-width="5" stroke-linecap="round"/></svg>
        <h2 id="coTitle">¡Tu pedido está listo para enviarse!</h2>
        <p>Folio <span class="folio">${esc(order.folio)}</span></p>
        <p class="muted">Se abrió tu correo con el pedido dirigido a <strong>${esc(STORE.ordersEmail)}</strong>. Presiona <strong>Enviar</strong> y te responderemos con el ${order.pay === 'card' ? 'enlace de pago con tarjeta' : 'número de CLABE para tu transferencia'}.</p>
        <div class="quote__actions" style="width:min(380px,100%)">
          <a class="btn btn--ghost btn--lg" id="mailAgain" href="${esc(mailtoHref())}">¿No se abrió? Abrir correo de nuevo</a>
          <button type="button" class="btn btn--ghost btn--lg" id="copyOrder">Copiar pedido</button>
          <p class="small muted" id="copyMsg" role="status"></p>
          <button type="button" class="btn btn--red btn--lg" id="sentDone">Ya lo envié ✓</button>
        </div>
        <p class="info-box">Si prefieres, envía el pedido copiado a ${esc(STORE.ordersEmail)} desde cualquier correo. Recuerda: tienes 5 días hábiles desde la entrega para revocar tu compra, y los regalos se pueden cambiar hasta el 15 de enero.</p>
      </div>`;
    }
    co.innerHTML = `<button class="round modal__x" data-close aria-label="Cerrar">×</button><div class="co"><div class="co__main">${stepsHTML()}${main}</div><aside class="co__side" aria-label="Resumen">${sideHTML()}</aside></div>`;
    bindCheckout();
  }

  function validate(ids) {
    let ok = true, first;
    ids.forEach((id) => {
      const el = $(`#f_${id}`, co); if (!el) return;
      const r = V[id] ? V[id](el.value.trim()) : true; const msg = r === true ? '' : r; const wrap = el.closest('.field');
      wrap.classList.toggle('invalid', !!msg); wrap.querySelector('.err').textContent = msg; el.setAttribute('aria-invalid', String(!!msg));
      if (msg) { ok = false; first = first || el; }
    });
    first?.focus(); return ok;
  }
  const mask = (id, fn) => $(`#f_${id}`, co)?.addEventListener('input', (e) => { e.target.value = fn(e.target.value); });

  // Resumen para WhatsApp: sin nombre, teléfono ni domicilio (privacidad)
  function quoteText() {
    const t = totals(order.data.state);
    return [`Hola, quiero cotizar el envío de mi pedido MEXIUSA (Bazar Navideño).`, `Referencia: ${order.ref}`, '',
      ...t.lines.map(({ p, qty, sub }) => `• ${p.name} (${p.id}) × ${qty} = ${fmt(sub)}`), '',
      `Total en productos: ${fmt(t.subtotal)} (IVA incluido)`, `Envío a: ${order.data.state}, C.P. ${order.data.cp}`,
      order.data.gift ? 'Es un regalo (sin precios en el paquete).' : ''].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n').trim();
  }

  // Pedido por correo (sin servidor): el cliente lo envía desde su propio correo a MEXIUSA.
  function orderText() {
    const d = order.data, t = totals(d.state);
    const L = [`Pedido MEXIUSA · Bazar Navideño`, `Folio: ${order.folio}`, '', 'PRODUCTOS',
      ...t.lines.map(({ p, qty, sub }) => `• ${p.name} (${p.id}) × ${qty} = ${fmt(sub)}`), '',
      `Subtotal: ${fmt(t.subtotal)}`, `Envío (${d.state}): ${t.ship ? fmt(t.ship) : 'Gratis'}`, `TOTAL: ${fmt(t.total)} MXN (IVA incluido)`, '',
      order.payment ? `PAGADO CON TARJETA en la tienda · Openpay operación ${order.payment.id} · tarjeta ****${order.payment.last4 || ''} · estado: ${order.payment.status === 'completed' ? 'aprobado' : 'en revisión'}`
        : `Forma de pago preferida: ${order.pay === 'card' ? 'Tarjeta Visa/Mastercard (enviar enlace de pago)' : 'Transferencia bancaria (enviar CLABE)'}`, '',
      'DATOS DE ENTREGA', `Nombre: ${d.name}`, `Teléfono: ${d.phone}`, `Correo: ${d.email}`,
      `Dirección: ${d.street}, Col. ${d.col}, C.P. ${d.cp}, ${d.city}, ${d.state}`];
    if (d.ref) L.push(`Referencias: ${d.ref}`);
    if (d.gift) L.push('', 'ES REGALO (sin precios en el paquete)', `Para: ${d.giftTo}`, d.giftFrom ? `De: ${d.giftFrom}` : '', d.giftMsg ? `Mensaje: ${d.giftMsg}` : '');
    if (d.invoice) L.push('', 'FACTURA CFDI 4.0', `RFC: ${d.rfc}`, `C.P. fiscal: ${d.cfdiCp}`, `Régimen: ${d.regimen || '-'}`);
    L.push('', `Acepto Términos y Aviso de privacidad: Sí`, `Acepto recibir ofertas: ${order.marketing ? 'Sí' : 'No'}`);
    return L.filter((x) => x !== '' || true).join('\n').replace(/\n{3,}/g, '\n\n');
  }
  const mailtoHref = () => `mailto:${STORE.ordersEmail}?subject=${encodeURIComponent(`Pedido ${order.folio} · MEXIUSA`)}&body=${encodeURIComponent(orderText())}`;

  function bindCheckout() {
    if (order.step === 3) {
      $('#copyOrder', co)?.addEventListener('click', async () => {
        const msg = $('#copyMsg', co);
        try { await navigator.clipboard.writeText(orderText()); msg.textContent = `✓ Pedido copiado. Pégalo en un correo a ${STORE.ordersEmail}.`; toast('Pedido copiado'); }
        catch { msg.textContent = `No se pudo copiar automáticamente. Escríbenos a ${STORE.ordersEmail} con tu folio ${order.folio}.`; }
      });
      $('#sentDone', co)?.addEventListener('click', () => {
        state.cart = {}; saveCart(); updateBadges(); renderCart(); co.close(); confetti(); toast('¡Gracias! Te responderemos pronto por correo');
      });
      return;
    }
    if (order.quote && order.step === 2) {
      $('#quoteText', co).textContent = quoteText();
      $('#backStep', co)?.addEventListener('click', () => { order.step = 1; renderCheckout(); });
      $('#copyQuote', co)?.addEventListener('click', async () => {
        const msg = $('#copyMsg', co);
        try { await navigator.clipboard.writeText(quoteText()); msg.textContent = '✓ Resumen copiado. Pégalo en el chat de WhatsApp.'; toast('Resumen copiado'); }
        catch { msg.textContent = 'No se pudo copiar automáticamente: abre "Ver el resumen" y cópialo a mano.'; $('.quote__preview', co).open = true; }
      });
    }
    const form = $('#coForm', co); if (!form) return;
    mask('phone', (v) => v.replace(/[^\d ]/g, '')); mask('cp', (v) => v.replace(/\D/g, '')); mask('cfdiCp', (v) => v.replace(/\D/g, ''));
    mask('rfc', (v) => v.toUpperCase().replace(/[^A-ZÑ&\d]/g, ''));
    mask('ccnum', (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim());
    mask('ccexp', (v) => { v = v.replace(/\D/g, '').slice(0, 4); return v.length > 2 ? v.slice(0, 2) + '/' + v.slice(2) : v; });
    mask('cvv', (v) => v.replace(/\D/g, ''));
    $('#f_state', co)?.addEventListener('change', (e) => {
      const v = e.target.value; $('#shipQuote', co).innerHTML = shipQuoteHTML(v); $('.co__side', co).innerHTML = sideHTML();
      $('#coNext', co).textContent = v && !zoneFor(v) ? 'Continuar a cotización' : 'Continuar al pago';
    });
    $('#wantInvoice', co)?.addEventListener('change', (e) => { order.data.invoice = e.target.checked; $('#invoiceBox', co).hidden = !e.target.checked; });
    $('#isGift', co)?.addEventListener('change', (e) => { order.data.gift = e.target.checked; $('#giftFields', co).hidden = !e.target.checked; });
    $$('input[name=pay]', co).forEach((r) => r.addEventListener('change', () => {
      order.pay = r.value; renderCheckout();
    }));
    $('#backStep', co)?.addEventListener('click', () => { order.step = 1; renderCheckout(); });
    $('#editAddr', co)?.addEventListener('click', () => { order.step = 1; renderCheckout(); });
    $('#acceptTerms', co)?.addEventListener('change', () => { $('#termsErr', co).textContent = ''; });
    ['ccnum', 'ccname', 'ccexp'].forEach((id) => $(`#f_${id}`, co)?.addEventListener('input', cardPreview));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (form.querySelector('.hp')?.value) return; // bot
      if (order.step === 1) {
        const ids = ['name', 'email', 'phone', 'street', 'col', 'cp', 'city', 'state'];
        if (order.data.gift) ids.push('giftTo');
        if (order.data.invoice) ids.push('rfc', 'cfdiCp');
        if (!validate(ids)) return;
        ['name', 'email', 'phone', 'street', 'col', 'cp', 'city', 'state', 'ref', 'rfc', 'cfdiCp', 'regimen', 'giftTo', 'giftFrom', 'giftMsg'].forEach((id) => { const el = $(`#f_${id}`, co); if (el) order.data[id] = el.value.trim(); });
        order.quote = !zoneFor(order.data.state);
        if (order.quote && !order.ref) order.ref = 'COT-' + Date.now().toString(36).toUpperCase().slice(-5) + crypto.getRandomValues(new Uint16Array(1))[0].toString(16).toUpperCase().padStart(4, '0');
        order.step = 2; renderCheckout(); $('.co__main', co).scrollTop = 0; co.scrollTop = 0;
      } else if (order.step === 2) {
        if (!$('#acceptTerms', co).checked) { $('#termsErr', co).textContent = 'Debes aceptar los términos y el aviso de privacidad para continuar.'; $('#acceptTerms', co).focus(); return; }
        order.marketing = $('#acceptMkt', co).checked;
        if (order.pay === 'card' && cardOnline()) {
          if (order.busy || !validate(['ccnum', 'ccname', 'ccexp', 'cvv'])) return;
          payWithCard(); return;
        }
        if (!order.folio) order.folio = newFolio();
        /* Sin servidor: el pedido se envía desde el correo del cliente.
           FUTURO: POST /api/orders con { items:[{id,qty}], address, gift } + procesador de pagos (PCI DSS). */
        order.step = 3; renderCheckout();
        location.href = mailtoHref(); // abre el cliente de correo con el pedido listo
      }
    });
  }
  function openCheckout() {
    if (!Object.keys(state.cart).length) { toast('Tu carrito está vacío'); return; }
    order.step = 1; order.folio = ''; order.last4 = ''; order.quote = false; order.ref = ''; order.payment = null; renderCheckout(); co.showModal(); document.body.classList.add('lock');
  }
  co.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) co.close(); });
  co.addEventListener('close', () => { document.body.classList.remove('lock'); if (order.step === 3) { order.data = {}; order.step = 1; order.payment = null; } });
  co.addEventListener('cancel', (e) => { if (order.busy) e.preventDefault(); });

  /* ---------- confeti festivo ---------- */
  function confetti() {
    if (reduceMotion) return;
    const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c);
    const ctx = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
    const cols = ['#c8102e', '#14307a', '#0f5132', '#e8cf8e', '#ffffff'];
    const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight / 2, vx: (Math.random() - .5) * 16, vy: Math.random() * -15 - 4, s: Math.random() * 7 + 4, c: cols[Math.floor(Math.random() * cols.length)], r: Math.random() * 6, vr: (Math.random() - .5) * .3 }));
    let t = 0;
    (function f() { ctx.clearRect(0, 0, c.width, c.height);
      for (const p of ps) { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
      if (++t < 150) requestAnimationFrame(f); else c.remove(); })();
  }

  /* ---------- cookies ---------- */
  const cookie = $('#cookie');
  if (!store.get('mexiusa.consent', null)) setTimeout(() => { cookie.hidden = false; }, 900);
  const setConsent = (analytics) => { store.set('mexiusa.consent', { necessary: true, analytics, at: new Date().toISOString() }); cookie.hidden = true; toast(analytics ? 'Preferencias guardadas' : 'Solo usaremos cookies necesarias'); };
  $('#ckAccept').addEventListener('click', () => setConsent(true));
  $('#ckReject').addEventListener('click', () => setConsent(false));
  $('#cookieSettings').addEventListener('click', () => { cookie.hidden = false; $('#ckReject').focus(); });

  $('#floatClose').addEventListener('click', (e) => { e.stopPropagation(); $('#floatCard').classList.add('gone'); });
  $('#floatCard').addEventListener('click', () => openLegal('devoluciones'));
  $('#year').textContent = new Date().getFullYear();

  updateBadges(); renderGrid(); renderCart();
})();

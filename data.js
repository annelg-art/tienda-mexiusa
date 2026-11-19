/* ===========================================================
   MEXIUSA — configuración, categorías y textos legales
   Productos: products.js (generado del catálogo PDF).
   En producción: precios y existencias vienen del servidor.
   =========================================================== */
'use strict';

window.STORE = {
  brand: 'MEXIUSA',
  currency: 'MXN',
  ivaRate: 0.16,                 // precios del catálogo con IVA incluido
  /* Envíos (flyer Bazar Navideño): GRATIS solo en CDMX.
     Estado de México y demás estados: costo adicional según estado y tamaño del paquete.
     Tarifas SUGERIDAS (MXN, IVA incluido) con base en cotizaciones públicas de nov-2026
     de Estafeta Terrestre, FedEx Economy y DHL vía plataformas de guías (EnvíoFácil, DrEnvío,
     Cubbo), desde CDMX, + ~15 % por combustible, seguro y empaque. AJUSTAR con tu contrato.
     Peso facturable = máx(peso real, largo×ancho×alto/5000), como cobran las paqueterías. */
  freeState: 'Ciudad de México',
  weightTiers: [1, 3, 5, 10, 20, 30],          // kg facturables de cada columna de precios
  shippingZones: [
    { id: 'cdmx', name: 'Ciudad de México', days: [1, 3], prices: [0, 0, 0, 0, 0, 0], states: ['Ciudad de México'] },
    { id: 'z1', name: 'Estado de México', days: [2, 3], prices: [99, 119, 139, 179, 279, 379], states: ['Estado de México'] },
    { id: 'z2', name: 'Centro', days: [2, 4], prices: [129, 149, 159, 199, 319, 429], states: ['Hidalgo', 'Morelos', 'Puebla', 'Querétaro', 'Tlaxcala', 'Guanajuato', 'Michoacán'] },
    { id: 'z3', name: 'Occidente, Golfo y Noreste', days: [3, 5], prices: [149, 169, 179, 239, 369, 499], states: ['Jalisco', 'Aguascalientes', 'San Luis Potosí', 'Zacatecas', 'Colima', 'Nayarit', 'Veracruz', 'Oaxaca', 'Guerrero', 'Nuevo León', 'Coahuila', 'Tamaulipas', 'Durango'] },
    { id: 'z4', name: 'Sureste y Península', days: [4, 6], prices: [169, 189, 209, 289, 449, 599], states: ['Yucatán', 'Quintana Roo', 'Campeche', 'Tabasco', 'Chiapas'] },
    { id: 'z5', name: 'Noroeste', days: [5, 8], prices: [189, 209, 229, 329, 509, 679], states: ['Baja California', 'Baja California Sur', 'Sonora', 'Sinaloa', 'Chihuahua'] },
  ],
  extraPer10kg: 0.85,          // arriba de 30 kg: +85 % del precio de 10 kg por cada 10 kg extra
  ordersEmail: 'contacto@mexiusa.com',   // los pedidos llegan a este correo
  whatsappUrl: 'https://chat.whatsapp.com/L54gUE4DxzB81dWFPxyzL4',
  whatsappQr: 'img/whatsapp-qr.png',
  christmas: '2026-12-25T00:00:00-06:00',
  cutoffStd: '2026-12-16',       // AJUSTAR: último día para pedir fuera de CDMX y recibir antes del 24
  cutoffCdmx: '2026-12-20',      // AJUSTAR: último día para pedir en CDMX
  maxQtyPerItem: 5,
  // Pago con tarjeta en la misma página (Mercado Pago · Card Payment Brick).
  // publicKey: "Public Key" de tus credenciales de Mercado Pago (empieza con TEST- o APP_USR-). Es pública: puede ir aquí.
  // apiUrl: dirección del servidor de cobro (carpeta servidor/). El Access Token NUNCA va aquí.
  // Si alguno está vacío, la tienda sigue funcionando con pedido por correo.
  mercadoPago: {
    publicKey: '',
    apiUrl: '',
  },
};

/* Peso facturable estimado por producto (kg), ya empacado: máx(peso real, volumétrico).
   Estimado a partir de las medidas del catálogo y del tamaño típico de la caja.
   AJUSTAR pesando cada caja real. */
window.SHIP_KG = {
  'MX-BEB-001': 16, 'MX-BEB-002': 16, 'MX-BEB-003': 3, 'MX-BEB-004': 2, 'MX-BEB-005': 6, 'MX-BEB-006': 4, 'MX-BEB-007': 3,
  'MX-BEB-008': 8, 'MX-BEB-009': 4, 'MX-BEB-010': 8, 'MX-MAS-001': 5, 'MX-MAS-002': 5, 'MX-COC-001': 4, 'MX-COC-002': 1,
  'MX-COC-003': 1, 'MX-HOG-001': 2, 'MX-HOG-002': 5, 'MX-HOG-004': 9, 'MX-HOG-005': 9, 'MX-BEL-001': 2, 'MX-BEL-002': 1,
  'MX-DEP-001': 3, 'MX-DEP-002': 1, 'MX-DEP-003': 1, 'MX-TEC-001': 3, 'MX-TEC-002': 3, 'MX-TEC-003': 2, 'MX-TEC-004': 9,
  'MX-TEC-005': 1, 'MX-TEC-006': 2, 'MX-TEC-007': 1, 'MX-TEC-008': 1, 'MX-TEC-009': 1, 'MX-TEC-010': 1, 'MX-TEC-011': 1,
  'MX-TEC-012': 1, 'MX-NAV-001': 1, 'MX-NAV-002': 1, 'MX-NAV-003': 3, 'MX-NAV-004': 5, 'MX-JUG-001': 10, 'MX-JUG-002': 3,
  'MX-OUT-001': 1, 'MX-OUT-002': 1, 'MX-OUT-004': 2, 'MX-OUT-005': 1, 'MX-OUT-006': 2, 'MX-OUT-007': 2,
};

window.CATEGORIES = [
  { id: 'navidad', name: 'Navidad' },
  { id: 'tecnologia', name: 'Tecnología' },
  { id: 'juguetes', name: 'Juguetes' },
  { id: 'bebes', name: 'Bebés' },
  { id: 'hogar', name: 'Hogar' },
  { id: 'cocina', name: 'Cocina' },
  { id: 'belleza', name: 'Belleza' },
  { id: 'deportes', name: 'Deportes' },
  { id: 'mascotas', name: 'Mascotas' },
  { id: 'accesorios', name: 'Accesorios' },
];

/* Guía de regalos: agrupa categorías por persona */
window.GIFT_GUIDE = [
  { id: 'peques', title: 'Para los peques', text: 'Robots, pistas con luces y bloques para armar.', cats: ['juguetes'], tone: 'red' },
  { id: 'tecno', title: 'Para quien ama la tecnología', text: 'Audífonos, monitores, cargadores y más.', cats: ['tecnologia'], tone: 'navy' },
  { id: 'deco', title: 'Para decorar la casa', text: 'Luces, árbol inteligente y esferas.', cats: ['navidad'], tone: 'green' },
  { id: 'bebe', title: 'Para la familia nueva', text: 'Mecedoras, portabebés y todo para el bebé.', cats: ['bebes'], tone: 'gold' },
  { id: 'hogar', title: 'Para el hogar', text: 'Cocina práctica y comodidad diaria.', cats: ['hogar', 'cocina'], tone: 'green' },
  { id: 'mima', title: 'Para consentirse', text: 'Belleza, deporte y descanso.', cats: ['belleza', 'deportes'], tone: 'red' },
  { id: 'mascota', title: 'Para su mascota', text: 'Comedero con cámara y mochila transportadora.', cats: ['mascotas'], tone: 'navy' },
];

window.BUDGETS = [
  { id: 'b200', label: 'Menos de $200', min: 0, max: 199.99 },
  { id: 'b500', label: '$200 a $500', min: 200, max: 500 },
  { id: 'b1000', label: '$500 a $1,000', min: 500.01, max: 1000 },
  { id: 'b1000p', label: 'Más de $1,000', min: 1000.01, max: Infinity },
];

/* ---------- Textos legales (plantillas — revisar con asesor legal) ---------- */
window.LEGAL = {
  terminos: {
    title: 'Términos y condiciones',
    html: `
<p class="upd">Última actualización: 18 de noviembre de 2026 · Plantilla para revisión jurídica</p>
<h3>1. Proveedor</h3>
<p>MEXIUSA SOLUCIONES COMERCIALES, S. de R.L. de C.V. (nombre comercial: MEXIUSA Soluciones Comerciales), RFC MSC2605208H5, con domicilio en Av. Horacio 1844, Piso 9, Depto. 2, Col. Polanco I Sección, Alcaldía Miguel Hidalgo, C.P. 11510, Ciudad de México, teléfono <a class="link" href="tel:+528911085331">+52 891 108 5331</a> y correo <a class="link" href="mailto:contacto@mexiusa.com">contacto@mexiusa.com</a>.</p>
<h3>2. Precios</h3>
<p>Todos los precios se expresan en moneda nacional (MXN) e incluyen IVA. El costo de envío se informa desglosado antes de confirmar la compra. El precio mostrado al confirmar es el total que se cobrará.</p>
<h3>3. Proceso de compra</h3>
<ul><li>Agrega productos al carrito y revisa el resumen.</li><li>Captura tus datos de entrega. En CDMX el envío es gratis; para otros estados el costo se calcula según el estado y el tamaño del paquete y se muestra antes de pagar.</li><li>Elige tu forma de pago preferida (tarjeta Visa o Mastercard, o transferencia bancaria) y revisa el total final.</li><li>Acepta expresamente estos términos y confirma.</li><li><strong>Tarjeta:</strong> capturas tu tarjeta en el formulario seguro de Mercado Pago dentro de esta página y recibes la confirmación al instante con tu folio. MEXIUSA no ve ni guarda el número de tu tarjeta.</li><li><strong>Transferencia:</strong> se abre tu correo con el pedido dirigido a contacto@mexiusa.com y te respondemos con la CLABE. El pedido se procesa al confirmarse tu pago.</li><li>Nunca te pediremos datos de tarjeta por correo, teléfono o WhatsApp.</li></ul>
<h3>4. Disponibilidad</h3>
<p>Si un producto no estuviera disponible después de pagado, te avisaremos dentro de 48 h y podrás elegir entre esperar, cambiarlo o recibir el reembolso total por el mismo medio de pago.</p>
<h3>5. Fechas de temporada navideña</h3>
<p>Las fechas límite para recibir antes del 24 de diciembre son estimaciones de la paquetería. Si tu pedido llega después de la fecha prometida, puedes cancelarlo y recibir el reembolso total.</p>
<h3>6. Revocación (derecho de arrepentimiento)</h3>
<p>Conforme al artículo 56 de la Ley Federal de Protección al Consumidor, puedes revocar tu compra sin responsabilidad dentro de los 5 días hábiles siguientes a la entrega, avisando por correo o teléfono.</p>
<h3>7. Garantía</h3>
<p>Ver la sección "Garantía". La garantía legal no se condiciona a la compra de garantías extendidas.</p>
<h3>8. Facturación</h3>
<p>Puedes solicitar tu CFDI 4.0 durante el mes de la compra con tu RFC, régimen fiscal, código postal y uso de CFDI.</p>
<h3>9. Quejas y jurisdicción</h3>
<p>Atendemos quejas en <a class="link" href="mailto:contacto@mexiusa.com">contacto@mexiusa.com</a>. También puedes acudir a la PROFECO (Concilianet). Aplican las leyes de México.</p>`
  },
  privacidad: {
    title: 'Aviso de privacidad integral',
    html: `
<p class="upd">Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares · Plantilla para revisión jurídica</p>
<h3>Responsable</h3>
<p>MEXIUSA SOLUCIONES COMERCIALES, S. de R.L. de C.V. (MEXIUSA), con domicilio en Av. Horacio 1844, Piso 9, Depto. 2, Col. Polanco I Sección, Alcaldía Miguel Hidalgo, C.P. 11510, Ciudad de México, es responsable del tratamiento de tus datos personales.</p>
<h3>Datos que recabamos</h3>
<ul><li>Identificación y contacto: nombre, correo, teléfono.</li><li>Entrega: domicilio y referencias.</li><li>Fiscales (solo si pides factura): RFC, régimen y código postal.</li><li>Mensaje de regalo, si decides incluirlo.</li></ul>
<p><strong>No recabamos ni almacenamos datos de tarjetas.</strong> El pago se procesa directamente por un proveedor certificado PCI DSS; solo recibimos la confirmación y los últimos 4 dígitos.</p>
<h3>Finalidades primarias</h3>
<p>Procesar y entregar tu pedido, emitir factura, atender garantías, devoluciones y aclaraciones, y prevenir fraude.</p>
<h3>Finalidades secundarias (opcionales)</h3>
<p>Envío de promociones y analítica de uso del sitio. Puedes negarte al comprar o en cualquier momento escribiendo a <a class="link" href="mailto:contacto@mexiusa.com">contacto@mexiusa.com</a>.</p>
<h3>Transferencias</h3>
<p>Paquetería, procesador de pagos y proveedor de facturación, únicamente para cumplir con tu pedido.</p>
<h3>Derechos ARCO y revocación</h3>
<p>Puedes ejercer tus derechos de Acceso, Rectificación, Cancelación y Oposición, o revocar tu consentimiento, escribiendo a <a class="link" href="mailto:contacto@mexiusa.com">contacto@mexiusa.com</a>. Respondemos en un máximo de 20 días hábiles.</p>
<h3>Seguridad</h3>
<p>Aplicamos cifrado en tránsito (TLS), control de accesos y conservación limitada al tiempo que exigen las obligaciones fiscales.</p>`
  },
  cookies: {
    title: 'Política de cookies',
    html: `
<h3>Necesarias (siempre activas)</h3>
<p>Mantienen tu carrito, la sesión de pago y la seguridad del sitio. Sin ellas la tienda no funciona.</p>
<h3>Analítica (opcional)</h3>
<p>Nos ayudan a saber qué productos se ven más. Solo se activan si las aceptas y puedes retirarlas en "Configurar cookies".</p>
<h3>Publicidad</h3>
<p>No usamos cookies publicitarias de terceros.</p>`
  },
  devoluciones: {
    title: 'Envíos, cambios y devoluciones',
    html: `
<h3>Envíos</h3>
<ul><li><strong>Envío gratis solo en la Ciudad de México</strong> (1 a 3 días hábiles).</li><li><strong>Estado de México y demás estados: costo adicional de envío</strong>, que depende del estado de destino y del peso o tamaño del paquete (se cobra el mayor entre el peso real y el peso volumétrico, como lo hacen las paqueterías). El costo exacto se calcula y se muestra en el checkout <strong>antes de pagar</strong>.</li><li>Tiempos estimados: Estado de México 2–3 días hábiles; centro 2–4; occidente, golfo y noreste 3–5; sureste y península 4–6; noroeste 5–8.</li><li>¿Dudas con tu envío? Escríbenos por WhatsApp.</li><li>Recibirás tu guía de rastreo por correo cuando salga tu pedido.</li></ul>
<h3>Derecho de revocación — 5 días hábiles</h3>
<p>Tienes 5 días hábiles desde que recibes tu pedido para cancelarlo sin dar explicaciones (art. 56 LFPC). Reembolsamos el 100%, incluido el envío original, por el mismo medio de pago.</p>
<h3>Cambios de regalos navideños</h3>
<p>Las compras hechas del 1 de noviembre al 24 de diciembre pueden cambiarse hasta el <strong>15 de enero de 2027</strong> si el producto está sin uso y en su empaque. Quien recibe el regalo puede hacer el cambio con el folio del pedido.</p>
<h3>Producto dañado o incompleto</h3>
<p>Avísanos dentro de 48 h con fotos y lo reponemos o reembolsamos sin costo.</p>`
  },
  garantia: {
    title: 'Garantía',
    html: `
<p>Todos nuestros productos cuentan con garantía por escrito contra defectos de fabricación, conforme a los artículos 77 a 79 de la LFPC. Plazo: <strong>90 días</strong> naturales a partir de la entrega.</p>
<h3>Cómo hacerla válida</h3>
<ul><li>Escribe a <a class="link" href="mailto:contacto@mexiusa.com">contacto@mexiusa.com</a> con tu folio y fotos o video del fallo.</li><li>Te enviamos guía de retorno sin costo.</li><li>Reparamos, reponemos o reembolsamos. El tiempo de reparación no cuenta dentro del plazo de garantía.</li></ul>
<p>Los productos electrónicos incluyen instructivo y póliza en español.</p>`
  },
  contacto: {
    title: 'Contacto y quejas',
    html: `
<p><strong>MEXIUSA SOLUCIONES COMERCIALES, S. de R.L. de C.V.</strong><br>RFC: MSC2605208H5<br>Av. Horacio 1844, Piso 9, Depto. 2, Col. Polanco I Sección, Alcaldía Miguel Hidalgo, C.P. 11510, Ciudad de México (entre Av. Periférico y Calle Privada Horacio)<br>Teléfono: <a class="link" href="tel:+528911085331">+52 891 108 5331</a> · Correo: <a class="link" href="mailto:contacto@mexiusa.com">contacto@mexiusa.com</a><br>Horario: lunes a sábado de 9:00 a 19:00 h (temporada navideña)<br>WhatsApp: <a class="link" href="https://chat.whatsapp.com/L54gUE4DxzB81dWFPxyzL4" target="_blank" rel="noopener noreferrer">escríbenos aquí</a></p>
<h3>Quejas</h3>
<p>Respondemos toda queja en un máximo de 3 días hábiles. Si no quedas satisfecho, puedes acudir a la Procuraduría Federal del Consumidor: Teléfono del Consumidor 55 5568 8722 / 800 468 8722 o Concilianet.</p>`
  },
};

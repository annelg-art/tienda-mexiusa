# MEXIUSA · Bazar Navideño

MEXIUSA Soluciones Comerciales tiene aquí su tienda en línea. Es un sitio estático hecho con HTML, CSS y JavaScript, sin dependencias, y se publica en GitHub Pages.

## Cómo funciona un pedido

1. El cliente arma su carrito y captura sus datos de entrega.
2. El envío se calcula en el momento: es **gratis en CDMX** y en los demás estados el costo depende de la zona y del peso del paquete.
3. El cliente elige cómo pagar:
   - **Tarjeta de débito o crédito:** paga ahí mismo, en el formulario seguro de Mercado Pago, y ve la confirmación al instante. Para activarlo, sigue [`servidor/LEEME.md`](servidor/LEEME.md).
   - **Transferencia** (o tarjeta mientras no esté activado Mercado Pago): se abre su correo con el pedido y un folio, dirigido a **contacto@mexiusa.com**, y MEXIUSA le responde con la CLABE o el enlace de pago.
4. El sitio nunca ve ni guarda números de tarjeta.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Diseño navideño y versión para celular |
| `app.js` | Carrito, filtros, checkout, animaciones |
| `data.js` | **Configuración**: tarifas de envío, fechas límite, correo de pedidos, WhatsApp, textos legales |
| `products.js` | Catálogo de 48 productos, generado desde el PDF |
| `img/` | Fotos de productos, escenas navideñas y logos |

## Cambios frecuentes

- **Precios o productos:** se editan en `products.js`.
- **Tarifas de envío:** se cambian en `data.js`, en `shippingZones` y en `SHIP_KG` (el peso de cada producto).
- **Correo de pedidos:** se cambia en `data.js`, en `ordersEmail`.

Si cambiaste precios, productos o tarifas, primero actualiza la lista oficial que usa el servidor de cobro:

```powershell
node herramientas/generar-precios.mjs
```

Después de cualquier cambio hay que subirlo para que se publique:

```powershell
git add -A; git commit -m "Actualiza tienda"; git push
```

## Verlo en tu computadora

```powershell
python -m http.server 5173 --directory .
```

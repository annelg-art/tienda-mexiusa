# MEXIUSA · Bazar Navideño

MEXIUSA Soluciones Comerciales tiene aquí su tienda en línea. Es un sitio estático hecho con HTML, CSS y JavaScript, sin dependencias, y se publica en GitHub Pages.

## Cómo funciona un pedido

1. El cliente arma su carrito y captura sus datos de entrega.
2. El envío se calcula en el momento: es **gratis en CDMX** y en los demás estados el costo depende de la zona y del peso del paquete.
3. El cliente elige cómo pagar: con **tarjeta Visa o Mastercard** o con **transferencia**.
4. Al confirmar, se abre su correo con el pedido completo y un folio, dirigido a **contacto@mexiusa.com**.
5. MEXIUSA le responde con el enlace de pago o con la CLABE. El sitio nunca pide ni guarda datos de tarjeta.

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

Después de cualquier cambio hay que subirlo para que se publique:

```powershell
git add -A; git commit -m "Actualiza tienda"; git push
```

## Verlo en tu computadora

```powershell
python -m http.server 5173 --directory .
```

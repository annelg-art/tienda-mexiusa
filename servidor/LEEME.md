# Activar el pago con tarjeta en la página (Mercado Pago)

La tienda ya trae el panel de tarjeta, el mismo formulario seguro que usa Mercado Libre. Para que aparezca y cobre, necesitas tres cosas:

1. **Cuenta de Mercado Pago** de la empresa, con sus credenciales.
2. **El servidor de cobro.** Es el archivo `worker.js` de esta carpeta y se publica gratis en Cloudflare.
3. **Dos datos en `data.js`.**

Mientras falte alguna, la tienda sigue funcionando con pedido por correo.

---

## 1. Credenciales de Mercado Pago (10 min)

1. Entra a https://www.mercadopago.com.mx/developers/panel/app con la cuenta de MEXIUSA.
2. Selecciona **Crear aplicación** → nombre "Tienda MEXIUSA" → tipo **Pagos en línea** → producto **CheckoutBricks**.
3. Abre la aplicación y ve a **Credenciales de prueba**. Ahí verás dos datos:
   - **Public Key** (empieza con `TEST-`). Es pública y va en `data.js`.
   - **Access Token** (empieza con `TEST-`). **Es secreto.** Solo va en Cloudflare: nunca lo pongas en la página, en GitHub ni en un chat.

> Empieza con las credenciales **de prueba**. Cuando todo funcione, cambia a **Credenciales de producción** (`APP_USR-…`). Para eso Mercado Pago pide datos del negocio y cuenta bancaria.

## 2. Servidor de cobro en Cloudflare (10 min, gratis)

1. Crea una cuenta en https://dash.cloudflare.com/sign-up.
2. Ve a **Workers & Pages** → **Create** → **Create Worker** → nombre `mexiusa-pagos` → **Deploy**.
3. Selecciona **Edit code**, borra todo, pega el contenido de `servidor/worker.js` → **Deploy**.
4. En el Worker, ve a **Settings → Variables and Secrets** y agrega:

| Nombre | Tipo | Valor |
|---|---|---|
| `MP_ACCESS_TOKEN` | **Secret** | tu Access Token de Mercado Pago |
| `SITE_URL` | Text | `https://annelg-art.github.io/tienda-mexiusa/` |
| `ALLOWED_ORIGINS` | Text | `https://annelg-art.github.io` |

5. Copia la dirección del Worker, por ejemplo `https://mexiusa-pagos.tu-usuario.workers.dev`. Si la abres, debe responder `{"ok":true,...}`.

## 3. Conectar la tienda

En `data.js`, llena:

```js
mercadoPago: {
  publicKey: 'TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  apiUrl: 'https://mexiusa-pagos.tu-usuario.workers.dev',
},
```

Súbelo con `git add -A; git commit -m "Activa pago con tarjeta"; git push`.

## 4. Probar con tarjetas de prueba

Con credenciales `TEST-` no se cobra dinero real. Usa las tarjetas de prueba de Mercado Pago:
https://www.mercadopago.com.mx/developers/es/docs/checkout-bricks/additional-content/your-integrations/test/cards

- En "Nombre del titular" escribe **APRO** para un pago aprobado.
- Escribe **OTHE** para un pago rechazado.

Cuando funcione, cambia las dos credenciales por las de producción (`APP_USR-…`).

## ¿Dónde veo los pedidos pagados?

- En tu cuenta de Mercado Pago, en **Actividad**, cada cobro aparece con la referencia del folio (`MXU-…`).
- Los datos de entrega, regalo y factura van guardados en el pago, en el campo **metadata**. Para verlos completos, en la consola de Cloudflare o con soporte, consulta el pago por su número de operación.
- El cliente recibe el comprobante de Mercado Pago en su correo.

## Seguridad

- El número de tarjeta **nunca pasa por MEXIUSA**: lo captura Mercado Pago, que tiene la certificación PCI DSS.
- El servidor **recalcula el total** con `precios.json`. Si alguien altera el precio en su navegador, el cobro se rechaza.
- **Después de cambiar precios, productos o tarifas**, ejecuta `node herramientas/generar-precios.mjs` antes del `git push`.

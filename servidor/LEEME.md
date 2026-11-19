# Activar el pago con tarjeta en la página (Openpay de BBVA)

La tienda ya trae su propio formulario de tarjeta, con el diseño de MEXIUSA. Acepta tarjetas **Visa y Mastercard, de débito o crédito**.

- **Quién cobra:** Openpay, el procesador de pagos de BBVA, que tiene la certificación de seguridad PCI DSS.
- **Dónde llega el dinero:** a la cuenta BBVA de MEXIUSA.

Para que el formulario aparezca y cobre se necesitan tres cosas:

1. **Cuenta de Openpay** a nombre de MEXIUSA, con la cuenta BBVA registrada para recibir los depósitos.
2. **El servidor de cobro.** Es el archivo `worker.js` de esta carpeta y se publica gratis en Cloudflare.
3. **Tres datos en `data.js`.**

Mientras falte alguno, la tienda sigue funcionando con pedido por correo.

---

## 1. Alta en Openpay (BBVA)

1. Entra a https://www.openpay.mx y selecciona **Regístrate**. También puedes pedir el alta a tu ejecutivo de BBVA Empresas (sucursal 1815, Empresas Coyoacán).
2. Ten a la mano:
   - acta constitutiva y poderes del representante legal;
   - identificación oficial del representante legal;
   - Constancia de Situación Fiscal con el RFC **MSC2605208H5**;
   - comprobante de domicilio;
   - **estado de cuenta BBVA**. En el panel de Openpay registras la **CLABE** de la cuenta empresarial para que ahí se depositen las ventas.
3. Openpay te da primero un **ambiente de pruebas (sandbox)**. En **Configuración → Llaves de API** vas a encontrar:
   - **ID de comercio**, que empieza con `m`. Es público y va en `data.js`.
   - **Llave pública**, que empieza con `pk_`. Es pública y va en `data.js`.
   - **Llave privada**, que empieza con `sk_`. **Es secreta.** Solo va en Cloudflare: nunca en la página, en GitHub ni en un chat.
4. Cuando Openpay apruebe tu documentación, activa **producción**. Ahí te dará otras llaves y otro ID de comercio.

## 2. Servidor de cobro en Cloudflare (10 min, gratis)

1. Crea una cuenta en https://dash.cloudflare.com/sign-up.
2. Ve a **Workers & Pages** → **Create** → **Create Worker** → nombre `mexiusa-pagos` → **Deploy**.
3. Selecciona **Edit code**, borra todo, pega el contenido de `servidor/worker.js` → **Deploy**.
4. En el Worker, ve a **Settings → Variables and Secrets** y agrega:

| Nombre | Tipo | Valor |
|---|---|---|
| `OPENPAY_MERCHANT_ID` | Text | tu ID de comercio |
| `OPENPAY_PRIVATE_KEY` | **Secret** | tu llave privada `sk_…` |
| `OPENPAY_SANDBOX` | Text | `true` (pruebas) · `false` (producción) |
| `USE_3DS` | Text | `true` para que el banco del cliente confirme cada compra (recomendado, reduce contracargos) |
| `SITE_URL` | Text | `https://annelg-art.github.io/tienda-mexiusa/` |
| `ALLOWED_ORIGINS` | Text | `https://annelg-art.github.io` |

5. Copia la dirección del Worker, por ejemplo `https://mexiusa-pagos.tu-usuario.workers.dev`. Si la abres, debe responder `{"ok":true,...}`.

## 3. Conectar la tienda

En `data.js`, llena:

```js
openpay: {
  merchantId: 'mxxxxxxxxxxxxxxxxxxx',
  publicKey: 'pk_xxxxxxxxxxxxxxxxxxxxxxxx',
  apiUrl: 'https://mexiusa-pagos.tu-usuario.workers.dev',
  sandbox: true,   // false cuando uses las llaves de producción
},
```

Súbelo con `git add -A; git commit -m "Activa pago con tarjeta"; git push`. También puedes pasarme el ID de comercio, la llave pública y la dirección del Worker, y yo lo hago. **La llave privada no me la pases.**

## 4. Probar sin dinero real

Con `sandbox: true` no se cobra nada. Usa las tarjetas de prueba de Openpay: https://documents.openpay.mx/docs/testing.html

- **Visa aprobada:** `4111 1111 1111 1111`, cualquier fecha futura, CVV `110`.
- **Mastercard aprobada:** `5555 5555 5555 4444`.
- En esa misma página hay tarjetas que simulan **rechazos**, por ejemplo fondos insuficientes o tarjeta robada, para ver los mensajes.

## ¿Dónde veo los pedidos pagados?

- En el panel de Openpay, en **Transacciones**: cada cargo aparece con el folio (`MXU-…`), el monto, los productos y el nombre, correo y teléfono del cliente.
- El dinero se deposita en la cuenta BBVA según el plazo de tu contrato con Openpay, normalmente al día hábil siguiente.
- La dirección de entrega te llega cuando el cliente toca **"Enviar copia del pedido a MEXIUSA"** en la pantalla de pago aprobado. Si no lo hace, contáctalo con el correo y el teléfono que aparecen en Openpay.

## Seguridad

- El número de tarjeta va del navegador **directo a Openpay**, que devuelve un token de un solo uso. Ni el servidor de MEXIUSA ni GitHub reciben o guardan el número. Después de pagar, la página borra el número y el CVV de la pantalla.
- El servidor **recalcula el total** con `precios.json`. Si alguien altera el precio en su navegador, el cobro se rechaza.
- El formulario solo acepta **Visa y Mastercard** y revisa que el número sea válido antes de enviarlo.
- **Después de cambiar precios, productos o tarifas**, ejecuta `node herramientas/generar-precios.mjs` antes del `git push`.

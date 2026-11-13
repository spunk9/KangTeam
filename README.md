# KANG Team · Catálogo online

Catálogo web de camisetas, chándals y equipaciones importado desde el álbum de Yupoo
[`minkang.x.yupoo.com/categories/712891`](https://minkang.x.yupoo.com/categories/712891).

Incluye catálogo filtrable por equipo, temporada, liga y tipo de prenda, personalización de
camisetas (nombre, dorsal y parches), carrito y solicitud de pedido por email o WhatsApp.

- **7.534 prendas · 508 equipos** (se actualiza solo cada 6 horas).
- Usa Nodemailer para el envío de pedidos por Gmail SMTP.
- Pensado para Node.js 14.17 o superior.

---

## Puesta en marcha

```powershell
# 1. Configuración (opcional pero recomendada)
Copy-Item .env.example .env
notepad .env

# 2. Arrancar
npm start
```

Abre <http://localhost:3000>.

Para desarrollo puede usarse `npm run dev` (es el mismo comando).

### Variables mínimas

En `.env`:

```ini
PORT=3000
STORE_NAME=KANG Team

# Número en formato internacional, solo dígitos (sin +, sin espacios).
STORE_WHATSAPP=34600000000

# Email que recibirá los pedidos y que se muestra en la web.
STORE_EMAIL=pedidos@tudominio.com
STORE_INSTAGRAM=kangteam

ADMIN_TOKEN=cambia-este-token
SYNC_INTERVAL_HOURS=6
```

Si `STORE_WHATSAPP` o `STORE_EMAIL` están vacíos, la web sigue funcionando: el cliente puede
enviar el pedido manualmente con los botones de WhatsApp/email y el botón de copiar resumen.

---

## Catálogo automático

El catálogo se guarda en `data/catalog.json` y se refresca desde Yupoo:

- Al arrancar, si el catálogo tiene más de `SYNC_INTERVAL_HOURS` horas.
- Cada `SYNC_INTERVAL_HOURS` horas mientras el servidor está encendido.

También se puede lanzar a mano:

```powershell
# Sincronización normal (omite el álbum si no hay cambios)
npm run sync

# Fuerza la descarga completa
npm run sync:force
```

O por HTTP, protegiendo el endpoint con el token:

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/api/sync `
  -Headers @{ 'x-admin-token' = 'TU_TOKEN' }
```

La sincronización recorre las 65 páginas de la categoría, excluye álbumes privados
(`加密相册`) y prendas sin portada, y reconstruye equipos, temporadas, ligas y tipos.

### Imágenes

Yupoo bloquea las imágenes sin cabecera `Referer`. Por eso todas las fotos pasan por el
proxy interno:

```
/img/minkang/<hash>/<tamaño>.jpg
```

El proxy añade el `Referer` correcto y guarda una copia en `data/cache/img` para acelerar
las siguientes visitas. Las galerías de cada prenda se consultan en `/api/album/:id` y se
cachean en memoria.

---

## Pedidos

El flujo es: carrito → datos de contacto → solicitud. **No hay pago online**; el precio,
la disponibilidad y el envío se confirman por WhatsApp o email.

Cada pedido:

1. Se guarda en `data/orders/<ID>.json` y en `data/orders/orders.jsonl`.
2. Se intenta enviar por los canales configurados.
3. Se muestra al cliente el resumen y los botones para enviarlo manualmente.

Formato del resumen (ejemplo):

```
NUEVO PEDIDO · KANG TEAM
Pedido: KT-261113-D60F
Fecha: 13/11/2026 11:41:12

── ARTÍCULO 1 ──
Camiseta: Chivas de Guadalajara 26/27 Third Away Women's Jersey S-XXL
Equipo: Chivas de Guadalajara · 26/27
Talla: L
Nombre: RODRIGUEZ
Número: 10
Parches: Sí (Liga)
Cantidad: 2

── CLIENTE ──
Nombre: Cliente de ejemplo
Teléfono: +34 600 000 000
Email: cliente@example.com
Ciudad: Madrid
Notas: …

Total artículos: 2
```

En prendas que no son camisetas, la primera línea usa el tipo real (`Chándal`, `Chaqueta`,
`Polo`, `Pantalón`, `Sudadera`…). Las camisetas mantienen la etiqueta `Camiseta`.

### Canales de notificación

Todos son opcionales. Se pueden combinar.

| Canal | Variables | Notas |
| --- | --- | --- |
| Resend | `RESEND_API_KEY`, `ORDER_FROM`, `ORDER_TO` | Recomendado para email. |
| Brevo | `BREVO_API_KEY`, `ORDER_FROM`, `ORDER_TO` | Alternativa a Resend. |
| Gmail SMTP | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ORDER_TO` | Requiere verificación en dos pasos y contraseña de aplicación. |
| Webhook | `ORDER_WEBHOOK_URL` | Zapier, Make, n8n, Discord… Recibe un JSON con el pedido. |
| CallMeBot | `CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY` | Aviso por WhatsApp; requiere activar el bot. |

`ORDER_TO` es el destinatario de los emails. Si está vacío se usa `STORE_EMAIL`.

Para Gmail, configura `GMAIL_USER` y `GMAIL_APP_PASSWORD` en `.env`. Genera la contraseña
de aplicación desde [Seguridad de la cuenta de Google](https://myaccount.google.com/apppasswords);
requiere verificación en dos pasos. No uses la contraseña habitual de Gmail ni subas `.env` al repositorio.

Si no hay ningún canal configurado, el pedido queda guardado y el cliente puede enviarlo
manualmente desde la pantalla de confirmación.

### Límites

- Máximo 40 líneas por pedido y 30 unidades por línea.
- 8 solicitudes cada 10 minutos por IP.
- Las tallas y la personalización se validan también en el servidor contra el catálogo.

---

## Personalización

Solo las **camisetas** (`type: "jersey"`) admiten personalización:

- Nombre: hasta 14 caracteres, se imprime en mayúsculas.
- Dorsal: 0–99.
- Parches: `No`, `Liga`, `Champions`, `Mundial` o `Copa`.

Chándals, chaquetas, polos y demás prendas solo requieren talla. El servidor ignora
cualquier nombre, dorsal o parche enviado para esas prendas.

---

## Estructura

```
server.js              Servidor HTTP, API, proxy de imágenes y pedidos
lib/util.js            Utilidades, .env, JSON atómico, descargas
lib/yupoo.js           Cliente de Yupoo (listado, sidebar, álbum)
lib/parse.js           Parseo de títulos: equipo, temporada, tipo, tallas
lib/teams.js           Alias de equipos, selecciones y ligas
scripts/sync.js        Generador del catálogo
public/index.html      Estructura de la SPA
public/css/styles.css  Diseño responsive
public/js/app.js       Rutas, filtros, ficha, carrito y checkout
data/catalog.json      Catálogo generado
data/orders/           Pedidos recibidos
data/cache/            Caché de imágenes y álbumes
```

### API

| Ruta | Descripción |
| --- | --- |
| `GET /api/health` | Estado y número de prendas. |
| `GET /api/config` | Datos públicos de la tienda. |
| `GET /api/catalog` | Catálogo completo (JSON). |
| `GET /api/album/:id` | Fotos de una prenda. |
| `POST /api/orders` | Crear una solicitud de pedido. |
| `POST /api/sync` | Sincronizar catálogo (`x-admin-token`). |
| `GET /img/...` | Proxy y caché de imágenes de Yupoo. |

---

## Despliegue

- Usa un proceso persistente (`pm2`, systemd, Docker…) y mantén `data/` en un volumen
  que no se borre entre despliegues.
- Sirve la app detrás de HTTPS.
- Cambia `ADMIN_TOKEN` por un valor largo y aleatorio.
- Configura al menos un canal de notificación para recibir los pedidos al instante.
- Los pedidos se guardan en disco; haz copias de seguridad de `data/orders`.
- Si cambias CSS o JS, sube el `?v=` de `public/index.html` para evitar cachés antiguas.

## Licencia

Uso privado. Las imágenes y los datos del catálogo pertenecen a sus titulares.

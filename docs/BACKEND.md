# Backend (Fase 3) — API en TypeScript

La Fase 3 se implementó en **TypeScript** (en lugar del .NET propuesto inicialmente) para compartir
código con el frontend sin duplicarlo: el servidor valida los documentos de diseño con el **mismo
esquema zod** del editor (`src/lib/editor/documentSchema.ts`), lee los **mismos manifiestos** de
modelos (`src/config/models/*.json`) y usa los **mismos presets de material** (con su `priceFactor`).
Un cambio en el contrato del documento no puede desincronizar cliente y servidor.

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| HTTP | [Hono](https://hono.dev) + `@hono/node-server` | Minimalista, tipado, `app.request()` permite probar sin abrir puertos |
| ORM | Drizzle ORM (`pg-core`) + drizzle-kit | Esquema en TS, migraciones SQL versionadas en `server/drizzle/` |
| Base de datos | PostgreSQL 16 (Docker) · **PGlite** (desarrollo y tests) | PGlite es PostgreSQL real compilado a WASM: mismas migraciones, sin servicio externo |
| Auth | `bcryptjs` + JWT HS256 (`jose`) | Sin dependencias nativas; roles `customer` / `admin` |
| Almacenamiento | S3 compatible (MinIO en el compose) o disco local | Subida directa desde el navegador con URL prefirmada + confirmación servidor |
| Validación | zod 4 | Compartida con el frontend |

Código en `server/`:

```
server/
├─ drizzle/              migraciones SQL generadas (0000_init.sql) + meta
├─ drizzle.config.ts
└─ src/
   ├─ index.ts           arranque: env → db (migra) → seed → storage → HTTP
   ├─ app.ts             createApp(deps): middlewares, rutas, manejo de errores
   ├─ env.ts             configuración tipada desde variables de entorno
   ├─ seed.ts            reglas de precio por defecto + primer admin (idempotente)
   ├─ db/schema.ts       tablas Drizzle (users, assets, designs, price_rules, quotes, orders,
   │                     order_status_history, design_presets, user_favorites, ai_provider_config)
   ├─ db/client.ts       createDb(url): postgres:// → pg · pglite://dir|memory → PGlite
   ├─ auth/tokens.ts     hash de contraseñas, firma/verificación JWT
   ├─ storage/index.ts   drivers local y S3 (presign, head, publicUrl) + sniff de cabecera de imagen
   ├─ pricing/engine.ts  computeQuote(doc, model, rules, extras) — función pura
   ├─ orders/status.ts   máquina de estados del pedido
   ├─ lib/http.ts        parseBody(zod), requireUser/requireAdmin, documentHash, helpers
   └─ routes/            auth · catalog · assets · designs · quotes · orders · presets · admin
```

## Endpoints

Todas las rutas van bajo `/api`. Autenticación: `Authorization: Bearer <jwt>`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/auth/register` · `/auth/login` | público | Devuelven `{ user, token }`. El primer usuario es admin si no hay `ADMIN_EMAIL` |
| GET | `/auth/me` | usuario | Usuario actual |
| GET | `/catalog/models` · `/materials` · `/categories` · `/extras` | público | Catálogo desde los manifiestos; extras = acabados/servicios con precio vigente |
| POST | `/assets` → PUT a `upload.url` → POST `/assets/:id/confirm` | usuario | Subida en dos pasos. Al confirmar, el servidor comprueba existencia, tamaño y (driver local) cabecera binaria |
| GET/POST | `/designs` | usuario | Lista y crea (valida con `documentSchema`, migra v1→v2) |
| GET/PUT/DELETE | `/designs/:id` | dueño | Lectura, actualización, borrado |
| POST | `/designs/:id/duplicate` · `/designs/:id/share` | dueño | Copia · activa/desactiva enlace público (`shareToken`) |
| GET | `/designs/shared/:token` | público | Documento compartido (solo si `isPublic`) |
| POST | `/quotes/preview` | público | Desglose instantáneo sin persistir (panel de precio en vivo) |
| POST | `/quotes` | opcional | Cotización formal con `expiresAt` (72 h) y `documentHash` |
| GET | `/quotes/:id` | dueño/admin | |
| GET/POST | `/orders` | usuario | Lista propia · crea desde cotización vigente (verifica hash del documento) |
| GET | `/orders/:id` | dueño/admin | Con historial de estados |
| POST | `/orders/:id/cancel` | dueño | Solo en `pending` / `in_review` |
| GET | `/presets` · `/presets/:id` | público | Presets personalizados publicados (los integrados viven en el frontend) |
| GET/PUT/DELETE | `/presets/favorites[/:id]` | usuario | Favoritos por usuario |
| GET | `/admin/stats` | admin | Conteos de usuarios, diseños y pedidos por estado |
| GET/POST/PUT/DELETE | `/admin/price-rules[/:id]` | admin | Reglas de precio |
| GET | `/admin/orders[?status=]` · `/admin/orders/:id` | admin | Pedidos con cliente y snapshot |
| POST | `/admin/orders/:id/status` | admin | Transición validada por la máquina de estados |
| GET/POST/PUT/DELETE | `/admin/presets[/:id]` · POST `/admin/presets/:id/publish` | admin | Gestión de presets; no se publica con `pendingAssets` |

Errores: `{ error: string, details? }` con 400 (JSON inválido), 401, 403, 404, 409 (conflicto de
negocio), 413, 415, 422 (validación zod), 503 (sin reglas de precio).

## Motor de cotización

`computeQuote()` es una función pura y **la única fuente de precios**. El cliente nunca envía importes;
si lo intenta, se ignoran. Reglas (`price_rules`), editables desde `/admin/pricing`:

| kind | target | Efecto |
|---|---|---|
| `base_model` | modelId | precio base del par (obligatoria; sin ella la cotización falla con 503) |
| `per_zone` | — | por cada zona de cada pie cuyo color, material o capas difieren del modelo base |
| `per_image` · `per_text` · `per_pattern` | — | por capa visible de ese tipo |
| `material_factor` | materialId | recargo = `per_zone × (factor − 1)` por zona con ese material (si no hay regla, usa el `priceFactor` del preset) |
| `complexity` | — | si la complejidad (capas, máscaras, repeticiones, curvas, zonas) supera 0.35, recargo `(factor−1) × personalización × complejidad` |
| `finish` · `service` | código | extras elegidos por el cliente al pedir |

Desglose devuelto: `basePrice`, `customization`, `extras`, `total`, `lines[]` (código, etiqueta,
cantidad, unitario, importe, grupo) y `complexity` (0..1). La cotización formal guarda el desglose y el
`sha256` del documento; al crear el pedido el servidor recalcula el hash y rechaza con 409 si el
diseño cambió o la cotización caducó. El pedido copia documento y desglose (`documentSnapshot`,
`priceSnapshot`), así cambios posteriores de precio no afectan pedidos existentes.

## Pedidos — máquina de estados

```
pending → in_review → approved → in_production → finished → delivered
   └────────┴───────────┴──→ cancelled   (el cliente solo puede cancelar en pending / in_review)
```

Cada transición escribe en `order_status_history` (de, a, quién, nota). Numeración correlativa
desde 1001.

## Almacenamiento de imágenes

1. `POST /assets` registra metadatos y devuelve destino (`PUT` prefirmado a S3 o `PUT /uploads/<key>` con el driver local).
2. El navegador sube el binario directamente.
3. `POST /assets/:id/confirm` verifica existencia y tamaño; en local también la firma binaria (PNG/JPEG/WebP/SVG). Si no coincide, se elimina.

El documento guarda en `assets[id].url` la URL pública; al abrir un diseño en otro dispositivo
`hydrateAssets()` rasteriza desde ahí. El frontend sube solo las imágenes referenciadas por alguna
capa y conserva los ids locales, por lo que las capas no cambian al sincronizar.

Con S3/MinIO las URL de subida se firman con `S3_PUBLIC_ENDPOINT` (el host que ve el navegador) y
las lecturas usan `S3_PUBLIC_BASE`; el bucket se crea con lectura pública (`minio-init`).

## Integración en el frontend

- `src/app/api/[...path]/route.ts` y `src/app/uploads/[...path]/route.ts`: proxy en runtime hacia
  `API_URL`. El navegador siempre habla con su mismo origen; en Docker el API no se expone.
- `src/lib/api/client.ts`: cliente tipado; `auth.ts` (Zustand, token en localStorage);
  `pricing.ts` (`useLivePrice`, debounce 450 ms); `sync.ts` (subida de imágenes antes de guardar).
- UI: `AccountMenu` (entrar/registro, guardar en mi cuenta, mis diseños, mis pedidos, admin),
  `PricePanel` (desglose del servidor, "Solicitar pedido"), `OrderDialog` (extras → cotización →
  envío → pedido), páginas `/orders`, `/admin/orders`, `/admin/pricing`. `?shared=<token>` abre un
  diseño compartido como copia.
- Si el API no responde, el editor sigue funcionando en local; el panel de precio muestra
  "No disponible" en lugar de inventar un número y el menú de cuenta se oculta.

## Desarrollo y pruebas

```bash
npm run api:dev          # API en :4000 con PGlite en ./data/pglite y subidas en ./data/uploads
npm run dev              # frontend en :3000 (proxy /api → http://localhost:4000)
npm test                 # 65 tests: motor de cotización + integración del API sobre PGlite en memoria
npm run db:generate      # tras cambiar server/src/db/schema.ts → nueva migración en server/drizzle
```

Variables: ver `.env.example`. En desarrollo sin `JWT_SECRET` se usa uno fijo (solo fuera de producción).

## Despliegue

`docker-compose.yml` levanta `web` (Next standalone), `api` (`Dockerfile.api`), `db` (PostgreSQL 16),
`minio` + `minio-init`. Solo `web` (3000) y `minio` (9000/9001) escuchan, y solo en `127.0.0.1`;
publícalos con un proxy inverso (p. ej. Caddy: `app.dominio` → 3000, `media.dominio` → 9000) y pon
`S3_PUBLIC_BASE=https://media.dominio/sneakerlab-uploads`, `S3_PUBLIC_ENDPOINT=https://media.dominio`,
`CORS_ORIGINS=https://app.dominio`. El API migra la base y siembra reglas/admin al arrancar.

## Pendiente / siguientes pasos

- Miniaturas de diseños guardados (captura del visor al guardar) y favoritos remotos en el Design Studio.
- Rate limiting y verificación de correo.
- Fase 4 (IA): `ai_provider_config` ya existe; falta el proveedor y la ruta `/ai/generate` que guarde
  el resultado como `Asset`.

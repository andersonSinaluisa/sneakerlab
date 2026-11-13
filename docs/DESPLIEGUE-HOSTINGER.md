# Despliegue en Hostinger (hosting compartido, plan Premium)

El hosting compartido solo ejecuta PHP + MySQL detrás de Apache/LiteSpeed. Por eso Hecho a Pie se
publica como:

| Pieza | Tecnología | Dónde vive en el servidor |
|---|---|---|
| Frontend (editor 3D, pedidos, admin) | React + Vite, archivos estáticos | `public_html/` |
| API (`/api/*`, `/uploads/*`) | PHP 8.2 + Slim 4 | `sneakerlab-api/` **junto a** `public_html`, no dentro |
| Base de datos | MySQL/MariaDB de hPanel | — |
| Imágenes subidas | disco | `sneakerlab-api/storage/uploads/` |

`public_html/.htaccess` envía `/api/*` y `/uploads/*` a `public_html/api/index.php`, que solo carga
`../../sneakerlab-api/public/index.php`. El resto de rutas (`/orders`, `/admin/...`) caen en
`index.html` (SPA). Así el código, `vendor/`, `.env` y las subidas nunca son accesibles por URL.

## 1. Preparar en hPanel (una sola vez)

1. **PHP**: *Avanzado → Configuración PHP* → versión **8.2** o superior. En *Opciones PHP*, sube
   `upload_max_filesize` y `post_max_size` a **20M** como mínimo. Las extensiones `pdo_mysql`, `json`
   y `mbstring` vienen activas por defecto.
2. **Base de datos**: *Bases de datos → Bases de datos MySQL* → crea la base y el usuario. Apunta
   nombre, usuario y contraseña (tienen la forma `u123456789_sneakerlab`).
3. **SSH**: *Avanzado → Acceso SSH* → actívalo. Se usa para ejecutar las migraciones.
4. **SSL**: *Seguridad → SSL* → actívalo. El `.htaccess` fuerza HTTPS.

## 2. Construir el paquete (en tu equipo)

```bash
npm install
echo "SITE_URL=https://tu-dominio.com" > .env.production   # una sola vez, para el SEO
npm run build:hostinger
```

`SITE_URL` es el dominio público, sin barra final. El build lo usa para la URL canónica, la imagen
al compartir en redes (`og.jpg`) y `sitemap.xml`. Sin él, la web funciona igual, pero esas
etiquetas no llevan el dominio completo.

**SEO.** `/` se prerenderiza en `index.html`: Google y las redes reciben el contenido de la
landing, su título y descripción, y los datos estructurados de la organización, el sitio y las
preguntas frecuentes. El resto de rutas (editor, pedidos, admin) usan `app.html`, que lleva
`noindex`. Se generan también `robots.txt` y `sitemap.xml`. Tras publicar, da de alta el dominio
en Google Search Console y envía `https://tu-dominio.com/sitemap.xml`.

Genera `deploy/sneakerlab-hostinger.zip` con dos carpetas: `public_html/` y `sneakerlab-api/`.
Las dependencias PHP se instalan con Docker (`composer:2`), así que no necesitas PHP local.

## 3. Subir

Con el *Administrador de archivos* de hPanel (o por SFTP), dentro de `domains/<tu-dominio>/`:

```
domains/<tu-dominio>/
├── public_html/       ← contenido de deploy/public_html (sustituye el index por defecto)
└── sneakerlab-api/    ← deploy/sneakerlab-api
```

Lo más rápido es subir el zip a `domains/<tu-dominio>/` y usar **Extraer**. Borra antes el
`default.php` o `index.php` que Hostinger crea en `public_html`.

> Si tu dominio usa otra estructura, ajusta la ruta en `public_html/api/index.php`.

## 4. Configurar y migrar (por SSH)

```bash
cd ~/domains/<tu-dominio>/sneakerlab-api
cp .env.example .env
nano .env        # DB_*, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"   # valor para JWT_SECRET
php bin/migrate.php
chmod 750 storage storage/uploads
```

`bin/migrate.php` crea las tablas, carga las reglas de precio iniciales y el admin. Puedes
ejecutarlo de nuevo sin riesgo: solo aplica lo que falte.

Comprueba que el API responde en `https://<tu-dominio>/api/health` → `{"ok":true,...}`.

## 5. Actualizar una versión

1. `npm run build:hostinger`.
2. Sustituye `public_html/` completo y, en `sneakerlab-api/`, las carpetas `src/`, `vendor/`,
   `contracts/`, `migrations/`, `bin/` y `public/`. **No toques `.env` ni `storage/`.**
3. Por SSH: `php bin/migrate.php`.

## Desarrollo local con la misma forma

```bash
npm run hosting:up   # build + PHP/Apache + MySQL en Docker → http://localhost:8080
npm run dev          # Vite en :3000 con proxy de /api y /uploads a :8080
npm run test:api     # API y BD efímeros: paridad del motor de precios + pruebas de contrato HTTP
npm run hosting:down
```

Admin local: `admin@sneakerlab.local` / `admin-pass-123`.

## Contratos frontend ↔ API

El API PHP valida los documentos de diseño y los presets con los mismos esquemas zod del frontend,
exportados a JSON Schema en `api/contracts/`. También exporta el catálogo de modelos y materiales
que usa el motor de precios. Tras cambiar `documentSchema`, `designPresetSchema`, los manifiestos de
`src/config/models/` o los materiales:

```bash
npm run api:contracts
```

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `/orders` da 404 al recargar | Falta `.htaccess` en `public_html` (está oculto: activa "mostrar archivos ocultos") |
| `/api/health` da 500 | `vendor/` sin subir, `.env` sin `JWT_SECRET` o con datos de BD mal; revisa `error_log` en `sneakerlab-api/public` o en hPanel |
| Sesión válida pero 401 | El servidor no pasa `Authorization`. El `.htaccess` ya lo reenvía; comprueba que se subió |
| El modelo 3D no carga | Faltan los tipos MIME `.glb` / `.wasm` del `.htaccess` |
| Subida de imagen 413 | Sube `upload_max_filesize` y `post_max_size`, y `MAX_UPLOAD_BYTES` en `.env` |

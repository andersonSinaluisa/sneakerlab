# Hecho a Pie — zapatillas personalizadas en 3D

> Nombre comercial: **Hecho a Pie**. Internamente (paquete, namespace PHP `SneakerLab`, carpetas y
> claves de almacenamiento) se conserva el nombre técnico `sneakerlab` para no romper datos guardados.

Personalizador profesional de zapatillas en 3D. Este repositorio contiene las **Fases 1–3**: editor 3D
(zonas, colores, materiales, imágenes proyectadas por UV, textos, patrones), Design Studio y backend
de cuentas, cotización y pedidos.

> Modelo por defecto: **Court Low** (`court-low-01`), zapatilla baja realista preparada desde un GLB
> con `npm run model:prepare` (12 zonas, ambos pies, meshopt). Verificar la licencia del asset antes
> de uso comercial. Detalles y pipeline en [`docs/MODELOS-3D.md`](docs/MODELOS-3D.md).

## Requisitos

- Node.js 20.19+ (probado con 22) y npm para el frontend (React + Vite)
- Docker para el API PHP en local (PHP 8.2 + MySQL 8); no hace falta PHP instalado
- Navegador con WebGL 2 (Chrome, Edge, Firefox, Safari 15+)

## Puesta en marcha

```bash
npm install
npm run api:install  # dependencias PHP (Composer en Docker)
npm run hosting:up   # API PHP + MySQL en http://localhost:8080 (misma forma que Hostinger)
npm run dev          # http://localhost:3000 (Vite; proxy de /api y /uploads a :8080)
```

Producción (hosting compartido): `npm run build:hostinger` y ver
[`docs/DESPLIEGUE-HOSTINGER.md`](docs/DESPLIEGUE-HOSTINGER.md).

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | servidor de desarrollo (Vite) |
| `npm run build` / `npm run preview` | compila a `dist/` / sirve el build en :3100 |
| `npm run build:hostinger` | paquete listo para subir a Hostinger (`deploy/`) |
| `npm test` | pruebas unitarias del frontend (Vitest) |
| `npm run test:api` | API PHP + MySQL efímeros en Docker: paridad del motor de precios y contrato HTTP |
| `npm run typecheck` | TypeScript estricto |
| `npm run lint` | ESLint |
| `npm run model:prepare` | prepara `public/models/court-low-01.glb` desde `assets/src/` (zonas, UVs, espejo, meshopt) |
| `npm run model:prepare:classic` | prepara `public/models/court-classic-01.glb` desde `assets/src/air_force1.glb` (sin logotipos) |
| `npm run model:inspect -- <glb>` | inspecciona un GLB: nodos, mallas, materiales, UVs, bbox |
| `npm run model:generate` | regenera `public/models/sneaker-low-01.glb` (modelo provisional) |
| `npm run decoders:copy` | copia los decoders Draco/KTX2 de three a `public/decoders` |
| `npm run api:install` | instala las dependencias PHP de `api/` (Composer en Docker) |
| `npm run hosting:up` / `hosting:down` | réplica local del hosting: Apache + PHP 8.2 + MySQL 8 en :8080 |
| `npm run api:contracts` | exporta esquemas y catálogo del frontend a `api/contracts/` |

## Qué incluye la Fase 1

- **Editor en tres zonas**: herramientas (izquierda), visor 3D (centro), propiedades (derecha).
  En móvil: barra inferior de herramientas y paneles desplegables que reducen el visor.
- **Visor 3D**: GLB con materiales PBR, iluminación de estudio, sombras de contacto, cámara orbital
  con vistas predefinidas (exterior, interior, superior, posterior, frontal, ambos zapatos),
  restaurar cámara, ocultar controles y tres fondos.
- **Zonas por metadatos**: laterales exterior/interior, punta, talón, lengüeta, cordones,
  entresuela y suela, cada una con sus operaciones permitidas.
- **Imágenes**: PNG/JPG/WebP validadas (tipo, firma binaria, ≤15 MB, dimensiones), reducidas a
  2048 px, guardadas en IndexedDB. Se aplican a la zona seleccionada o **arrastrándolas al zapato**
  (desde la biblioteca o desde el sistema de archivos).
- **Posicionamiento sobre la superficie**: arrastrar la imagen directamente sobre el modelo
  3D; editor 2D de la zona con manijas para mover, escalar y rotar; sliders de posición, escala,
  rotación y opacidad; volteo; orden de capas; duplicar; copiar al otro zapato; eliminar.
- **Ambos zapatos independientes**, con opción de sincronizar colores.
- **Undo/Redo** (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) agrupando gestos continuos.
- **Guardado local** automático + botón Guardar (Ctrl+S); el borrador se restaura al volver.
- **Exportar PNG** de la vista actual.

Atajos: `Supr` elimina la capa, `Ctrl+D` duplica, flechas mueven (Shift = paso grande), `Esc`
deselecciona, `Alt` + rueda escala la capa seleccionada sobre el lienzo 2D.

## Editor avanzado (Fase 2)

- **Textos**: 6 fuentes, peso, cursiva, relleno, contorno, espaciado y **curvatura** (texto en arco),
  proyectados sobre la superficie como cualquier capa.
- **Patrones** procedurales (rayas, diagonal, lunares, damero, chevron, estrellas, cuadrícula,
  escamas) con dos colores y escala; se colocan debajo de imágenes y textos.
- **Máscaras** (círculo, redondeada, rombo, hexágono, estrella), **recorte** de imagen, **repetición**
  (n copias, separación, dirección) y **simetría** (copia espejada) para cualquier capa.
- **Exportar vistas**: captura las vistas que elijas con el motor real y descarga una hoja de producto
  o las imágenes sueltas (botón junto a Exportar PNG).

## Realismo visual y modelos profesionales

- Materiales físicos por zona (cuero, gamuza, lona, malla, caucho, EVA, cordón, metal) con mapas de
  detalle, iluminación de estudio con ACES, AO y sombras suaves, tiers de calidad automáticos y
  cámaras calculadas desde el bounding box (incluida perspectiva 3/4).
- El asset profesional entra por el pipeline de Blender (`tools/blender/`) y un manifiesto JSON:
  ver [`docs/MODELOS-3D.md`](docs/MODELOS-3D.md). Resumen de la refactorización en
  [`docs/REFACTOR-MOTOR-3D.md`](docs/REFACTOR-MOTOR-3D.md).

## Design Studio (diseños predefinidos)

Catálogo de 31 diseños originales (anime/manga, cultura japonesa, urbanos) que se aplican al modelo
3D con un clic y quedan editables. Favoritos, filtros por estilo y color, detalle con renders reales,
«Personalizar» y «Combinar» (un diseño distinto en cada pie). Administración en `/admin/designs`
(activar modo admin con `/?admin=1`): guardar el diseño actual como plantilla, publicar, duplicar,
exportar. Documentación: [`docs/DESIGN-STUDIO.md`](docs/DESIGN-STUDIO.md).

| Script | Descripción |
|---|---|
| `npm run designs:assets` | regenera las ilustraciones SVG originales |
| `npm run designs:render` | renderiza miniaturas y vistas previas con el modelo real (requiere `npm run preview` y Chrome) |

## Backend: cuentas, cotización y pedidos (Fase 3)

API en PHP 8.2 (Slim 4 + MySQL) dentro de `api/`, pensada para hosting compartido. Valida con
los mismos esquemas del editor (documento, presets), exportados a JSON Schema en `api/contracts/`
junto con los manifiestos de modelos y los materiales.

```bash
npm run hosting:up   # API en http://localhost:8080
npm run dev          # el frontend proxya /api al API
```

- Menú de cuenta: registro/inicio de sesión, **Guardar en mi cuenta**, **Mis diseños** (abrir,
  duplicar, enlace público `?shared=…`, eliminar), **Mis pedidos**.
- **Precio estimado** en vivo (abajo a la derecha del visor) con desglose calculado por el servidor y
  botón **Solicitar pedido**: extras → cotización formal (72 h) → datos de envío → pedido numerado.
- Administración (`/admin/orders`, `/admin/pricing`): estados de pedidos con historial y reglas de
  precio editables; `/admin/designs` gestiona las plantillas.
- Detalle en [`docs/BACKEND.md`](docs/BACKEND.md).

## Despliegue (Hostinger u otro hosting compartido)

```bash
npm run build:hostinger   # deploy/public_html + deploy/sneakerlab-api (+ zip)
```

`public_html/` lleva la SPA, el `.htaccess` (rutas de la SPA, `/api` y `/uploads` → PHP, MIME de
`.glb`/`.wasm`, HTTPS) y un `api/index.php` mínimo. El código PHP, `vendor/`, `.env` y las subidas
viven en `sneakerlab-api/`, fuera del docroot. Paso a paso en
[`docs/DESPLIEGUE-HOSTINGER.md`](docs/DESPLIEGUE-HOSTINGER.md).

## Arquitectura

Ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): módulos, decisiones técnicas (proyección UV con
`CanvasTexture`, metadatos de zonas, documento serializable, historial), backend y roadmap.

## Notas

- Los componentes de UI siguen el patrón de shadcn/ui (Radix + `class-variance-authority`) escritos
  en `src/components/ui/`, listos para convivir con `npx shadcn add` cuando se necesiten más.
- Sube solo ilustraciones propias o con licencia: la aplicación no incluye personajes protegidos.
- Los precios los calcula siempre el servidor con reglas editables; el cliente nunca envía importes.

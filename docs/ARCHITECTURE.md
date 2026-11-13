# Hecho a Pie (SneakerLab 3D) — Arquitectura

Documento vivo. Describe la arquitectura objetivo de las 5 fases y qué está implementado (Fases 1–3 + Design Studio).

## 1. Visión general

```
┌──────────────────────────── Frontend (Next.js 16 · App Router) ────────────────────────────┐
│                                                                                            │
│  UI (React + Tailwind + componentes estilo shadcn/ui + Motion)                             │
│   ├─ EditorShell ── ToolRail / ToolPanel · Viewer · PropertiesPanel · barra móvil          │
│   └─ ZoneEditor2D (Konva)  ← edición 2D de la composición de cada zona                     │
│                                                                                            │
│  Estado (Zustand)                                                                          │
│   ├─ store.ts        acciones del editor + estado de UI                                    │
│   ├─ history.ts      Undo/Redo por instantáneas inmutables (immer)                         │
│   └─ document.ts     operaciones puras sobre DesignDocument                                │
│                                                                                            │
│  Motor 3D (React Three Fiber + Drei + Three.js)                                            │
│   ├─ Viewer / SneakerModel / CameraRig / PickBridge / LayerDragController                  │
│   └─ ZoneMaterial → ZoneSurface (material PBR + CanvasTexture)                             │
│                                                                                            │
│  Motor de texturas (sin React ni Three)                                                    │
│   ├─ compositor.ts   color base + capas + costuras → lienzo 2D por zona (recorte a isla UV)│
│   └─ layerMath.ts    cajas, hit-testing en espacio UV, tamaños iniciales                   │
│                                                                                            │
│  Materiales y render                                                                       │
│   ├─ materials/presets.ts, detailMaps.ts   presets PBR + normal/roughness procedurales     │
│   ├─ render/framing.ts   cámaras por bounding box (perspectiva exacta)                     │
│   ├─ render/quality.ts   tiers low/medium/high por dispositivo                             │
│   └─ viewer/Studio.tsx   ACES, HDRI/estudio, sombras suaves, N8AO, SMAA                    │
│                                                                                            │
│  Gestión de modelos                                                                        │
│   ├─ schema.ts       contrato de metadatos (zod)                                           │
│   ├─ registry.ts     catálogo (manifiestos JSON; el API los expone en /catalog)               │
│   └─ bindZones.ts    único punto que conoce nombres de meshes                              │
│                                                                                            │
│  Recursos y persistencia                                                                   │
│   ├─ assets/validation.ts  tipo, firma binaria, tamaño, dimensiones, nombre                │
│   ├─ assets/assetStore.ts  AssetRepository (IndexedDB; `url` remota tras sincronizar) + caché │
│   └─ editor/persistence.ts borrador local (IndexedDB) · lib/api/* cuenta, nube, precio       │
└────────────────────────────────────────────────────────────────────────────────────────────┘
                     │  /api (proxy Next en runtime) · JWT Bearer
┌────────────────────┴──────── Backend (Hono + Drizzle · TypeScript · Fase 3) ───────────────┐
│  auth · catalog · assets(S3/local) · designs · quotes(motor de precio) · orders · presets  │
│  admin · PostgreSQL 16 (PGlite en dev/tests) · MinIO · Docker — ver docs/BACKEND.md       │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Decisiones técnicas clave

### 2.1 Imágenes proyectadas por UV, no planos flotantes
Cada zona personalizable tiene su propio **lienzo 2D** (`HTMLCanvasElement`) del tamaño declarado en
metadatos. El compositor dibuja el color base y las capas; el lienzo se usa como `CanvasTexture` del
material de esa zona. Así la imagen **se adhiere a la superficie** (sigue la curvatura, recibe la
iluminación y las sombras del material PBR).

- Las coordenadas de una capa (`x`, `y`, `width`, `rotation`) están en **espacio de textura
  normalizado** (0..1, origen arriba-izquierda), que coincide con las UV glTF del mesh. Por eso
  `flipY = false` en la textura.
- El raycast de R3F devuelve `uv` en el punto tocado → colocar o arrastrar una imagen sobre el zapato
  es convertir ese `uv` directamente en coordenadas de la capa (`LayerDragController`).
- El tamaño de cada lienzo respeta la **proporción física** del panel (medida por el generador),
  para que las imágenes no se deformen.
- El editor 2D (Konva) muestra exactamente el mismo espacio de coordenadas con manijas de
  mover/escalar/rotar; ambos editores modifican la misma capa.

### 2.2 Metadatos, no nombres de mesh en React
`src/config/models/*.json` declara zonas, meshes por zapato (`meshNames.right/left`), operaciones
permitidas (`allowImages`, `allowText`, `allowColors`, `allowMaterials`), tamaño de textura,
rugosidad y si necesita forro interior. Se valida con zod al cargar. `bindZones()` es el único
código que resuelve nombres de mesh; los componentes trabajan con `zoneId`.

### 2.3 Documento de diseño serializable
`DesignDocument` (ver `src/lib/editor/types.ts`) es la fuente de verdad: colores por zona y zapato,
capas, referencias de recursos y `schemaVersion`. Es lo que guarda el historial, lo que se persiste y
lo que viajará al backend. Los binarios de imagen **no** están en el documento: se referencian por
`assetId` y viven en un `AssetRepository`.

### 2.4 Undo/Redo
Historial de instantáneas inmutables (immer comparte estructura → bajo costo de memoria, límite 100).
Los gestos continuos (arrastrar en 3D, sliders, transformaciones en Konva, selector de color) usan
`beginGesture/endGesture` para generar **una sola** entrada.

### 2.5 Ambos zapatos independientes
El GLB contiene dos nodos (`Right`, `Left`). Cada zapato tiene su propio estado de colores y sus
propias capas. "Aplicar a ambos" sincroniza colores; "Copiar al zapato izquierdo/derecho" duplica una
capa con las mismas coordenadas (las UV de ambos zapatos están orientadas para leerse sin espejo
desde fuera).

### 2.6 Sin datos comerciales ficticios
Los precios salen exclusivamente del motor de cotización del servidor (`server/src/pricing/engine.ts`)
con reglas editables por administración; el cliente solo muestra el desglose que recibe y, si el API
no responde, indica "No disponible". Las herramientas de fases futuras aparecen deshabilitadas e
identificadas con su fase; la IA no simula generación.

## 3. Modelo de datos (cliente, esquema v2)

```ts
DesignDocument {
  schemaVersion: 2; id; name; modelId;
  shoes: { right: { zones: { [zoneId]: { color, material? } } }, left: {...} };
  layers: Layer[];                 // orden = orden de pintado dentro de cada zona
  assets: { [assetId]: AssetRef }; // metadatos; binario en AssetRepository o `url` de biblioteca
  createdAt; updatedAt;
}
LayerBase  { id; name; shoe; zoneId; x; y; width; rotation; opacity; flipX; visible;
             mask?: none|circle|rounded|diamond|star|hexagon;
             repeat?: { count; gap; direction }; mirror?: boolean }
ImageLayer   = LayerBase & { kind: "image"; assetId; crop?: { x; y; w; h } }
TextLayer    = LayerBase & { kind: "text"; text; font; weight; italic; size; letterSpacing;
                             fill; stroke?; strokeWidth; curve; align }
PatternLayer = LayerBase & { kind: "pattern"; pattern; colorA; colorB; scale; height }
```

`parseDocument` migra borradores v1 (solo imágenes) a v2. El compositor dibuja los tres tipos con
máscara, recorte, repetición y simetría en el mismo lienzo UV; el editor 2D renderiza cada capa con
ese mismo compositor (un sprite por capa) y Konva solo aporta la interacción.

## 4. Estructura de carpetas

```
src/
  app/                    layout, página (el editor se carga solo en cliente)
  components/
    editor/               shell, paneles, propiedades, editor 2D, atajos, autosave
    viewer/               Canvas R3F, modelo, cámara, raycast, arrastre de capas
    ui/                   componentes base (patrón shadcn/ui sobre Radix)
  config/models/          metadatos de modelos (JSON)
  lib/
    model/                schema, registro, bindZones, loader (Draco/KTX2/meshopt), generador provisional
    materials/            presets PBR y mapas de detalle procedurales
    render/               encuadre por bbox y tiers de calidad
    textures/             compositor, matemática de capas, ZoneSurface
    editor/               tipos, documento, esquema zod compartido, historial, store, persistencia
    api/                  cliente HTTP, sesión (JWT), precio en vivo, sincronización de imágenes
    assets/               validación, repositorio y caché de imágenes
scripts/                  generación del GLB provisional
tools/blender/            pipeline Python de preparación de assets (inspección, validación, export)
tests/                    pruebas de integración (GLB ↔ metadatos)
server/                   API Hono + Drizzle (ver docs/BACKEND.md) y migraciones SQL
docs/                     esta documentación
```

## 5. Backend (Fase 3) — implementado en TypeScript

Se descartó la solución .NET propuesta en favor de **Hono + Drizzle + PostgreSQL** en el mismo
repositorio, para compartir con el frontend el esquema zod del documento, los manifiestos de modelos
y los presets de material (`priceFactor`). Detalle completo de entidades, endpoints, motor de
cotización, máquina de estados, almacenamiento y despliegue en [`docs/BACKEND.md`](BACKEND.md).

Resumen:

- **Entidades:** `users`, `assets`, `designs` (documento `jsonb` validado), `price_rules`, `quotes`
  (desglose + `documentHash` + vigencia), `orders` (+ `order_status_history`, snapshots inmutables),
  `design_presets`, `user_favorites`, `ai_provider_config` (Fase 4).
- **Cotización:** `computeQuote(doc, model, rules, extras)` — función pura y testeada; devuelve
  base / personalización / extras / total y líneas. El pedido exige una cotización vigente cuyo hash
  coincida con el documento enviado.
- **Pedidos:** `pending → in_review → approved → in_production → finished → delivered`, con
  `cancelled` posible hasta producción; cada transición queda en el historial.
- **Imágenes:** subida en dos pasos (registro → PUT directo → confirmación con verificación).
- **Pruebas:** integración completa del API sobre PGlite en memoria (`server/src/app.test.ts`).

**IA (Fase 4):** la tabla `ai_provider_config` referencia la clave por nombre de variable de entorno;
la ruta de generación guardará el resultado como `Asset`, de modo que el editor lo trate como
cualquier imagen. Sin proveedor configurado, la herramienta sigue deshabilitada.

## 6. Roadmap

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Layout, carga GLB, cámara y vistas, selección de zonas, colores, subida y proyección de imágenes, arrastre sobre superficie, editor 2D, capas básicas, guardado local, Undo/Redo, exportación PNG | **Implementada** |
| 2 | Textos (6 fuentes, peso, cursiva, contorno, espaciado, curvatura), patrones procedurales (8), materiales PBR, máscaras (5 formas), recorte, repetición y simetría, exportación de vistas múltiples (hoja de producto) | **Implementada** |
| 3 | Backend TypeScript (Hono + Drizzle + PostgreSQL), cuentas y JWT, diseños en la nube con imágenes en S3/MinIO, enlaces públicos, catálogo, motor de cotización con reglas editables, cotizaciones con vigencia, pedidos con máquina de estados, panel de precio en vivo, páginas de pedidos y administración, Docker compose completo | **Implementada** |
| 4 | Generación de diseños con IA y preparación de imágenes | Pendiente |
| 5 | Rendimiento móvil, KTX2, carga diferida, E2E automatizados, rate limiting, miniaturas remotas | Pendiente |

# Design Studio — diseños predefinidos

Módulo de SneakerLab 3D para elegir un diseño profesional y aplicarlo al zapato con un clic,
conservándolo editable. Fecha: 2026-11-09.

## 1. Auditoría del editor (Fase 1)

| Área | Estado encontrado | Consecuencia para los presets |
|---|---|---|
| Documento (`DesignDocument`) | Colores y material por zona y zapato; capas **solo de imagen** en espacio UV normalizado; recursos por `assetId` | Un preset es exactamente ese documento en forma declarativa. Al auditar no existían textos ni patrones (se implementaron después en la Fase 2); los presets integrados usan capas de imagen y la tipografía (kanji) va como ilustración vectorial. Pendiente: exportar capas de texto/patrón a plantillas (`presetFromDocument` las reporta en `pendingAssets`) |
| Recursos | Subidos por el usuario y guardados en IndexedDB | Se añadió `AssetRef.url` para recursos de biblioteca (SVG/PNG/WebP públicos) que se rasterizan al cargar y **no** se duplican en IndexedDB |
| Aplicación de imágenes | `CanvasTexture` por zona, UV reales del GLB, máscara de isla, costuras | Los presets se proyectan igual: siguen las curvas del modelo; no hay planos flotantes |
| Modelos | `court-low-01` (profesional, 12 zonas: 5 con impresión) y `sneaker-low-01` (provisional) | `compatibleModels` + comprobación de zonas; si el modelo activo no es compatible se cambia al primero compatible |
| Historial / guardado | Undo/redo por instantáneas; autosave IndexedDB | Aplicar un preset es **una entrada del historial**: Ctrl+Z devuelve el diseño anterior; el borrador se guarda igual |
| Cámara | Vistas por bounding box, incluida 3/4 | Al aplicar se muestra la 3/4 |
| UI | Riel de herramientas + panel + propiedades; móvil con barra inferior | Nueva herramienta «Diseños» (panel compacto) y catálogo a pantalla completa como overlay |

## 2. Esquema (`src/lib/designs/schema.ts`)

```ts
SneakerDesignPreset {
  id, name, category (30 categorías cerradas), tags[], description?,
  thumbnailUrl?, previewImages[],           // renders del modelo real (hero, outer, inner, back, both)
  compatibleModels[], colorPalette[],
  zones: DesignZone[]   { zoneId, shoe?, color?, material? }        // ambos pies si shoe se omite
  layers: DesignLayer[] { id, assetId, shoe: right|left|both, zoneId, x, y, width, rotation,
                          opacity, flipX, mirrorOnLeft }              // coordenadas UV del editor
  assets: DesignAsset[] { id, name, type: svg|png|webp, url, rasterSize, license, author }
  status: published | draft | pending-assets, pendingAssets[], badge?: new|popular,
  version, createdAt, updatedAt, source: builtin|custom
}
```

Máscaras: las define la zona del modelo (`uvIsland`, recorte del compositor), no el preset, para que
una composición respete siempre paneles y costuras del modelo al que se aplica.

## 3. Aplicación en 3D (`src/lib/designs/apply.ts`, `store.ts`)

1. `checkCompatibility` (modelo, zonas, permisos, recursos declarados).
2. Carga de ilustraciones (`ensureUrlAsset`, una sola vez por id, caché en memoria).
3–5. `applyPresetToDocument` → colores, materiales y capas con posición/escala/rotación guardadas;
   `mirrorOnLeft` voltea la ilustración en el pie izquierdo para composiciones simétricas.
6. Las texturas se recomponen solas (reactividad de `ZoneMaterial`).
7. Vista 3/4. 8. El catálogo se cierra y se sigue editando. El preset original nunca se muta.

Modos: **Aplicar** (reemplaza las capas), **Personalizar** (copia con nombre «· mi versión»),
**Combinar** (solo un pie, conserva el otro → diseños distintos por zapato).

## 4. Catálogo (`src/components/designs/`)

Overlay con grid de tarjetas (render, nombre, categoría, paleta, etiqueta Nuevo/Popular), búsqueda,
filtros por estilo/categoría/familia de color (clasificación HSL de la paleta), orden, favoritos
(IndexedDB), detalle con 5 vistas renderizadas del modelo real, «Aplicar diseño», «Personalizar»,
«Previsualizar en 3D» y «Combinar…». Miniaturas con `loading="lazy"`.

## 5. Recursos gráficos

`tools/designs/build-assets.py` genera **55 ilustraciones vectoriales originales** (SVG seguro:
sin fuentes externas, scripts ni referencias remotas) en `public/designs/assets/`: máscaras oni,
dragones, sakura, olas, caligrafía trazada (力, 心, ensō), ojos anime, rōnin, líneas de velocidad,
tramas, viñetas, explosiones cómic, chibi neko, mecha, casco neón, auras, rayos, cortes, graffiti,
gótico, geometría, píxel art, retro 90s y streetwear, con variantes de color.

**Sin proveedor de IA configurado** no se generan ilustraciones por prompt (la interfaz lo indica en
la herramienta IA). Los 31 presets usan únicamente estos recursos y están **publicados** porque sus
ilustraciones existen; su nivel artístico es vector plano (no pintura digital de personajes).
Mejora pendiente: sustituir, cuando haya proveedor o ilustrador, las piezas de personaje
(Celestial Fighter, Shadow Ronin, Sakura Blade, Neon Warrior) por ilustraciones detalladas; el
preset no cambia, solo el `url` del recurso.

## 6. Renders (`tools/designs/render-thumbs.mjs`)

`npm run designs:render` abre `/studio/render` en Chrome headless, aplica cada preset al modelo
real con el mismo motor del editor (materiales, iluminación, UV) y guarda
`public/designs/thumbs/<id>/{hero,outer,inner,back,both}.jpg`. Ninguna miniatura es una imagen
generada ajena al resultado del editor.

## 7. Administración (`/admin/designs`)

Modo admin: `/?admin=1` (se recuerda en localStorage; en Fase 3 lo da el rol del JWT).
- En el editor: **Guardar como plantilla** → preset `custom` en borrador con miniatura capturada del
  visor (nombre, categoría, etiquetas, descripción).
- En `/admin/designs`: listar integrados y propios, publicar/despublicar, duplicar, exportar/importar
  JSON, eliminar, abrir en el editor, vista de categorías con conteo.
- Los integrados viven en `src/lib/designs/catalog.ts`; un JSON exportado se añade ahí para
  promoverlo a integrado.

## 8. Persistencia (entidades para el backend, Fase 3)

| Entidad | Campos clave | Hoy |
|---|---|---|
| DesignCategory | id, label, group, order, active | constante en código |
| DesignAsset | id, type, storageKey/url, width, height, license, author, checksum | `assets.ts` + archivos públicos |
| DesignPreset | id, name, categoryId, tags, description, compatibleModels, palette, status, badge, version, authorId, publishedAt | `catalog.ts` (builtin) + IndexedDB (custom) |
| DesignZone | presetId, zoneId, shoe?, color?, material? | embebido en preset (jsonb) |
| DesignLayer | presetId, zoneId, shoe, assetId, x, y, width, rotation, opacity, flipX, mirrorOnLeft, order | embebido en preset (jsonb) |
| DesignVariant | id, presetId, userId, documentId (DesignDocument del usuario), name | = documento del usuario con `name` «· mi versión» |
| UserFavorite | userId, presetId, createdAt | IndexedDB |

Endpoints previstos: `GET /api/designs?category&color&q&sort`, `GET /api/designs/{id}`,
`POST /api/designs/{id}/favorite`, `POST /api/admin/designs` (desde un DesignDocument),
`PATCH /api/admin/designs/{id}` (publicar/despublicar), `POST /api/admin/designs/{id}/duplicate`,
`POST /api/admin/assets` (subida de ilustraciones), `POST /api/admin/designs/{id}/render`
(miniaturas en un worker con el mismo arnés).

## 9. Rendimiento

Miniaturas lazy; ilustraciones rasterizadas una vez y compartidas entre zapatos y presets
(`ensureUrlAsset`); `ZoneSurface` reutiliza materiales por zona y libera texturas al desmontar;
los lienzos conservan su tamaño (no se recrean al aplicar); aplicar un preset es una única
actualización del estado.

## 10. Estado por fases

| Fase | Estado |
|---|---|
| 1 Auditoría y esquema | Hecha |
| 2 Biblioteca visual, filtros, vistas previas | Hecha |
| 3 Aplicación real al 3D | Hecha (aplicar / personalizar / combinar, Ctrl+Z) |
| 4 Editor administrativo | Hecha (local; API en Fase 3 del producto) |
| 5 Recursos originales y 30 diseños | 31 presets publicados con 55 ilustraciones vectoriales; ilustraciones de personaje detalladas pendientes de proveedor |
| 6 Favoritos, variantes, optimización | Favoritos y variantes hechos; optimizaciones básicas; pendiente: caché HTTP de miniaturas y texturas KTX2 (Fase 5 del producto) |

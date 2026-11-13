# Refactorización del motor 3D y realismo visual — cambios realizados

Complementa `AUDITORIA-MOTOR-3D.md` (estado anterior) y `MODELOS-3D.md` (asset y pipeline).

## Fase 1 · Auditoría
`docs/AUDITORIA-MOTOR-3D.md`. Conclusión: la separación GLB ↔ metadatos ↔ editor ya era correcta;
los problemas estaban en la geometría provisional, materiales planos, cámaras fijas y ausencia de
mapas de detalle, AO y tiers de calidad.

## Fase 2 · Infraestructura GLB y pipeline Blender
- `src/lib/model/loader.ts`: `useModelGltf(cfg)` activa Draco, meshopt y KTX2 según
  `source.compression`; `preloadModel` para precarga; `usePurgeModelOnUnmount` libera la caché.
  Decoders en `public/decoders` (`npm run decoders:copy`).
- Manifiesto (`schema.ts`) ampliado: `source.compression`, `unitScale`, `environment` (HDRI),
  `layout.bothShoesGap/focusHeight` (derivados del bbox), y por zona `material`, `materialOptions`,
  `detailRepeat`, `uvIsland`, `stitchInset`.
- `tools/blender/sneakerlab_pipeline.py` + `inspect_model.py` + `mapping.example.json`:
  importación, inspección, validación de normales/UVs, detección y renombrado de paneles,
  materiales PBR, optimización, exportación GLB y manifiesto, informe JSON. No destructivo.
- Modelo provisional: se añadieron ojales (`R_Eyelets`/`L_Eyelets`). Sigue marcado como provisional.

## Fase 3 · Materiales e iluminación
- `src/lib/materials/presets.ts`: 8 presets físicos (cuero sintético, gamuza, lona, malla, caucho,
  EVA, cordón, metal) con rugosidad, sheen, clearcoat, intensidad especular y factor de precio.
- `src/lib/materials/detailMaps.ts`: normal + roughness **procedurales y tileables** (grano de
  cuero, pelo de gamuza, tejido, malla, caucho con partículas, celdas de espuma) generados una vez y
  cacheados; se usan solo si el GLB no trae sus propios mapas.
- `ZoneSurface` → `MeshPhysicalMaterial`; hereda `normalMap/roughnessMap/aoMap` del material
  original del GLB; detalle ajustado a la proporción del lienzo; sin clearcoat/sheen en tier bajo.
- `components/viewer/Studio.tsx`: ACES + exposición 0.92 (blancos con detalle), sRGB, HDRI del
  manifiesto o estudio procedural de 5 softboxes, key/fill/rim, PCF soft shadows (`SoftShadows`),
  `ContactShadows` escaladas al modelo, **N8AO** y **SMAA** en tier alto.
- Selector de material en la UI (`MaterialsPanel`, badge en Propiedades); el material se guarda
  por zona y zapato en el `DesignDocument` (`zones[id].material`).

## Fase 4 · Personalización UV
- `compositor.ts`: recorte al `uvIsland`, costuras (pespunte doble con color derivado de la base)
  y contorno de selección. Las UVs del modelo nunca se modifican; el documento sigue siendo
  independiente de la textura final.

## Fase 5 · Cámaras
- `src/lib/render/framing.ts`: vistas exterior, interior, superior, frontal, posterior, **3/4** y
  ambos zapatos, con dirección relativa al zapato activo y **distancia exacta en perspectiva**
  calculada sobre los 8 vértices del `Box3` (prueba: todos los vértices dentro del frustum).
  Límites de zoom proporcionales a la diagonal del modelo. Sin coordenadas fijas.

## Fase 6 · Optimización y pruebas
- `src/lib/render/quality.ts`: tiers low/medium/high (DPR, sombras, AO, SMAA, resolución de
  entorno y de sombras de contacto) resueltos con `WEBGL_debug_renderer_info`, memoria y móvil.
  Botón de calidad en el visor (Auto → Baja → Media → Alta).
- Texturas y materiales por zona se liberan al desmontar; mapas de detalle compartidos en caché.
- Pruebas nuevas: encuadre por bbox, tiers, presets, compositor (32 en total).
- Verificado en Chrome headless (SwiftShader) en los tres tiers, escritorio y móvil.

## Criterios de aceptación — estado

| # | Criterio | Estado |
|---|---|---|
| 1 | Carga de GLB profesional | **Sí**: `court-low-01` (asset "Unbranded White Sneaker" preparado con `tools/node/prepare-sneaker.mjs`, meshopt) es el modelo por defecto |
| 2 | Geometría original conservada | Sí: la app no modifica mallas ni UVs; solo reasigna materiales |
| 3 | Selección de zonas reales | Sí, vía `bindZones` + manifiesto |
| 4 | Colores sin destruir texturas | Sí: color en `map`/`color`, detalle heredado en normal/roughness |
| 5 | Imágenes integradas en superficie | Sí, CanvasTexture por UV con recorte a isla |
| 6 | Costuras y detalles visibles | Sí (normal maps + pespunte); mejor aún con mapas del asset |
| 7 | Cámaras con distintos modelos | Sí, por bounding box (prueba automatizada) |
| 8 | Editor conserva funciones | Sí; se añadió materiales y vista 3/4 |
| 9 | Iluminación muestra materiales | Sí (ACES, HDRI/estudio, AO, sombras suaves) |
| 10 | Escritorio y móvil | Sí, con tiers automáticos |

El modelo provisional se conserva en el catálogo como referencia de desarrollo; el editor permite
cambiar de modelo conservando colores e imágenes de las zonas equivalentes.

## Addendum · Integración del asset profesional (2026-11-09)
- Dos GLB aportados por el usuario: se eligió `unbranded_white_sneaker.glb` (9 mallas por material,
  197k tris) y se descartó `sneakers_low_poly_downloadable.glb` (una sola malla; sin zonas).
- Diagnóstico del asset: UVs en mosaico (−7..9), upper de cuero en una sola malla (punta + talón +
  empeine), panel lateral de gamuza en una malla para ambos lados, ojales de 64k tris, un solo pie,
  nombres de nodo duplicados, el asset es un zapato **izquierdo** (detectado por la planta).
- Solución (`tools/node/prepare-sneaker.mjs` + receta): cortes espaciales en 12 zonas, UVs de
  impresión por proyección planar/cilíndrica, espejo para el otro pie, simplificación selectiva
  (197k → 94k tris para ambos pies), meshopt, manifiesto generado.
- Verificado con checker UV (la "F" se lee sin espejo en laterales, punta y talón de ambos pies) y
  en la app en los tres niveles de calidad, escritorio y móvil.

## Dependencias
- `three` fijado a **0.182** por compatibilidad de `n8ao`/`postprocessing` (0.187 rompía los
  render targets de N8AO). Subir de versión cuando `@react-three/postprocessing` lo soporte.
- Nuevas: `@react-three/postprocessing`, `postprocessing`.

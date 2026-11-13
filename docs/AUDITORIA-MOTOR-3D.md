# Auditoría del motor 3D (estado previo a la refactorización)

Fecha: 2026-11-08. Alcance: `src/components/viewer`, `src/lib/model`, `src/lib/textures`, `src/config/models`.

## Cómo se generaba el zapato

- `src/lib/model/procedural/provisionalSneaker.ts` construye la zapatilla **por código** (paneles
  paramétricos, extrusión de suela, tubos para cordones y cuello) y `scripts/generate-provisional-model.ts`
  la exporta a `public/models/sneaker-low-01.glb` con un escritor GLB propio.
- La app **nunca ejecuta el generador en tiempo de ejecución**: carga el GLB con `useGLTF` igual que
  haría con un modelo profesional. Esa separación ya existía y se conserva.
- Problema: la geometría es simple (sin ojales, costuras, relieve de suela, cuello acolchado real) y
  su silueta no es anatómica. **Es un placeholder y no puede presentarse como resultado definitivo.**

## Materiales

- Un `MeshStandardMaterial` por zona (`ZoneSurface`), `metalness 0`, `roughness` fija del JSON,
  sin mapas de normales ni microvariación → colores planos con respuesta poco realista a la luz.
- Las zonas con imágenes usan `CanvasTexture` como `map` (`flipY=false`, sRGB); las demás solo `color`.
- Forro: segundo mesh con `BackSide` para paneles de una sola cara.

## Zonas

- `src/config/models/*.json` (validado con zod en `schema.ts`) declara zonas, `meshNames.right/left`,
  permisos, tamaño de textura. `bindZones()` es el único punto que resuelve nombres de mesh.
  **Esto ya es el "adaptador zona ↔ malla" pedido; se extiende, no se reemplaza.**

## Imágenes

- Documento editable (`DesignDocument`) con capas en espacio UV normalizado; el compositor dibuja
  color base + capas en un lienzo por zona y lo sube como textura. Las UVs del modelo **no se tocan**
  en ninguna interacción. Arrastre sobre el 3D vía `uv` del raycast; editor 2D (Konva) sobre el mismo
  espacio. Correcto; se conserva.
- Carencias: no hay máscara por zona (en un GLB real la isla UV no llena el 0..1), no hay mapa de
  detalle (normal/roughness) bajo la impresión, no hay recorte de la impresión a la isla UV.

## Cámaras

- `CameraRig` usa direcciones fijas por vista y **tamaños de encuadre escritos a mano** (`w=3.3`, `h=1.5`…)
  → fallan con otro modelo o escala. Debe calcularse desde el bounding box.
- Faltaba la vista perspectiva 3/4.

## Ambos zapatos

- El GLB trae dos nodos raíz (`Right`, `Left`); cada uno con estado y capas propios. Vista "ambos"
  separa con `layout.bothShoesOffset` fijo → debe derivarse del ancho real del modelo.

## Renderizado

- Sin tone mapping explícito (ACES por defecto de R3F, pero sin control de exposición), sin AO,
  `Lightformer`s como entorno, `ContactShadows`, sombra direccional 1024. Sin tiers de calidad por
  dispositivo, sin decoders Draco/KTX2/meshopt.

## Qué se refactoriza

| Área | Acción |
|---|---|
| Carga de modelos | Loader con Draco + KTX2 + meshopt, precarga, caché y manifiesto extendido |
| Zonas | Manifiesto: `material` (preset PBR), `uvIsland` (máscara), detalle de costura opcional |
| Materiales | Presets físicos (cuero, caucho, tela, cordones) con normal maps procedurales tileables |
| Iluminación | ACES + exposición, HDRI (archivo local opcional) o estudio de lightformers, AO N8, sombras suaves, SMAA |
| Cámaras | Encuadre por `Box3` del modelo y de ambos zapatos; vista 3/4 |
| Calidad | Tiers (low/medium/high) según GPU/DPR/móvil; liberación de GPU al desmontar |
| Pipeline | Scripts de Blender para inspeccionar, validar, nombrar, materiales, optimizar y exportar |
| UI | Sin cambios de estructura: se añaden los selectores de material y de vista 3/4 |

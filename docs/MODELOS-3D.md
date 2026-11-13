# Modelos 3D: especificación del asset profesional y pipeline de importación

## 0. Modelos incluidos

| modelId | Origen | Estado |
|---|---|---|
| `court-low-01` (**por defecto**) | `assets/src/unbranded-white-sneaker.glb` ("Unbranded White Sneaker", Sketchfab) procesado con `npm run model:prepare` | Profesional: 12 zonas, 94k tris ambos pies, meshopt |
| `court-classic-01` | `assets/src/air_force1.glb` (Sketchfab) procesado con `npm run model:prepare:classic` y la receta `tools/node/recipes/court-classic.json` | Profesional: 13 zonas (incluye panel trasero y costuras), 35k tris ambos pies, meshopt. **Sin logotipos**: se excluyen el «NIKE AIR» del talón, su copia suelta y los swooshes (paneles y costuras) |
| `sneaker-low-01` | Generado por código (`npm run model:generate`) | Provisional, solo referencia de desarrollo |

**Licencia:** el asset de Sketchfab lo aportó el usuario. Antes de uso comercial hay que verificar la
licencia del autor (las licencias CC exigen atribución; algunas prohíben uso comercial). El texto de
`credits` del manifiesto se muestra en el panel de modelos.

Se evaluó también `sneakers_low_poly_downloadable.glb` (bota alta, una sola malla de 9.8k tris con
atlas UV): sin mallas separadas no permite seleccionar zonas, por lo que se descartó como modelo
principal. Podría incorporarse con el mismo pipeline usando solo regiones espaciales (`region`).

## 1. Requisitos del asset

### Geometría
| Pieza | Requisito |
|---|---|
| Silueta | Anatómica (horma real): punta redondeada y ligeramente elevada, talón curvo, arco marcado |
| Paneles del upper | Mallas **separadas**: lateral exterior, lateral interior, puntera, contrafuerte del talón, lengüeta, cuello acolchado |
| Cordones | Geometría real (tubo trenzado o cinta plana), cruces y lazo; mesh propio |
| Ojales | Anillos metálicos como mesh propio (o incluidos en el panel con material separado) |
| Suela | Mesh propio con **relieve** (dibujo de tracción) modelado o en normal map |
| Entresuela | Mesh propio, separada de la suela |
| Costuras | Modeladas en bajo relieve o en normal map del material; nunca pintadas en el albedo de los paneles personalizables (ahí va la impresión del usuario) |
| Plantilla / forro | Opcional pero recomendable si el cuello deja ver el interior |
| Presupuesto | 40 000–120 000 triángulos por par; sin n‑gons; normales suavizadas por grupos |
| Escala | Metros (zapato ≈ 0.28–0.32 m de largo), origen en el suelo bajo el centro del zapato derecho |
| Orientación | +X hacia la punta, +Y arriba, exterior del zapato derecho hacia +Z |
| Zapato izquierdo | Modelado o generado por espejo con normales corregidas; **mismo orden de UV** que el derecho |

### Nombres y jerarquía (lo que lee `bindZones`)
```
Scene
├─ Right            ← nodo raíz del zapato derecho
│  ├─ R_OuterPanel  R_InnerPanel  R_ToeCap  R_HeelCounter  R_Tongue
│  ├─ R_Laces  R_Eyelets  R_Midsole  R_Outsole  R_Collar  R_Insole
└─ Left
   └─ L_…  (mismos sufijos)
```
Los nombres son configurables en el manifiesto JSON (`meshNames.right/left`); el pipeline de
Blender los asigna automáticamente a partir del archivo de mapping.

### UV mapping
- Cada panel personalizable tiene **una isla**, sin solapes, con **texel density uniforme**
  (checker sin estiramiento visible). Idealmente ocupa todo el 0..1 de su propia textura; si varios
  paneles comparten textura, declarar `uvIsland` en el manifiesto para que la impresión se recorte.
- Convención glTF: `v=0` arriba. Vista desde fuera del zapato: `u` crece a la derecha y `v` hacia
  abajo → textos e ilustraciones se leen correctamente. El izquierdo respeta la misma regla.
- Piezas sin impresión (suela, cordones, ojales) pueden usar UVs libres para sus propios mapas.

### Materiales dentro del GLB
- Principled BSDF por pieza. Para paneles personalizables basta el **normal map** (grano, costuras)
  y opcionalmente roughness/AO: el albedo lo pinta la aplicación.
- La aplicación **hereda** `normalMap`, `roughnessMap` y `aoMap` del material original del mesh y
  aplica el preset físico (cuero, gamuza, lona, malla, caucho, EVA, cordón, metal) elegido.
- Texturas 2K máximo por mapa; KTX2 recomendado en producción (`compression: ["ktx2"]`).
- Draco o meshopt para la geometría (`compression: ["draco"]` / `["meshopt"]`); los decoders ya se
  sirven desde `/public/decoders` (`npm run decoders:copy`).

## 2a. Pipeline en Node (`tools/node/`) — el que generó `court-low-01`

No requiere Blender. Trabaja sobre una copia en memoria; el archivo de entrada no se modifica.

```bash
npm run model:inspect -- assets/src/mi-modelo.glb     # nodos, mallas, materiales, UVs, bbox
npm run model:prepare                                  # receta tools/node/recipes/unbranded-white.json
```

Pasos de `prepare-sneaker.mjs`:
1. Aplica las transformaciones de los nodos y normaliza: largo `lengthMeters`, suelo en y=0, centro en
   el origen, punta hacia +X; `toe: "-x"` rota 180° y `inputIsLeftShoe: true` espeja el asset.
   Detecta el lado por la asimetría de la planta (el arco está en el lado interior) y avisa si el
   asset parece un zapato izquierdo.
2. **Zonas** desde la receta. Opciones añadidas para assets que traen varios paneles en una sola malla:
   - `exclude`: mallas que se descartan antes de normalizar (logotipos, piezas sueltas fuera del zapato).
   - `from: [{ "mesh": "…", "components": [i, …], "region": {…} }]`: toma componentes conexos concretos
     (índices por número de triángulos, de mayor a menor) y, opcionalmente, una región solo para esa entrada.
   - `dropComponents: { "malla": [i, …] }`: componentes descartados a propósito. Cualquier componente
     que no esté ni en una zona ni aquí genera una advertencia.
   - `region.cut: "exact"`: corta por planos dividiendo los triángulos (borde recto) en lugar de
     asignar triángulos enteros por su centroide (borde dentado).

   Opciones originales: `from` (mallas de origen, nombres duplicados se sufijan `_1`, `_2`…),
   `region` para cortes espaciales (`xFrom`/`xTo` como fracción del largo, `zSide` exterior/interior)
   y varias mallas se unen en una.
3. **UVs de impresión** regeneradas por proyección (las UV en mosaico de los assets de materiales no
   sirven para colocar imágenes): `planar` para laterales y lengüeta, `cylindrical` (eje vertical en
   el plano de corte) para punta y talón; `keep` normaliza las UV originales. Siempre u → derecha y
   v → abajo vistos desde fuera, 0..1 completo, y se mide la proporción física para dimensionar el
   lienzo (`texture.width/height`). Las UV del modelo **no** se tocan después en ninguna interacción.
4. **Zapato izquierdo** por espejo (z → −z, normales y sentido de caras corregidos) con sus propias
   UV de impresión para que las imágenes no salgan espejadas.
5. Optimización: `simplify` por zona (receta `simplify`), `weld`, `dedup`, `prune` (conservando
   atributos), `quantize` y compresión **meshopt** (`compression: ["meshopt"]` en el manifiesto).
6. Escribe el GLB (nodos raíz `Right`/`Left`, mallas `R_*`/`L_*`), el manifiesto JSON y un informe
   (`docs/reports/*.report.json`) con errores, advertencias y datos por zona.

Conserva el normal map que traiga el asset (p. ej. el relieve de la suela): la app lo hereda.

## 2b. Pipeline de Blender (`tools/blender/`)

```bash
# 1) Solo inspeccionar (no modifica nada)
blender -b --python tools/blender/inspect_model.py -- --input assets/src/sneaker.fbx --report out/inspect.json

# 2) Preparar y exportar (trabaja sobre una escena nueva; el original no se toca)
blender -b --python tools/blender/sneakerlab_pipeline.py -- \
  --input assets/src/sneaker.fbx \
  --mapping tools/blender/mapping.example.json \
  --output public/models/sneaker-low-02.glb \
  --manifest src/config/models/sneaker-low-02.json \
  --name "Court Low" --draco --decimate 0.7 --report out/report.json --strict
```

El script: importa (FBX/OBJ/GLB/BLEND) → inspecciona → valida normales (caras invertidas) y UVs
(rango, área de isla, solapes) → detecta paneles por reglas de nombre/material → renombra
`R_/L_` → crea materiales Principled con los presets → aplica transformaciones, elimina dobles,
triangula, decima (opcional) → exporta GLB (Draco opcional) → escribe el manifiesto y un informe
JSON con `errors` / `warnings` / `info` / `objects` / `zones`. Con `--strict`, cualquier error
aborta la exportación. Si el asset solo trae el zapato derecho, `"mirror": true` genera el izquierdo.

## 3. Integrar el modelo en la app

1. Copiar el `.glb` a `public/models/` y el manifiesto a `src/config/models/`.
2. Registrarlo en `src/lib/model/registry.ts` (import + añadir al array).
3. Revisar en el manifiesto `texture.width/height` (misma proporción que la isla UV), `uvIsland`,
   `material`, `materialOptions`, `stitchInset` (solo si la isla es rectangular) y `environment`
   (HDRI opcional en `/public/hdri/*.hdr`).
4. `npm test`: la prueba de integración comprueba que todas las zonas enlazan y tienen UVs.
5. Las cámaras, la separación de "ambos zapatos" y las sombras se calculan desde el bounding box:
   no hay nada que ajustar a mano.

## 4. Dependencias pendientes

- **Licencia del asset** `court-low-01` (ver §0) antes de uso comercial.
- **HDRI de estudio**: la iluminación usa un estudio procedural de softboxes. Un `.hdr` local
  (p. ej. un *studio small* de Poly Haven, CC0) mejora reflejos; declararlo en `environment.url`.
- **Blender 3.6+ o 4.x** para ejecutar el pipeline (no se ejecuta en el servidor web).

/**
 * Aplicación de un preset al documento del editor.
 * Funciones puras (probables en Node); la carga de recursos la hace `loadPresetAssets` en el cliente.
 */
import { produce } from "immer";
import type { ModelConfig, ShoeSide } from "@/lib/model/schema";
import { SHOE_SIDES } from "@/lib/model/schema";
import { createDocument, normalizeDocument } from "@/lib/editor/document";
import type { AssetRef, DesignDocument, ImageLayer } from "@/lib/editor/types";
import type { DesignAsset, SneakerDesignPreset } from "./schema";

export type ApplyTarget = "both" | ShoeSide;

export interface CompatibilityResult {
  ok: boolean;
  /** Problemas que impiden aplicar. */
  errors: string[];
  /** Capas/zonas que se omitirán sin bloquear. */
  warnings: string[];
}

/** Comprueba que el preset puede aplicarse al modelo (zonas existentes y con permisos adecuados). */
export function checkCompatibility(preset: SneakerDesignPreset, model: ModelConfig): CompatibilityResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!preset.compatibleModels.includes(model.modelId)) {
    errors.push(`El diseño está hecho para ${preset.compatibleModels.join(", ")}, no para ${model.name}.`);
  }
  const zoneById = new Map(model.zones.map((z) => [z.id, z]));
  for (const z of preset.zones) {
    const zone = zoneById.get(z.zoneId);
    if (!zone) warnings.push(`La zona "${z.zoneId}" no existe en ${model.name}; se omite.`);
    else if (z.color && !zone.allowColors) warnings.push(`${zone.label} no admite color; se omite.`);
    else if (z.material && !zone.allowMaterials) warnings.push(`${zone.label} no admite materiales; se omite.`);
  }
  const assetIds = new Set(preset.assets.map((a) => a.id));
  for (const l of preset.layers) {
    const zone = zoneById.get(l.zoneId);
    if (!zone) warnings.push(`Capa "${l.name ?? l.id}": la zona "${l.zoneId}" no existe; se omite.`);
    else if (!zone.allowImages || !zone.texture) warnings.push(`Capa "${l.name ?? l.id}": ${zone.label} no admite imágenes; se omite.`);
    if (!assetIds.has(l.assetId)) errors.push(`Capa "${l.name ?? l.id}": recurso "${l.assetId}" no declarado en el preset.`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function assetRefFromDesignAsset(a: DesignAsset): AssetRef {
  return {
    id: `lib_${a.id}`,
    name: a.name,
    mime: a.type === "svg" ? "image/svg+xml" : `image/${a.type}`,
    width: a.rasterSize,
    height: a.rasterSize,
    bytes: 0,
    createdAt: new Date(0).toISOString(),
    url: a.url,
    rasterSize: a.rasterSize,
  };
}

/** Convierte las capas del preset en capas de documento para los zapatos indicados. */
export function expandLayers(preset: SneakerDesignPreset, model: ModelConfig, target: ApplyTarget, prefix: string): ImageLayer[] {
  const sides: ShoeSide[] = target === "both" ? [...SHOE_SIDES] : [target];
  const zoneById = new Map(model.zones.map((z) => [z.id, z]));
  const out: ImageLayer[] = [];
  for (const l of preset.layers) {
    const zone = zoneById.get(l.zoneId);
    if (!zone?.allowImages || !zone.texture) continue;
    const asset = preset.assets.find((a) => a.id === l.assetId);
    if (!asset) continue;
    for (const side of sides) {
      if (l.shoe !== "both" && l.shoe !== side) continue;
      const mirrored = side === "left" && l.mirrorOnLeft;
      out.push({
        id: `${prefix}_${l.id}_${side}`,
        kind: "image",
        name: l.name ?? asset.name,
        assetId: `lib_${asset.id}`,
        shoe: side,
        zoneId: l.zoneId,
        x: l.x,
        y: l.y,
        width: l.width,
        rotation: l.rotation,
        opacity: l.opacity,
        flipX: mirrored ? !l.flipX : l.flipX,
        visible: true,
      });
    }
  }
  return out;
}

export interface ApplyOptions {
  /** A qué zapato(s) aplicar. Permite combinar diseños distintos en cada pie. */
  target?: ApplyTarget;
  /** Si es false conserva las capas existentes de los zapatos afectados (combinar); por defecto las reemplaza. */
  replaceLayers?: boolean;
  /** Nombre del documento resultante. */
  name?: string;
  /** Prefijo de ids de capa (para evitar colisiones al aplicar varias veces). */
  layerPrefix?: string;
}

/**
 * Devuelve un nuevo documento con el preset aplicado. No muta el preset ni el documento original:
 * los presets de la biblioteca permanecen intactos y el usuario edita su propia copia.
 */
export function applyPresetToDocument(
  doc: DesignDocument,
  preset: SneakerDesignPreset,
  model: ModelConfig,
  opts: ApplyOptions = {},
): DesignDocument {
  const target = opts.target ?? "both";
  const sides: ShoeSide[] = target === "both" ? [...SHOE_SIDES] : [target];
  const replace = opts.replaceLayers ?? true;
  const prefix = opts.layerPrefix ?? `${preset.id}_${Date.now().toString(36)}`;
  const zoneById = new Map(model.zones.map((z) => [z.id, z]));

  const next = produce(normalizeDocument(doc, model), (d) => {
    if (opts.name) d.name = opts.name;
    for (const side of sides) {
      for (const z of preset.zones) {
        if (z.shoe && z.shoe !== side) continue;
        const zone = zoneById.get(z.zoneId);
        const state = d.shoes[side].zones[z.zoneId];
        if (!zone || !state) continue;
        if (z.color && zone.allowColors) state.color = z.color;
        if (z.material && zone.allowMaterials && (!zone.materialOptions || zone.materialOptions.includes(z.material))) {
          state.material = z.material;
        }
      }
    }
    if (replace) d.layers = d.layers.filter((l) => !sides.includes(l.shoe));
    for (const a of preset.assets) {
      const ref = assetRefFromDesignAsset(a);
      d.assets[ref.id] = ref;
    }
    d.layers.push(...expandLayers(preset, model, target, prefix));
    d.updatedAt = new Date().toISOString();
  });
  return next;
}

/** Documento nuevo con el preset aplicado (desde cero). */
export function documentFromPreset(preset: SneakerDesignPreset, model: ModelConfig, name?: string): DesignDocument {
  return applyPresetToDocument(createDocument(model, name ?? preset.name), preset, model, { name: name ?? preset.name });
}

/**
 * Operación inversa: convierte el documento actual en un preset (para "Guardar como plantilla").
 * Solo se exportan recursos de biblioteca (con URL); las imágenes subidas por el usuario se reportan.
 */
export function presetFromDocument(
  doc: DesignDocument,
  model: ModelConfig,
  meta: { id: string; name: string; category: SneakerDesignPreset["category"]; tags?: string[]; description?: string },
  libraryAssets: Record<string, DesignAsset>,
): { preset: SneakerDesignPreset; skippedUploads: string[] } {
  const skipped: string[] = [];
  const zones: SneakerDesignPreset["zones"] = [];
  for (const side of SHOE_SIDES) {
    for (const z of model.zones) {
      const st = doc.shoes[side].zones[z.id];
      if (!st) continue;
      zones.push({ zoneId: z.id, shoe: side, color: st.color, material: st.material });
    }
  }
  const assets = new Map<string, DesignAsset>();
  const layers: SneakerDesignPreset["layers"] = [];
  for (const l of doc.layers) {
    if (l.kind !== "image") {
      skipped.push(`${l.name} (${l.kind === "text" ? "texto" : "patrón"}: aún no se exporta a plantillas)`);
      continue;
    }
    const libId = l.assetId.startsWith("lib_") ? l.assetId.slice(4) : null;
    const lib = libId ? libraryAssets[libId] : undefined;
    if (!lib) {
      skipped.push(l.name);
      continue;
    }
    assets.set(lib.id, lib);
    layers.push({
      id: l.id.replace(/[^a-z0-9-]/gi, "-").toLowerCase(), kind: "image", name: l.name, assetId: lib.id, shoe: l.shoe, zoneId: l.zoneId,
      x: l.x, y: l.y, width: l.width, rotation: l.rotation, opacity: l.opacity, flipX: l.flipX, mirrorOnLeft: false,
    });
  }
  const palette = [...new Set(zones.map((z) => z.color).filter(Boolean) as string[])].slice(0, 6);
  const now = new Date().toISOString();
  const preset: SneakerDesignPreset = {
    id: meta.id, name: meta.name, category: meta.category, tags: meta.tags ?? [], description: meta.description,
    thumbnailUrl: undefined, previewImages: [], compatibleModels: [model.modelId],
    colorPalette: palette.length ? palette : ["#ffffff"], zones, layers, assets: [...assets.values()],
    status: "draft", pendingAssets: skipped.length ? skipped.map((s) => `Imagen subida "${s}" no incluida (requiere publicar el recurso)`) : [],
    version: 1, createdAt: now, updatedAt: now, source: "custom",
  };
  return { preset, skippedUploads: skipped };
}

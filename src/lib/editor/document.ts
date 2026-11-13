/**
 * Operaciones puras sobre DesignDocument (sin estado global).
 * El store las orquesta; aquí se pueden probar de forma aislada.
 */
import { produce } from "immer";
import type { MaterialPresetId, ModelConfig, ShoeSide } from "@/lib/model/schema";
import { SHOE_SIDES } from "@/lib/model/schema";
import { createId } from "@/lib/utils/id";
import { DESIGN_SCHEMA_VERSION, type DesignDocument, type Layer, type ShoeState } from "./types";

const now = () => new Date().toISOString();

export function createDocument(model: ModelConfig, name = "Diseño sin título"): DesignDocument {
  const shoe = (): ShoeState => ({
    zones: Object.fromEntries(model.zones.map((z) => [z.id, { color: z.defaultColor }])),
  });
  const ts = now();
  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    id: createId("dsg"),
    name,
    modelId: model.modelId,
    shoes: { right: shoe(), left: shoe() },
    layers: [],
    assets: {},
    createdAt: ts,
    updatedAt: ts,
  };
}

/**
 * Zapato tal como sale de fábrica: colores y materiales por defecto en ambos pies y sin capas.
 * Conserva modelo, nombre, id y las imágenes subidas (siguen disponibles para volver a usarlas).
 */
export function clearDesign(doc: DesignDocument, model: ModelConfig): DesignDocument {
  const blank = createDocument(model, doc.name);
  return { ...doc, shoes: blank.shoes, layers: [], updatedAt: now() };
}

/** ¿El documento ya está en blanco? (para desactivar el botón). */
export function isBlank(doc: DesignDocument, model: ModelConfig): boolean {
  if (doc.layers.length) return false;
  return SHOE_SIDES.every((side) =>
    model.zones.every((z) => {
      const st = doc.shoes[side]?.zones[z.id];
      return !st || (st.color.toLowerCase() === z.defaultColor.toLowerCase() && (!st.material || st.material === z.material));
    }),
  );
}

/** Asegura que el documento tenga estado para todas las zonas del modelo (migración suave). */
export function normalizeDocument(doc: DesignDocument, model: ModelConfig): DesignDocument {
  return produce(doc, (d) => {
    for (const side of SHOE_SIDES) {
      d.shoes[side] ??= { zones: {} };
      for (const z of model.zones) {
        d.shoes[side].zones[z.id] ??= { color: z.defaultColor };
      }
    }
    const imageZones = new Set(model.zones.filter((z) => z.allowImages).map((z) => z.id));
    const textZones = new Set(model.zones.filter((z) => z.allowText).map((z) => z.id));
    d.layers = d.layers.filter((l) =>
      l.kind === "image" ? imageZones.has(l.zoneId) && !!d.assets[l.assetId]
      : l.kind === "text" ? textZones.has(l.zoneId)
      : imageZones.has(l.zoneId),
    );
  });
}

/** Cambia el modelo conservando colores/capas de las zonas que existan en el nuevo. */
export function switchModel(doc: DesignDocument, model: ModelConfig): DesignDocument {
  return normalizeDocument(produce(doc, (d) => { d.modelId = model.modelId; touch(d); }), model);
}

export function touch(d: DesignDocument) {
  d.updatedAt = now();
}

export function setZoneColor(
  doc: DesignDocument,
  sides: ShoeSide[],
  zoneId: string,
  color: string,
): DesignDocument {
  return produce(doc, (d) => {
    for (const s of sides) {
      const zone = d.shoes[s].zones[zoneId];
      if (zone && zone.color !== color) zone.color = color;
    }
    touch(d);
  });
}

export function setZoneMaterial(
  doc: DesignDocument,
  sides: ShoeSide[],
  zoneId: string,
  material: MaterialPresetId,
): DesignDocument {
  return produce(doc, (d) => {
    for (const s of sides) {
      const zone = d.shoes[s].zones[zoneId];
      if (zone && zone.material !== material) zone.material = material;
    }
    touch(d);
  });
}

export function addLayer(doc: DesignDocument, layer: Layer): DesignDocument {
  return produce(doc, (d) => {
    d.layers.push(layer);
    touch(d);
  });
}

export type LayerPatch = Partial<Omit<Layer, "id" | "kind">> & Record<string, unknown>;

export function updateLayer(doc: DesignDocument, id: string, patch: LayerPatch): DesignDocument {
  return produce(doc, (d) => {
    const layer = d.layers.find((l) => l.id === id);
    if (!layer) return;
    Object.assign(layer, patch);
    touch(d);
  });
}

export function removeLayer(doc: DesignDocument, id: string): DesignDocument {
  return produce(doc, (d) => {
    d.layers = d.layers.filter((l) => l.id !== id);
    touch(d);
  });
}

export function duplicateLayer(
  doc: DesignDocument,
  id: string,
  target?: { shoe: ShoeSide; zoneId?: string },
): { doc: DesignDocument; newId: string | null } {
  const src = doc.layers.find((l) => l.id === id);
  if (!src) return { doc, newId: null };
  const newId = createId("lyr");
  const copy: Layer = {
    ...src,
    id: newId,
    name: target ? src.name : `${src.name} (copia)`,
    shoe: target?.shoe ?? src.shoe,
    zoneId: target?.zoneId ?? src.zoneId,
    x: target ? src.x : Math.min(0.98, src.x + 0.04),
    y: target ? src.y : Math.min(0.98, src.y + 0.04),
  };
  const next = produce(doc, (d) => {
    const idx = d.layers.findIndex((l) => l.id === id);
    d.layers.splice(idx + 1, 0, copy);
    touch(d);
  });
  return { doc: next, newId };
}

/** Mueve una capa una posición arriba/abajo dentro de su misma zona y zapato. */
export function reorderLayer(doc: DesignDocument, id: string, direction: "up" | "down"): DesignDocument {
  return produce(doc, (d) => {
    const idx = d.layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const layer = d.layers[idx];
    const same = (i: number) =>
      d.layers[i] && d.layers[i].shoe === layer.shoe && d.layers[i].zoneId === layer.zoneId;
    let j = idx;
    do {
      j += direction === "up" ? 1 : -1;
    } while (j >= 0 && j < d.layers.length && !same(j));
    if (j < 0 || j >= d.layers.length) return;
    d.layers.splice(idx, 1);
    d.layers.splice(j, 0, layer);
    touch(d);
  });
}

export function layersFor(doc: DesignDocument, shoe: ShoeSide, zoneId: string): Layer[] {
  return doc.layers.filter((l) => l.shoe === shoe && l.zoneId === zoneId);
}

import { describe, expect, it } from "vitest";
import { getModel, DEFAULT_MODEL_ID } from "@/lib/model/registry";
import * as D from "./document";
import type { ImageLayer } from "./types";

const model = getModel(DEFAULT_MODEL_ID);
const layer = (over: Partial<ImageLayer> = {}): ImageLayer => ({
  id: "l1", kind: "image", name: "img", assetId: "a1", shoe: "right", zoneId: "outer",
  x: 0.5, y: 0.5, width: 0.3, rotation: 0, opacity: 1, flipX: false, visible: true, ...over,
});

describe("document", () => {
  it("crea estado de color para todas las zonas en ambos zapatos", () => {
    const doc = D.createDocument(model);
    for (const z of model.zones) {
      expect(doc.shoes.right.zones[z.id].color).toBe(z.defaultColor);
      expect(doc.shoes.left.zones[z.id].color).toBe(z.defaultColor);
    }
  });

  it("deja el zapato en blanco: colores y materiales de fábrica, sin capas, mismo modelo y nombre", () => {
    let doc = D.addLayer(D.createDocument(model, "Mi diseño"), layer());
    doc = D.setZoneColor(doc, ["right", "left"], "toe", "#ff0000");
    doc = D.setZoneMaterial(doc, ["left"], "outer", "suede");
    expect(D.isBlank(doc, model)).toBe(false);
    const blank = D.clearDesign(doc, model);
    expect(D.isBlank(blank, model)).toBe(true);
    expect(blank.layers).toEqual([]);
    expect(blank.shoes.left.zones.outer.material).toBeUndefined();
    expect(blank.shoes.right.zones.toe.color).toBe(model.zones.find((z) => z.id === "toe")!.defaultColor);
    expect([blank.id, blank.name, blank.modelId, blank.assets]).toEqual([doc.id, "Mi diseño", doc.modelId, doc.assets]);
    expect(D.isBlank(D.createDocument(model), model)).toBe(true);
  });

  it("cambia color solo en los zapatos indicados y es inmutable", () => {
    const doc = D.createDocument(model);
    const next = D.setZoneColor(doc, ["left"], "toe", "#ff0000");
    expect(next.shoes.left.zones.toe.color).toBe("#ff0000");
    expect(next.shoes.right.zones.toe.color).not.toBe("#ff0000");
    expect(doc.shoes.left.zones.toe.color).not.toBe("#ff0000");
  });

  it("duplica, copia al otro zapato y reordena dentro de la zona", () => {
    let doc = D.addLayer(D.createDocument(model), layer());
    doc = D.addLayer(doc, layer({ id: "l2", zoneId: "heel" }));
    doc = D.addLayer(doc, layer({ id: "l3" }));
    const dup = D.duplicateLayer(doc, "l1");
    expect(dup.doc.layers).toHaveLength(4);
    const copy = D.duplicateLayer(doc, "l1", { shoe: "left" });
    expect(copy.doc.layers.find((l) => l.id === copy.newId)?.shoe).toBe("left");

    // l1 sube por encima de l3 saltando l2 (otra zona)
    const re = D.reorderLayer(doc, "l1", "up");
    expect(D.layersFor(re, "right", "outer").map((l) => l.id)).toEqual(["l3", "l1"]);
  });

  it("normalize elimina capas huérfanas y completa zonas", () => {
    const doc = D.addLayer(D.createDocument(model), layer());
    const broken = { ...doc, shoes: { ...doc.shoes, left: { zones: {} } } };
    const fixed = D.normalizeDocument(broken, model);
    expect(fixed.layers).toHaveLength(0); // el asset a1 no existe
    expect(Object.keys(fixed.shoes.left.zones)).toHaveLength(model.zones.length);
  });
});

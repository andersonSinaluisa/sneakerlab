import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { BUILTIN_PRESETS } from "./catalog";
import { DESIGN_CATEGORIES } from "./schema";
import { applyPresetToDocument, checkCompatibility, documentFromPreset, expandLayers, presetFromDocument } from "./apply";
import { DESIGN_ASSETS } from "./assets";
import { getModel } from "@/lib/model/registry";
import { createDocument } from "@/lib/editor/document";

const model = getModel("court-low-01");

describe("biblioteca de diseños", () => {
  it("tiene al menos 30 diseños con la distribución pedida", () => {
    const groups = new Map(DESIGN_CATEGORIES.map((c) => [c.id, c.group]));
    const count = (g: string) => BUILTIN_PRESETS.filter((p) => groups.get(p.category) === g).length;
    expect(BUILTIN_PRESETS.length).toBeGreaterThanOrEqual(30);
    expect(count("anime")).toBeGreaterThanOrEqual(20);
    expect(count("japan")).toBeGreaterThanOrEqual(5);
    expect(count("urban")).toBeGreaterThanOrEqual(5);
  });

  it("ids únicos y recursos existentes en disco", () => {
    const ids = new Set(BUILTIN_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(BUILTIN_PRESETS.length);
    for (const a of Object.values(DESIGN_ASSETS)) {
      expect(existsSync(resolve(__dirname, "../../../public", a.url.slice(1))), a.url).toBe(true);
    }
  });

  it("todos los publicados son compatibles con el modelo y usan zonas con imágenes", () => {
    for (const p of BUILTIN_PRESETS.filter((p) => p.status === "published")) {
      const c = checkCompatibility(p, model);
      expect(c.errors, p.id).toEqual([]);
      expect(c.warnings, p.id).toEqual([]);
      expect(p.layers.length, p.id).toBeGreaterThan(0);
    }
  });

  it("los diseños son visualmente distintos (no solo cambios de color)", () => {
    const signatures = BUILTIN_PRESETS.map((p) => p.layers.map((l) => `${l.zoneId}:${l.assetId}`).sort().join("|"));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("aplicar genera capas para ambos zapatos y respeta mirrorOnLeft", () => {
    const p = BUILTIN_PRESETS.find((x) => x.id === "dragon-spirit")!;
    const layers = expandLayers(p, model, "both", "t");
    const right = layers.filter((l) => l.shoe === "right");
    const left = layers.filter((l) => l.shoe === "left");
    expect(right.length).toBe(left.length);
    const dr = right.find((l) => l.assetId === "lib_dragon-jade")!;
    const dl = left.find((l) => l.assetId === "lib_dragon-jade")!;
    expect(dr.flipX).toBe(false);
    expect(dl.flipX).toBe(true);
  });

  it("aplicar a un solo zapato conserva el otro (combinar) y el preset no cambia", () => {
    const a = BUILTIN_PRESETS.find((x) => x.id === "crimson-eye")!;
    const b = BUILTIN_PRESETS.find((x) => x.id === "kawaii-neko")!;
    const snapshot = JSON.stringify(a);
    let doc = documentFromPreset(a, model);
    doc = applyPresetToDocument(doc, b, model, { target: "left", replaceLayers: true, layerPrefix: "x" });
    expect(doc.layers.filter((l) => l.shoe === "right").every((l) => l.id.startsWith(a.id))).toBe(true);
    expect(doc.layers.filter((l) => l.shoe === "left").every((l) => l.id.startsWith("x_"))).toBe(true);
    expect(doc.shoes.left.zones.outer.color).toBe("#efe7ff");
    expect(doc.shoes.right.zones.upper.color).toBe("#111114");
    expect(JSON.stringify(a)).toBe(snapshot);
  });

  it("documento → preset → documento conserva colores y capas de biblioteca", () => {
    const p = BUILTIN_PRESETS.find((x) => x.id === "ink-demon")!;
    const doc = documentFromPreset(p, model);
    const { preset, skippedUploads } = presetFromDocument(doc, model, { id: "mi-oni", name: "Mi oni", category: "oni-masks" }, DESIGN_ASSETS);
    expect(skippedUploads).toEqual([]);
    expect(preset.layers.length).toBe(doc.layers.length);
    const again = documentFromPreset(preset, model);
    expect(again.shoes.right.zones.outer.color).toBe(doc.shoes.right.zones.outer.color);
    expect(again.layers.length).toBe(doc.layers.length);
  });

  it("un documento vacío + preset no deja capas huérfanas", () => {
    const p = BUILTIN_PRESETS[0];
    const doc = applyPresetToDocument(createDocument(model), p, model);
    for (const l of doc.layers) if (l.kind === "image") expect(doc.assets[l.assetId], l.assetId).toBeDefined();
  });
});

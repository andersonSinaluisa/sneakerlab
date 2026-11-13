import { describe, expect, it } from "vitest";
import { estimateTextWidth, layerBox, layerInstances, pickLayerAtUv } from "./layerMath";
import type { ImageLayer, PatternLayer, TextLayer } from "@/lib/editor/types";
import { parseDocument } from "@/lib/editor/persistence";
import { getModel } from "@/lib/model/registry";
import { createDocument, normalizeDocument, addLayer } from "@/lib/editor/document";

const canvas = { width: 2048, height: 656 };
const common = { shoe: "right" as const, zoneId: "outer", x: 0.5, y: 0.5, rotation: 0, opacity: 1, flipX: false, visible: true };
const text: TextLayer = { ...common, id: "t", kind: "text", name: "T", width: 0.5, text: "RONIN", font: "display", weight: 800, italic: false, size: 0.3, letterSpacing: 0.05, fill: "#000000", strokeWidth: 0, curve: 0, align: "center" };
const pattern: PatternLayer = { ...common, id: "p", kind: "pattern", name: "P", width: 1, height: 1, pattern: "stripes", colorA: "#ffffff", colorB: "#000000", scale: 0.1 };
const image: ImageLayer = { ...common, id: "i", kind: "image", name: "I", width: 0.25, assetId: "a" };

describe("capas de texto y patrón", () => {
  it("la caja del texto crece con el tamaño y el número de letras", () => {
    const a = layerBox(text, canvas);
    const b = layerBox({ ...text, text: "RONIN RONIN" }, canvas);
    const c = layerBox({ ...text, size: 0.6 }, canvas);
    expect(b.w).toBeGreaterThan(a.w);
    expect(c.h).toBeGreaterThan(a.h);
    expect(estimateTextWidth(text, canvas)).toBeGreaterThan(0);
  });
  it("el patrón ocupa toda la zona por defecto", () => {
    const b = layerBox(pattern, canvas);
    expect(b.w).toBe(2048);
    expect(b.h).toBe(656);
  });
  it("repetición y simetría generan instancias", () => {
    expect(layerInstances(image, canvas)).toHaveLength(1);
    expect(layerInstances({ ...image, repeat: { count: 3, gap: 0.2, direction: "horizontal" } }, canvas)).toHaveLength(3);
    const inst = layerInstances({ ...image, x: 0.3, mirror: true }, canvas);
    expect(inst).toHaveLength(2);
    expect(inst[1].cx).toBeCloseTo(canvas.width * 0.7);
    expect(inst[1].flip).toBe(true);
  });
  it("el hit-test alcanza las copias espejadas y el texto", () => {
    const layers = [{ ...image, x: 0.3, mirror: true }, text];
    const size = () => ({ width: 100, height: 100 });
    expect(pickLayerAtUv(layers, { x: 0.7, y: 0.5 }, canvas, size)?.id).toBe("i");
    expect(pickLayerAtUv(layers, { x: 0.5, y: 0.5 }, canvas, size)?.id).toBe("t");
  });
  it("el recorte cambia la proporción de la imagen", () => {
    const full = layerBox(image, canvas, { width: 1000, height: 500 });
    const crop = layerBox({ ...image, crop: { x: 0, y: 0, w: 0.5, h: 1 } }, canvas, { width: 1000, height: 500 });
    expect(crop.h).toBeCloseTo(full.h * 2);
  });
});

describe("persistencia v2", () => {
  const model = getModel("court-low-01");
  it("migra borradores v1 (solo imágenes) al esquema v2", () => {
    const v1 = { ...createDocument(model), schemaVersion: 1, layers: [{ id: "l", name: "x", assetId: "a", shoe: "right", zoneId: "outer", x: 0.5, y: 0.5, width: 0.2, rotation: 0, opacity: 1, flipX: false, visible: true }] };
    const doc = parseDocument(v1);
    expect(doc?.schemaVersion).toBe(2);
    expect(doc?.layers[0].kind).toBe("image");
  });
  it("acepta y normaliza capas de texto y patrón; descarta texto en zonas sin texto", () => {
    let doc = addLayer(createDocument(model), text);
    doc = addLayer(doc, pattern);
    doc = addLayer(doc, { ...text, id: "t2", zoneId: "laces" });
    expect(parseDocument(doc)).not.toBeNull();
    const n = normalizeDocument(doc, model);
    expect(n.layers.map((l) => l.id)).toEqual(["t", "p"]);
  });
  it("rechaza un texto con color inválido", () => {
    const doc = addLayer(createDocument(model), { ...text, fill: "rojo" as string });
    expect(parseDocument(doc)).toBeNull();
  });
});

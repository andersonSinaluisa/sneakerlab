import { describe, expect, it } from "vitest";
import { hitTestBox, layerBox, pickLayerAtUv, initialLayerWidth } from "./layerMath";
import type { ImageLayer } from "@/lib/editor/types";

const canvas = { width: 2000, height: 1000 };
const base: ImageLayer = {
  id: "a", kind: "image", name: "", assetId: "img", shoe: "right", zoneId: "outer",
  x: 0.5, y: 0.5, width: 0.2, rotation: 0, opacity: 1, flipX: false, visible: true,
};

describe("layerMath", () => {
  it("conserva la proporción de la imagen", () => {
    const box = layerBox(base, canvas, { width: 400, height: 200 });
    expect(box.w).toBe(400);
    expect(box.h).toBe(200);
    expect(box.cx).toBe(1000);
    expect(box.cy).toBe(500);
  });

  it("hit test con rotación", () => {
    const box = layerBox({ ...base, rotation: 90 }, canvas, { width: 400, height: 100 });
    // rotada 90°: ahora es alta y estrecha
    expect(hitTestBox(box, 1000, 500 + 190)).toBe(true);
    expect(hitTestBox(box, 1000 + 190, 500)).toBe(false);
  });

  it("elige la capa superior visible", () => {
    const layers = [base, { ...base, id: "b" }, { ...base, id: "c", visible: false }];
    const hit = pickLayerAtUv(layers, { x: 0.5, y: 0.5 }, canvas, () => ({ width: 100, height: 100 }));
    expect(hit?.id).toBe("b");
    expect(pickLayerAtUv(layers, { x: 0.05, y: 0.05 }, canvas, () => ({ width: 100, height: 100 }))).toBeUndefined();
  });

  it("ancho inicial acotado", () => {
    const w = initialLayerWidth(canvas, { width: 100, height: 100 });
    expect(w).toBeCloseTo(0.3);
    expect(initialLayerWidth(canvas, { width: 10000, height: 10 })).toBe(0.9);
  });
});

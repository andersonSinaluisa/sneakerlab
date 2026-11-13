import { describe, expect, it } from "vitest";
import { measureUvScale, sizeScale } from "./measure";

describe("measureUvScale", () => {
  it("mide un panel plano de 200×100 mm mapeado a toda la textura", () => {
    // Dos triángulos: (0,0,0)-(0.2,0,0)-(0.2,0.1,0)-(0,0.1,0), v hacia abajo
    const positions = [0, 0.1, 0, 0.2, 0.1, 0, 0.2, 0, 0, 0, 0, 0];
    const uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    expect(measureUvScale(positions, uvs, [0, 1, 2, 0, 2, 3])).toEqual({ width: 200, height: 100 });
  });

  it("ignora triángulos degenerados en UV", () => {
    const positions = [0, 0, 0, 0.2, 0, 0, 0.2, 0.1, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2];
    const uvs = [0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
    expect(measureUvScale(positions, uvs, null)).toEqual({ width: 200, height: 100 });
  });
});

describe("sizeScale", () => {
  it("es 1 en la talla de referencia y crece con la talla", () => {
    expect(sizeScale(42, 42)).toBe(1);
    expect(sizeScale(45, 42)).toBeGreaterThan(1.06);
    expect(sizeScale(36, 42)).toBeLessThan(0.89);
  });
});

import { imagePrintQuality } from "./quality";
import type { AssetRef, ImageLayer } from "@/lib/editor/types";

describe("imagePrintQuality", () => {
  const zone = { texture: { width: 2048, height: 1024, printMm: { width: 254, height: 127 } } } as never;
  const layer = { width: 0.5, crop: undefined } as unknown as ImageLayer; // 127 mm = 5"
  const asset = (w: number, extra: Partial<AssetRef> = {}) => ({ id: "a", name: "a", mime: "image/png", width: w, height: w, bytes: 1, createdAt: "", ...extra }) as AssetRef;

  it("usa el original si existe y clasifica la calidad", () => {
    expect(imagePrintQuality(layer, asset(1500), zone)).toEqual({ dpi: 300, level: "good" });
    expect(imagePrintQuality(layer, asset(2048, { original: { mime: "image/png", width: 900, height: 900, bytes: 1 } }), zone)).toEqual({ dpi: 180, level: "fair" });
    expect(imagePrintQuality(layer, asset(500), zone)?.level).toBe("poor");
  });

  it("los SVG siempre son buenos y sin medida no hay dato", () => {
    expect(imagePrintQuality(layer, asset(100, { mime: "image/svg+xml" }), zone)?.level).toBe("good");
    expect(imagePrintQuality(layer, asset(100), { texture: { width: 1, height: 1 } } as never)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { deflateSync } from "fflate";
import { crc32, readPngDpi, withPngDpi } from "./png";
import { packShelves } from "./pack";

function tinyPng(): Uint8Array {
  const chunk = (type: string, data: number[]) => {
    const body = new Uint8Array([...type].map((c) => c.charCodeAt(0)).concat(data));
    const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, data.length);
    const crc = new Uint8Array(4); new DataView(crc.buffer).setUint32(0, crc32(body));
    return [...len, ...body, ...crc];
  };
  const ihdr = [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0];
  const idat = [...deflateSync(new Uint8Array([0, 255, 0, 0, 255]))];
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk("IHDR", ihdr), ...chunk("IDAT", idat), ...chunk("IEND", [])]);
}

describe("withPngDpi", () => {
  it("escribe 300 ppp tras IHDR con CRC válido y es idempotente", () => {
    const png = withPngDpi(tinyPng(), 300);
    expect(readPngDpi(png)).toBe(300);
    // pHYs justo después de IHDR (8 firma + 25 IHDR)
    expect(String.fromCharCode(...png.subarray(37, 41))).toBe("pHYs");
    const crc = new DataView(png.buffer).getUint32(33 + 17);
    expect(crc).toBe(crc32(png.subarray(37, 50)));
    const again = withPngDpi(png, 150);
    expect(readPngDpi(again)).toBe(150);
    expect(again.length).toBe(png.length);
  });

  it("rechaza lo que no es PNG", () => {
    expect(() => withPngDpi(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 300)).toThrow();
  });
});

describe("packShelves", () => {
  it("coloca sin solapes dentro del ancho y gira piezas altas", () => {
    const { placed, height } = packShelves(
      [{ id: "a", w: 200, h: 80 }, { id: "b", w: 80, h: 150 }, { id: "c", w: 300, h: 60 }, { id: "d", w: 100, h: 100 }],
      560, 6,
    );
    const rects = placed.map((p) => ({ ...p, W: p.rotated ? p.h : p.w, H: p.rotated ? p.w : p.h }));
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(6);
      expect(r.x + r.W).toBeLessThanOrEqual(554);
      expect(r.y + r.H).toBeLessThanOrEqual(height);
    }
    for (const a of rects) for (const b of rects) {
      if (a === b) continue;
      const overlap = a.x < b.x + b.W && b.x < a.x + a.W && a.y < b.y + b.H && b.y < a.y + a.H;
      expect(overlap).toBe(false);
    }
    expect(rects.find((r) => r.id === "b")!.rotated).toBe(true);
  });

  it("falla si una pieza no cabe en el rollo", () => {
    expect(() => packShelves([{ id: "x", w: 600, h: 600 }], 560, 6)).toThrow(/no cabe/);
  });
});

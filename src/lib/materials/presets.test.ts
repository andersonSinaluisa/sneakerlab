import { describe, expect, it } from "vitest";
import { MATERIAL_PRESETS } from "@/lib/model/schema";
import { MATERIAL_PRESET_MAP } from "./presets";

describe("presets de material", () => {
  it("existe un preset por cada id del esquema con valores físicos válidos", () => {
    for (const id of MATERIAL_PRESETS) {
      const p = MATERIAL_PRESET_MAP[id];
      expect(p, id).toBeDefined();
      expect(p.roughness).toBeGreaterThanOrEqual(0);
      expect(p.roughness).toBeLessThanOrEqual(1);
      expect(p.metalness === 0 || p.metalness === 1).toBe(true);
      expect(p.priceFactor).toBeGreaterThan(0);
    }
  });
});

import { describe, expect, it } from "vitest";
import { parseModelConfig } from "./schema";
import config from "@/config/models/sneaker-low-01.json";

describe("configuración de modelos", () => {
  it("el modelo por defecto es válido", () => {
    expect(parseModelConfig(config).zones.length).toBeGreaterThan(5);
  });
  it("exige textura en zonas con imágenes", () => {
    const broken = structuredClone(config) as typeof config;
    delete (broken.zones[0] as { texture?: unknown }).texture;
    expect(() => parseModelConfig(broken)).toThrow(/texture/);
  });
  it("rechaza zonas duplicadas", () => {
    const broken = structuredClone(config);
    broken.zones.push(broken.zones[0]);
    expect(() => parseModelConfig(broken)).toThrow(/duplicada/);
  });
});

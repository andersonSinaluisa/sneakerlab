import { describe, expect, it } from "vitest";
import { deriveStitchColor } from "./compositor";

describe("compositor", () => {
  it("elige hilo oscuro sobre claro y claro sobre oscuro", () => {
    expect(deriveStitchColor("#f2f1ee")).toMatch(/40,36,32/);
    expect(deriveStitchColor("#141414")).toMatch(/255,250,240/);
  });
});

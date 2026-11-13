import { describe, expect, it } from "vitest";
import { pickQualityTier } from "./quality";

describe("tiers de calidad", () => {
  it("GPU por software → low", () => {
    expect(pickQualityTier({ isMobile: false, rendererString: "Google SwiftShader" })).toBe("low");
  });
  it("móvil con poca memoria → low, móvil normal → medium", () => {
    expect(pickQualityTier({ isMobile: true, deviceMemoryGb: 2 })).toBe("low");
    expect(pickQualityTier({ isMobile: true, deviceMemoryGb: 6, maxTextureSize: 8192 })).toBe("medium");
  });
  it("escritorio potente → high", () => {
    expect(pickQualityTier({ isMobile: false, deviceMemoryGb: 16, hardwareConcurrency: 12, rendererString: "NVIDIA" })).toBe("high");
  });
});

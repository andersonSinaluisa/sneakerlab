/**
 * Tiers de calidad de renderizado según dispositivo. Decide DPR, sombras, AO y detalle de
 * materiales. Se resuelve una vez al montar el visor; el usuario puede forzarlo.
 */
import type { QualityTier } from "@/lib/editor/store";

export interface QualitySettings {
  tier: QualityTier;
  dpr: [number, number];
  shadowMapSize: number;
  ambientOcclusion: boolean;
  antialias: "msaa" | "smaa" | "none";
  envResolution: 128 | 256 | 512;
  contactShadowResolution: 256 | 512 | 1024;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: {
    tier: "low",
    dpr: [1, 1.25],
    shadowMapSize: 512,
    ambientOcclusion: false,
    antialias: "msaa",
    envResolution: 128,
    contactShadowResolution: 256,
  },
  medium: {
    tier: "medium",
    dpr: [1, 1.75],
    shadowMapSize: 1024,
    ambientOcclusion: false,
    antialias: "msaa",
    envResolution: 256,
    contactShadowResolution: 512,
  },
  high: {
    tier: "high",
    dpr: [1, 2],
    shadowMapSize: 2048,
    ambientOcclusion: true,
    antialias: "smaa",
    envResolution: 512,
    contactShadowResolution: 1024,
  },
};

export interface DeviceHints {
  isMobile: boolean;
  deviceMemoryGb?: number;
  hardwareConcurrency?: number;
  rendererString?: string;
  maxTextureSize?: number;
}

/** Heurística pura (probable en tests). */
export function pickQualityTier(h: DeviceHints): QualityTier {
  const weakGpu = /swiftshader|llvmpipe|softpipe|mali-4|adreno 3|intel.*hd graphics (3|4)000/i.test(h.rendererString ?? "");
  if (weakGpu) return "low";
  if (h.isMobile) {
    if ((h.deviceMemoryGb ?? 4) <= 3 || (h.maxTextureSize ?? 4096) < 4096) return "low";
    return "medium";
  }
  if ((h.deviceMemoryGb ?? 8) <= 4 || (h.hardwareConcurrency ?? 8) <= 4) return "medium";
  return "high";
}

export function detectDeviceHints(gl?: WebGLRenderingContext | WebGL2RenderingContext | null): DeviceHints {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const ua = nav?.userAgent ?? "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (nav?.maxTouchPoints ?? 0) > 1 && /Mac/.test(ua);
  let rendererString: string | undefined;
  let maxTextureSize: number | undefined;
  if (gl) {
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    rendererString = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : undefined;
    maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  }
  return {
    isMobile,
    deviceMemoryGb: (nav as unknown as { deviceMemory?: number })?.deviceMemory,
    hardwareConcurrency: nav?.hardwareConcurrency,
    rendererString,
    maxTextureSize,
  };
}

/**
 * Presets de materiales PBR. Valores físicos (MeshPhysicalMaterial) + descripción del mapa de
 * detalle procedural que los acompaña. No dependen de Three.js para poder probarse en Node.
 */
import type { MaterialPresetId } from "@/lib/model/schema";

export type DetailPattern = "leatherGrain" | "suedeNap" | "weave" | "knitMesh" | "rubberSpeckle" | "foamCells" | "none";

export interface MaterialPreset {
  id: MaterialPresetId;
  label: string;
  roughness: number;
  metalness: number;
  /** Intensidad del normal map de detalle (0 = sin relieve). */
  normalScale: number;
  /** Repeticiones del detalle por unidad UV (se puede sobreescribir por zona). */
  detailRepeat: number;
  detail: DetailPattern;
  /** Propiedades físicas opcionales */
  sheen?: number;
  sheenRoughness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  specularIntensity?: number;
  /** Multiplicador del color base (tela/gamuza absorben más luz). */
  albedoMultiplier?: number;
  /** Factor de precio relativo, lo consume el motor de cotización en Fase 3. */
  priceFactor: number;
}

export const MATERIAL_PRESET_MAP: Record<MaterialPresetId, MaterialPreset> = {
  leather: {
    id: "leather",
    label: "Cuero sintético",
    roughness: 0.55,
    metalness: 0,
    normalScale: 0.35,
    detailRepeat: 14,
    detail: "leatherGrain",
    clearcoat: 0.12,
    clearcoatRoughness: 0.5,
    specularIntensity: 0.6,
    priceFactor: 1,
  },
  suede: {
    id: "suede",
    label: "Gamuza",
    roughness: 0.92,
    metalness: 0,
    normalScale: 0.25,
    detailRepeat: 18,
    detail: "suedeNap",
    sheen: 0.35,
    sheenRoughness: 0.9,
    specularIntensity: 0.25,
    albedoMultiplier: 0.9,
    priceFactor: 1.15,
  },
  canvas: {
    id: "canvas",
    label: "Lona",
    roughness: 0.85,
    metalness: 0,
    normalScale: 0.55,
    detailRepeat: 48,
    detail: "weave",
    sheen: 0.35,
    sheenRoughness: 0.8,
    specularIntensity: 0.35,
    priceFactor: 0.9,
  },
  mesh: {
    id: "mesh",
    label: "Malla técnica",
    roughness: 0.75,
    metalness: 0,
    normalScale: 0.7,
    detailRepeat: 36,
    detail: "knitMesh",
    sheen: 0.5,
    sheenRoughness: 0.6,
    specularIntensity: 0.4,
    priceFactor: 1.1,
  },
  rubber: {
    id: "rubber",
    label: "Caucho",
    roughness: 0.78,
    metalness: 0,
    normalScale: 0.6,
    detailRepeat: 10,
    detail: "rubberSpeckle",
    specularIntensity: 0.5,
    priceFactor: 1,
  },
  foam: {
    id: "foam",
    label: "Espuma EVA",
    roughness: 0.72,
    metalness: 0,
    normalScale: 0.3,
    detailRepeat: 20,
    detail: "foamCells",
    specularIntensity: 0.35,
    priceFactor: 1,
  },
  lace: {
    id: "lace",
    label: "Cordón textil",
    roughness: 0.8,
    metalness: 0,
    normalScale: 0.8,
    detailRepeat: 6,
    detail: "weave",
    sheen: 0.15,
    sheenRoughness: 0.7,
    priceFactor: 1,
  },
  metal: {
    id: "metal",
    label: "Metal",
    roughness: 0.35,
    metalness: 1,
    normalScale: 0,
    detailRepeat: 1,
    detail: "none",
    priceFactor: 1.2,
  },
};

export const MATERIAL_PRESETS_LIST = Object.values(MATERIAL_PRESET_MAP);

export function getMaterialPreset(id: MaterialPresetId): MaterialPreset {
  return MATERIAL_PRESET_MAP[id];
}

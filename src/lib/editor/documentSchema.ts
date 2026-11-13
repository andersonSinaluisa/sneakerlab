/**
 * Esquema zod del DesignDocument (sin dependencias de navegador): lo usan la persistencia local,
 * la API (validación de entrada) y las pruebas.
 */
import { z } from "zod";
import { DESIGN_SCHEMA_VERSION, type DesignDocument } from "./types";
import { MATERIAL_PRESETS } from "@/lib/model/schema";

const base = {
  id: z.string(),
  name: z.string().max(120),
  shoe: z.enum(["right", "left"]),
  zoneId: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().max(5),
  rotation: z.number().finite(),
  opacity: z.number().min(0).max(1),
  flipX: z.boolean(),
  visible: z.boolean(),
  mask: z.enum(["none", "circle", "rounded", "diamond", "star", "hexagon"]).optional(),
  repeat: z.object({ count: z.number().int().min(1).max(12), gap: z.number().min(0).max(2), direction: z.enum(["horizontal", "vertical"]) }).optional(),
  mirror: z.boolean().optional(),
};
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const layerSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("image"), assetId: z.string(), crop: z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() }).optional() }),
  z.object({
    ...base, kind: z.literal("text"), text: z.string().max(80), font: z.enum(["geist", "geist-mono", "serif", "display", "script", "mono-system"]),
    weight: z.union([z.literal(400), z.literal(600), z.literal(800)]), italic: z.boolean(), size: z.number().positive().max(2),
    letterSpacing: z.number().min(-0.2).max(1), fill: hex, stroke: hex.optional(), strokeWidth: z.number().min(0).max(0.5),
    curve: z.number().min(-1).max(1), align: z.enum(["left", "center", "right"]),
  }),
  z.object({
    ...base, kind: z.literal("pattern"), pattern: z.enum(["stripes", "dots", "checker", "chevron", "stars", "grid", "diagonal", "scales"]),
    colorA: hex, colorB: hex, scale: z.number().positive().max(2), height: z.number().positive().max(3),
  }),
]);

export const documentSchema = z.object({
  schemaVersion: z.literal(DESIGN_SCHEMA_VERSION),
  id: z.string(),
  name: z.string().max(120),
  modelId: z.string(),
  shoes: z.object({
    right: z.object({ zones: z.record(z.string(), z.object({ color: z.string(), material: z.enum(MATERIAL_PRESETS).optional() })) }),
    left: z.object({ zones: z.record(z.string(), z.object({ color: z.string(), material: z.enum(MATERIAL_PRESETS).optional() })) }),
  }),
  layers: z.array(layerSchema),
  assets: z.record(
    z.string(),
    z.object({
      id: z.string(),
      name: z.string(),
      mime: z.string(),
      width: z.number(),
      height: z.number(),
      bytes: z.number(),
      createdAt: z.string(),
      url: z.string().optional(),
      rasterSize: z.number().optional(),
      original: z
        .object({ mime: z.string(), width: z.number(), height: z.number(), bytes: z.number(), url: z.string().optional() })
        .optional(),
    }),
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Migra borradores de versiones anteriores del esquema. */
function migrate(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const d = input as Record<string, unknown>;
  if (d.schemaVersion === 1) {
    // v1 → v2: las capas eran solo de imagen; los campos nuevos son opcionales.
    return { ...d, schemaVersion: 2, layers: (d.layers as unknown[] | undefined)?.map((l) => ({ kind: "image", ...(l as object) })) ?? [] };
  }
  return input;
}

export function parseDocument(input: unknown): DesignDocument | null {
  const r = documentSchema.safeParse(migrate(input));
  return r.success ? (r.data as DesignDocument) : null;
}


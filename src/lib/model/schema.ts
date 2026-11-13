import { z } from "zod";

export const SHOE_SIDES = ["right", "left"] as const;
export type ShoeSide = (typeof SHOE_SIDES)[number];

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hexadecimal #RRGGBB");

export const MATERIAL_PRESETS = ["leather", "suede", "canvas", "mesh", "rubber", "foam", "lace", "metal"] as const;
export type MaterialPresetId = (typeof MATERIAL_PRESETS)[number];

export const zoneConfigSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  meshNames: z.object({ right: z.string().min(1), left: z.string().min(1) }),
  customizable: z.boolean(),
  allowImages: z.boolean(),
  allowText: z.boolean(),
  allowColors: z.boolean(),
  allowMaterials: z.boolean().default(false),
  /** Tamaño de la textura dinámica. Obligatorio si allowImages o allowText. */
  texture: z
    .object({
      width: z.number().int().min(64).max(4096),
      height: z.number().int().min(64).max(4096),
      /** Medida física (mm) de la textura completa en la talla de referencia (`npm run model:print-sizes`). */
      printMm: z.object({ width: z.number().positive(), height: z.number().positive() }).optional(),
    })
    .optional(),
  defaultColor: hexColor,
  /** Rugosidad base; si hay preset de material, este valor la sobreescribe solo si se indica. */
  roughness: z.number().min(0).max(1).optional(),
  /** Preset PBR por defecto de la zona (ver src/lib/materials/presets.ts). */
  material: z.enum(MATERIAL_PRESETS).default("leather"),
  /** Presets que el usuario puede elegir para esta zona (si allowMaterials). */
  materialOptions: z.array(z.enum(MATERIAL_PRESETS)).optional(),
  /** Escala del detalle (grano/tejido) en repeticiones por unidad UV. */
  detailRepeat: z.number().positive().optional(),
  /**
   * Rectángulo UV que ocupa realmente la isla del panel (0..1). Las imágenes se recortan a él y
   * el lienzo lo usa como área útil. Por defecto toda la textura.
   */
  uvIsland: z
    .object({ u0: z.number(), v0: z.number(), u1: z.number(), v1: z.number() })
    .refine((r) => r.u1 > r.u0 && r.v1 > r.v0, "uvIsland inválido")
    .optional(),
  /** Dibuja una línea de costura a X px del borde de la isla UV (solo para islas rectangulares). */
  stitchInset: z.number().min(0).optional(),
  /** Genera un forro interior (cara trasera) para piezas de una sola cara. */
  lining: z.boolean().default(false),
});

export const modelConfigSchema = z
  .object({
    modelId: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    version: z.number().int().positive(),
    provisional: z.boolean().default(false),
    source: z.object({
      type: z.literal("glb"),
      url: z.string().min(1),
      /** El GLB usa compresión Draco / meshopt / texturas KTX2 (activa los decoders). */
      compression: z.array(z.enum(["draco", "meshopt", "ktx2"])).default([]),
    }),
    /** Producción: talla EU que corresponde a la geometría (las piezas impresas escalan desde ella). */
    print: z.object({ referenceSizeEU: z.number().min(30).max(52) }).default({ referenceSizeEU: 42.5 }),
    /** Unidades del modelo: metros por unidad (1 = metros). Solo informativo para el encuadre. */
    unitScale: z.number().positive().default(1),
    /** Mapa HDRI (.hdr/.exr en /public) para la iluminación; si falta se usa el estudio procedural. */
    environment: z.object({ url: z.string().min(1), intensity: z.number().positive().default(1) }).optional(),
    shoes: z.object({
      right: z.object({ nodeName: z.string(), label: z.string() }),
      left: z.object({ nodeName: z.string(), label: z.string() }),
    }),
    /** Opcional: el encuadre se calcula desde el bounding box; esto solo ajusta. */
    layout: z
      .object({
        /** Separación entre zapatos en la vista "ambos", en múltiplos del ancho del zapato. */
        bothShoesGap: z.number().min(0).default(0.25),
        /** Altura del punto de interés como fracción de la altura del modelo (0.45 ≈ centro bajo). */
        focusHeight: z.number().min(0).max(1).default(0.45),
      })
      .default({ bothShoesGap: 0.25, focusHeight: 0.45 }),
    liningColor: hexColor,
    /** Atribución del asset (licencia). Se muestra en el panel de modelos. */
    credits: z.string().optional(),
    zones: z.array(zoneConfigSchema).min(1),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set<string>();
    cfg.zones.forEach((zone, i) => {
      if (ids.has(zone.id)) {
        ctx.addIssue({ code: "custom", message: `Zona duplicada: ${zone.id}`, path: ["zones", i, "id"] });
      }
      ids.add(zone.id);
      if ((zone.allowImages || zone.allowText) && !zone.texture) {
        ctx.addIssue({
          code: "custom",
          message: `La zona ${zone.id} admite imágenes/texto y necesita "texture"`,
          path: ["zones", i, "texture"],
        });
      }
    });
  });

export type ZoneConfig = z.infer<typeof zoneConfigSchema>;
export type ModelConfig = z.infer<typeof modelConfigSchema>;

export function parseModelConfig(input: unknown): ModelConfig {
  const result = modelConfigSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Configuración de modelo inválida: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/**
 * Design Studio — esquema de presets (diseños predefinidos).
 *
 * Un preset es una composición editable: colores y materiales por zona y zapato, y capas de
 * ilustración en el espacio UV de cada zona (mismas coordenadas que el editor). Al aplicarlo se
 * convierte en un DesignDocument normal: no es una imagen plana del zapato.
 */
import { z } from "zod";
import { MATERIAL_PRESETS } from "@/lib/model/schema";

export const DESIGN_CATEGORIES = [
  // Anime y manga (prioritarias)
  { id: "manga-bw", label: "Manga Black & White", group: "anime" },
  { id: "anime-full-color", label: "Anime Full Color", group: "anime" },
  { id: "dark-anime", label: "Dark Anime", group: "anime" },
  { id: "shonen-battle", label: "Shonen Battle", group: "anime" },
  { id: "samurai-anime", label: "Samurai Anime", group: "anime" },
  { id: "cyberpunk-anime", label: "Cyberpunk Anime", group: "anime" },
  { id: "manga-panels", label: "Manga Panels", group: "anime" },
  { id: "anime-eyes", label: "Anime Eyes", group: "anime" },
  { id: "anime-minimalist", label: "Anime Minimalist", group: "anime" },
  { id: "chibi-kawaii", label: "Chibi Kawaii", group: "anime" },
  { id: "mecha-anime", label: "Mecha Anime", group: "anime" },
  { id: "anime-fantasy", label: "Anime Fantasy", group: "anime" },
  { id: "anime-streetwear", label: "Anime Streetwear", group: "anime" },
  { id: "anime-retro-90s", label: "Anime Retro 90s", group: "anime" },
  { id: "anime-graffiti", label: "Anime Graffiti", group: "anime" },
  // Cultura japonesa
  { id: "japanese-dragons", label: "Japanese Dragons", group: "japan" },
  { id: "oni-masks", label: "Oni Masks", group: "japan" },
  { id: "sakura", label: "Sakura", group: "japan" },
  { id: "japanese-waves", label: "Japanese Waves", group: "japan" },
  { id: "kanji-typography", label: "Kanji Typography", group: "japan" },
  // Otros estilos
  { id: "graffiti", label: "Graffiti", group: "urban" },
  { id: "street-art", label: "Street Art", group: "urban" },
  { id: "comic-book", label: "Comic Book", group: "urban" },
  { id: "gothic", label: "Gothic", group: "urban" },
  { id: "minimal-line-art", label: "Minimal Line Art", group: "urban" },
  { id: "neon", label: "Neon", group: "urban" },
  { id: "abstract", label: "Abstract", group: "urban" },
  { id: "gaming", label: "Gaming", group: "urban" },
  { id: "geometric", label: "Geometric", group: "urban" },
  { id: "custom-typography", label: "Custom Typography", group: "urban" },
] as const;

export type DesignCategoryId = (typeof DESIGN_CATEGORIES)[number]["id"];
export const CATEGORY_IDS = DESIGN_CATEGORIES.map((c) => c.id) as [DesignCategoryId, ...DesignCategoryId[]];
export const CATEGORY_GROUPS = { anime: "Anime y manga", japan: "Cultura japonesa", urban: "Otros estilos" } as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const shoe = z.enum(["right", "left"]);

/** Recurso gráfico de un preset. Solo tipos seguros y rasterizables en el cliente. */
export const designAssetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  type: z.enum(["svg", "png", "webp"]),
  /** Ruta pública (/designs/assets/…) o URL del almacenamiento (Fase 3). */
  url: z.string().min(1),
  /** Resolución a la que se rasteriza un SVG (lado mayor). */
  rasterSize: z.number().int().min(256).max(2048).default(1024),
  /** Origen: ilustración original del estudio, subida por admin o generada por IA. */
  license: z.enum(["original", "uploaded", "ai-generated"]).default("original"),
  author: z.string().optional(),
});

export const designZoneSchema = z.object({
  zoneId: z.string(),
  /** Si se omite, aplica a ambos zapatos. */
  shoe: shoe.optional(),
  color: hex.optional(),
  material: z.enum(MATERIAL_PRESETS).optional(),
});

export const designLayerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.literal("image").default("image"),
  name: z.string().optional(),
  assetId: z.string(),
  shoe: shoe.or(z.literal("both")).default("both"),
  zoneId: z.string(),
  x: z.number().min(-0.5).max(1.5).default(0.5),
  y: z.number().min(-0.5).max(1.5).default(0.5),
  width: z.number().positive().max(3).default(0.4),
  rotation: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
  flipX: z.boolean().default(false),
  /** En el zapato izquierdo se voltea horizontalmente para que la composición sea simétrica. */
  mirrorOnLeft: z.boolean().default(false),
});

export const designPresetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(60),
  category: z.enum(CATEGORY_IDS),
  tags: z.array(z.string()).default([]),
  description: z.string().max(240).optional(),
  thumbnailUrl: z.string().optional(),
  previewImages: z.array(z.string()).default([]),
  compatibleModels: z.array(z.string()).min(1),
  colorPalette: z.array(hex).min(1).max(6),
  zones: z.array(designZoneSchema).default([]),
  layers: z.array(designLayerSchema).default([]),
  assets: z.array(designAssetSchema).default([]),
  /**
   * published: visible en el catálogo. draft: completo pero sin publicar.
   * pending-assets: la composición existe pero faltan ilustraciones (no se publica).
   */
  status: z.enum(["published", "draft", "pending-assets"]).default("draft"),
  pendingAssets: z.array(z.string()).default([]),
  badge: z.enum(["new", "popular"]).optional(),
  version: z.number().int().positive().default(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  /** Presets creados por un administrador desde el editor (no forman parte del código). */
  source: z.enum(["builtin", "custom"]).default("builtin"),
});

export type DesignAsset = z.infer<typeof designAssetSchema>;
export type DesignZone = z.infer<typeof designZoneSchema>;
export type DesignLayer = z.infer<typeof designLayerSchema>;
export type SneakerDesignPreset = z.infer<typeof designPresetSchema>;

export function parsePreset(input: unknown): SneakerDesignPreset {
  const r = designPresetSchema.safeParse(input);
  if (!r.success) throw new Error(`Preset inválido: ${z.prettifyError(r.error)}`);
  return r.data;
}

import type { MaterialPresetId, ShoeSide } from "@/lib/model/schema";

export const DESIGN_SCHEMA_VERSION = 2;

/**
 * Metadatos de un recurso de imagen.
 *  - Subido por el usuario: el binario vive en el AssetStore (IndexedDB → S3 en Fase 3).
 *  - De la biblioteca de diseños: `url` apunta al archivo público (SVG/PNG/WebP) y se rasteriza
 *    al cargar; no se duplica en IndexedDB.
 */
export interface AssetRef {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  url?: string;
  /** Lado mayor al rasterizar un SVG (por defecto 1024). */
  rasterSize?: number;
  /**
   * Archivo original subido, sin reducir ni recomprimir. Solo para producción (impresión DTF);
   * el visor usa siempre la versión reducida. En IndexedDB vive bajo `<id>:orig`.
   */
  original?: { mime: string; width: number; height: number; bytes: number; url?: string };
}

/** Máscara de forma aplicada al contenido de una capa (dentro de su caja). */
export type MaskShape = "none" | "circle" | "rounded" | "diamond" | "star" | "hexagon";

/** Recorte del origen de la imagen, en fracciones 0..1 de la imagen original. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Repetición de la capa a lo largo del lienzo (n copias con separación `gap` en fracción del ancho). */
export interface Repeat {
  count: number; // 1 = sin repetición
  gap: number; // fracción del ancho del lienzo entre centros
  direction: "horizontal" | "vertical";
}

/**
 * Propiedades comunes a toda capa, en el espacio de textura normalizado de la zona:
 * x,y ∈ [0,1] origen arriba-izquierda (coinciden con las UV glTF). `width` es fracción del ancho.
 */
export interface LayerBase {
  id: string;
  name: string;
  shoe: ShoeSide;
  zoneId: string;
  x: number;
  y: number;
  width: number;
  rotation: number; // grados
  opacity: number; // 0..1
  flipX: boolean;
  visible: boolean;
  mask?: MaskShape;
  repeat?: Repeat;
  /** Duplica la capa espejada respecto al centro horizontal del lienzo (simetría). */
  mirror?: boolean;
}

export interface ImageLayer extends LayerBase {
  kind: "image";
  assetId: string;
  crop?: Crop;
}

export type FontId = "geist" | "geist-mono" | "serif" | "display" | "script" | "mono-system";

export interface TextLayer extends LayerBase {
  kind: "text";
  text: string;
  font: FontId;
  weight: 400 | 600 | 800;
  italic: boolean;
  /** Alto de la letra en fracción del alto del lienzo. `width` se ignora: lo define el texto. */
  size: number;
  letterSpacing: number; // em
  fill: string;
  stroke?: string;
  strokeWidth: number; // fracción del tamaño
  /** Curvatura: 0 recto; ±1 arco completo hacia arriba/abajo. */
  curve: number;
  align: "left" | "center" | "right";
}

export type PatternId = "stripes" | "dots" | "checker" | "chevron" | "stars" | "grid" | "diagonal" | "scales";

export interface PatternLayer extends LayerBase {
  kind: "pattern";
  pattern: PatternId;
  colorA: string;
  colorB: string;
  /** Tamaño de la celda en fracción del alto del lienzo. */
  scale: number;
  /** Fracción del alto del lienzo que ocupa (1 = toda la zona). `width` fracción del ancho. */
  height: number;
}

export type Layer = ImageLayer | TextLayer | PatternLayer;
export type LayerKind = Layer["kind"];

export interface ZoneState {
  color: string;
  /** Preset de material elegido; si falta se usa el de la configuración de la zona. */
  material?: MaterialPresetId;
}

export interface ShoeState {
  zones: Record<string, ZoneState>;
}

/** Documento editable y serializable. Es lo que se guarda y lo que versiona el historial. */
export interface DesignDocument {
  schemaVersion: typeof DESIGN_SCHEMA_VERSION;
  id: string;
  name: string;
  modelId: string;
  shoes: Record<ShoeSide, ShoeState>;
  /** Orden del array = orden de pintado (el último queda encima) dentro de cada zona. */
  layers: Layer[];
  assets: Record<string, AssetRef>;
  createdAt: string;
  updatedAt: string;
}

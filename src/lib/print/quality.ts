/**
 * Calidad de impresión de una imagen colocada en el editor: ppp efectivos en la talla de
 * referencia del modelo, usando el original si existe. Los SVG escalan sin pérdida.
 */
import type { AssetRef, ImageLayer } from "@/lib/editor/types";
import type { ModelConfig } from "@/lib/model/schema";

export type PrintQuality = { dpi: number; level: "good" | "fair" | "poor" } | null;

type Zone = ModelConfig["zones"][number];

export function imagePrintQuality(layer: ImageLayer, asset: AssetRef | undefined, zone: Zone | undefined): PrintQuality {
  const mm = zone?.texture?.printMm;
  if (!asset || !mm || layer.width <= 0) return null;
  if (asset.mime === "image/svg+xml" || /\.svg($|\?)/i.test(asset.url ?? "")) return { dpi: Infinity, level: "good" };
  const srcPx = (asset.original?.width ?? asset.width) * (layer.crop?.w ?? 1);
  const widthIn = (layer.width * mm.width) / 25.4;
  const dpi = Math.round(srcPx / widthIn);
  return { dpi, level: dpi >= 240 ? "good" : dpi >= 150 ? "fair" : "poor" };
}

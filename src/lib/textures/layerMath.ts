/**
 * Geometría de capas en el espacio de textura (píxeles del lienzo de la zona).
 * Funciones puras: se prueban sin navegador.
 */
import type { ImageLayer, Layer, TextLayer } from "@/lib/editor/types";

export interface Size {
  width: number;
  height: number;
}

export interface LayerBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotationRad: number;
}

export const FONT_STACKS: Record<TextLayer["font"], string> = {
  geist: "var(--font-geist-sans), 'Geist', system-ui, sans-serif",
  "geist-mono": "var(--font-geist-mono), 'Geist Mono', ui-monospace, monospace",
  serif: "Georgia, 'Times New Roman', serif",
  display: "Impact, 'Arial Black', 'Helvetica Neue', sans-serif",
  script: "'Brush Script MT', 'Segoe Script', cursive",
  "mono-system": "ui-monospace, 'Courier New', monospace",
};

/** Aproximación del ancho de un texto sin canvas (para hit-testing y pruebas). */
export function estimateTextWidth(layer: TextLayer, canvas: Size): number {
  const fontPx = layer.size * canvas.height;
  const perChar = layer.font === "geist-mono" || layer.font === "mono-system" ? 0.6 : 0.56;
  const n = layer.text.length || 1;
  return n * fontPx * perChar + Math.max(0, n - 1) * layer.letterSpacing * fontPx;
}

/** Tamaño efectivo de la imagen tras el recorte. */
export function croppedSize(asset: Size, layer: ImageLayer): Size {
  const c = layer.crop;
  if (!c) return asset;
  return { width: Math.max(1, asset.width * c.w), height: Math.max(1, asset.height * c.h) };
}

/** Caja de la capa en píxeles. Imágenes mantienen su proporción (tras el recorte). */
export function layerBox(layer: Layer, canvas: Size, asset?: Size): LayerBox {
  const cx = layer.x * canvas.width;
  const cy = layer.y * canvas.height;
  const rotationRad = (layer.rotation * Math.PI) / 180;
  switch (layer.kind) {
    case "image": {
      const w = layer.width * canvas.width;
      const src = asset ? croppedSize(asset, layer) : { width: 1, height: 1 };
      const h = w * (src.height / src.width);
      return { cx, cy, w, h, rotationRad };
    }
    case "text": {
      const fontPx = layer.size * canvas.height;
      const w = Math.max(fontPx * 0.5, estimateTextWidth(layer, canvas));
      // con curvatura, el texto se eleva: la caja crece verticalmente
      const h = fontPx * 1.25 + Math.abs(layer.curve) * w * 0.35;
      return { cx, cy, w, h, rotationRad };
    }
    case "pattern":
      return { cx, cy, w: layer.width * canvas.width, h: layer.height * canvas.height, rotationRad };
  }
}

/** ¿El punto (px) cae dentro de la capa rotada? */
export function hitTestBox(box: LayerBox, px: number, py: number): boolean {
  const dx = px - box.cx;
  const dy = py - box.cy;
  const cos = Math.cos(-box.rotationRad);
  const sin = Math.sin(-box.rotationRad);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= box.w / 2 && Math.abs(ly) <= box.h / 2;
}

/** Posiciones (en px) de las instancias de una capa según repetición y simetría. */
export function layerInstances(layer: Layer, canvas: Size): { cx: number; cy: number; flip: boolean }[] {
  const base = { cx: layer.x * canvas.width, cy: layer.y * canvas.height };
  const rep = layer.repeat && layer.repeat.count > 1 ? layer.repeat : null;
  const out: { cx: number; cy: number; flip: boolean }[] = [];
  const n = rep ? rep.count : 1;
  for (let i = 0; i < n; i++) {
    const off = rep ? (i - (n - 1) / 2) * rep.gap * canvas.width : 0;
    const cx = rep?.direction === "vertical" ? base.cx : base.cx + off;
    const cy = rep?.direction === "vertical" ? base.cy + off : base.cy;
    out.push({ cx, cy, flip: false });
  }
  if (layer.mirror) {
    for (const inst of [...out]) out.push({ cx: canvas.width - inst.cx, cy: inst.cy, flip: true });
  }
  return out;
}

/**
 * Devuelve la capa superior que contiene el punto UV, o undefined.
 * `layers` en orden de pintado (la última está encima).
 */
export function pickLayerAtUv(
  layers: Layer[],
  uv: { x: number; y: number },
  canvas: Size,
  assetSize: (assetId: string) => Size | undefined,
): Layer | undefined {
  const px = uv.x * canvas.width;
  const py = uv.y * canvas.height;
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible) continue;
    const size = layer.kind === "image" ? assetSize(layer.assetId) : undefined;
    if (layer.kind === "image" && !size) continue;
    const box = layerBox(layer, canvas, size);
    for (const inst of layerInstances(layer, canvas)) {
      if (hitTestBox({ ...box, cx: inst.cx, cy: inst.cy, rotationRad: inst.flip ? -box.rotationRad : box.rotationRad }, px, py)) return layer;
    }
  }
  return undefined;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Ancho inicial razonable: la imagen ocupa ~60% de la altura de la zona. */
export function initialLayerWidth(canvas: Size, asset: Size): number {
  const targetH = canvas.height * 0.6;
  const w = targetH * (asset.width / Math.max(1, asset.height));
  return clamp(w / canvas.width, 0.05, 0.9);
}

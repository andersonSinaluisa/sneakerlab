/**
 * Motor de texturas: compone color base + capas (imagen, texto, patrón) en un lienzo 2D por zona.
 * El lienzo se usa como CanvasTexture del mesh (UV glTF ⇒ flipY = false).
 * No depende de React ni de Three.js.
 */
import type { Layer, MaskShape, PatternLayer, TextLayer } from "@/lib/editor/types";
import { FONT_STACKS, layerBox, layerInstances, type LayerBox, type Size } from "./layerMath";

export interface UvIsland {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface ComposeInput {
  baseColor: string;
  layers: Layer[];
  getImage: (assetId: string) => (CanvasImageSource & Size) | undefined;
  selectedLayerId?: string | null;
  showSelection?: boolean;
  /** Área útil del panel en UV; las capas se recortan a ella. */
  uvIsland?: UvIsland;
  /** Línea de costura a N px del borde de la isla. */
  stitchInset?: number;
  /** Color de la costura (por defecto, derivado del color base). */
  stitchColor?: string;
  /** Fuentes CSS resueltas (en el navegador, `var(--font-…)` no funciona dentro de canvas). */
  resolveFont?: (font: TextLayer["font"]) => string;
}

function islandRect(canvas: Size, island?: UvIsland) {
  const i = island ?? { u0: 0, v0: 0, u1: 1, v1: 1 };
  return { x: i.u0 * canvas.width, y: i.v0 * canvas.height, w: (i.u1 - i.u0) * canvas.width, h: (i.v1 - i.v0) * canvas.height };
}

/** Color de hilo: más oscuro sobre bases claras, más claro sobre bases oscuras. */
export function deriveStitchColor(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "rgba(0,0,0,0.35)";
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 140 ? "rgba(40,36,32,0.38)" : "rgba(255,250,240,0.45)";
}

export function drawStitches(ctx: CanvasRenderingContext2D, canvas: Size, inset: number, color: string, island?: UvIsland) {
  const r = islandRect(canvas, island);
  const scale = canvas.width / 2048;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, 5 * scale);
  ctx.lineCap = "round";
  ctx.setLineDash([Math.max(6, 18 * scale), Math.max(4, 12 * scale)]);
  ctx.strokeRect(r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2);
  ctx.lineWidth = Math.max(1, 2.5 * scale);
  ctx.globalAlpha = 0.6;
  const inset2 = inset + Math.max(6, 16 * scale);
  ctx.strokeRect(r.x + inset2, r.y + inset2, r.w - inset2 * 2, r.h - inset2 * 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Máscaras
// ---------------------------------------------------------------------------
/** Traza la forma de la máscara centrada en el origen, en una caja w×h. */
export function maskPath(ctx: CanvasRenderingContext2D, shape: MaskShape, w: number, h: number) {
  ctx.beginPath();
  const hw = w / 2, hh = h / 2;
  switch (shape) {
    case "circle":
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      break;
    case "rounded": {
      const r = Math.min(hw, hh) * 0.3;
      ctx.roundRect(-hw, -hh, w, h, r);
      break;
    }
    case "diamond":
      ctx.moveTo(0, -hh); ctx.lineTo(hw, 0); ctx.lineTo(0, hh); ctx.lineTo(-hw, 0); ctx.closePath();
      break;
    case "hexagon":
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const x = Math.cos(a) * hw, y = Math.sin(a) * hh;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    case "star":
      for (let i = 0; i < 10; i++) {
        const k = i % 2 === 0 ? 1 : 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = Math.cos(a) * hw * k, y = Math.sin(a) * hh * k;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    default:
      ctx.rect(-hw, -hh, w, h);
  }
}

// ---------------------------------------------------------------------------
// Patrones procedurales (se dibujan en el espacio local de la capa, origen en el centro)
// ---------------------------------------------------------------------------
export function drawPattern(ctx: CanvasRenderingContext2D, layer: PatternLayer, box: LayerBox, canvas: Size) {
  const cell = Math.max(4, layer.scale * canvas.height);
  const { w, h } = box;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  ctx.fillStyle = layer.colorA;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = layer.colorB;
  ctx.strokeStyle = layer.colorB;
  const x0 = -w / 2, y0 = -h / 2;
  const cols = Math.ceil(w / cell) + 2, rows = Math.ceil(h / cell) + 2;
  switch (layer.pattern) {
    case "stripes":
      for (let i = 0; i < cols; i += 2) ctx.fillRect(x0 + i * cell, y0, cell, h);
      break;
    case "diagonal":
      ctx.lineWidth = cell * 0.45;
      for (let i = -rows; i < cols + rows; i += 2) {
        ctx.beginPath(); ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + (i + rows) * cell, y0 + rows * cell); ctx.stroke();
      }
      break;
    case "dots":
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          ctx.beginPath(); ctx.arc(x0 + i * cell + cell / 2 + (j % 2) * cell * 0.5, y0 + j * cell + cell / 2, cell * 0.28, 0, Math.PI * 2); ctx.fill();
        }
      break;
    case "checker":
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if ((i + j) % 2 === 0) ctx.fillRect(x0 + i * cell, y0 + j * cell, cell, cell);
      break;
    case "grid":
      ctx.lineWidth = Math.max(1, cell * 0.12);
      for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + i * cell, y0 + h); ctx.stroke(); }
      for (let j = 0; j <= rows; j++) { ctx.beginPath(); ctx.moveTo(x0, y0 + j * cell); ctx.lineTo(x0 + w, y0 + j * cell); ctx.stroke(); }
      break;
    case "chevron":
      ctx.lineWidth = cell * 0.35;
      ctx.lineJoin = "miter";
      for (let j = -1; j < rows; j++) {
        ctx.beginPath();
        for (let i = 0; i <= cols; i++) {
          const x = x0 + i * cell, y = y0 + j * cell * 1.2 + (i % 2 ? 0 : cell * 0.6);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    case "stars":
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const cx = x0 + i * cell + cell / 2 + (j % 2) * cell * 0.5, cy = y0 + j * cell + cell / 2;
          ctx.beginPath();
          for (let k = 0; k < 10; k++) {
            const r = (k % 2 ? 0.16 : 0.4) * cell, a = -Math.PI / 2 + (k * Math.PI) / 5;
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
            if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath(); ctx.fill();
        }
      break;
    case "scales":
      ctx.lineWidth = Math.max(1, cell * 0.08);
      for (let j = 0; j < rows; j++)
        for (let i = -1; i < cols; i++) {
          const cx = x0 + i * cell + (j % 2) * cell * 0.5, cy = y0 + j * cell * 0.5;
          ctx.beginPath(); ctx.arc(cx, cy, cell * 0.5, 0, Math.PI); ctx.stroke();
        }
      break;
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Texto (recto o en arco)
// ---------------------------------------------------------------------------
export function drawText(ctx: CanvasRenderingContext2D, layer: TextLayer, canvas: Size, resolveFont?: (f: TextLayer["font"]) => string) {
  const fontPx = layer.size * canvas.height;
  const family = resolveFont ? resolveFont(layer.font) : FONT_STACKS[layer.font];
  ctx.font = `${layer.italic ? "italic " : ""}${layer.weight} ${fontPx}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = layer.fill;
  ctx.lineJoin = "round";
  const spacing = layer.letterSpacing * fontPx;
  const chars = [...layer.text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  const strokeW = layer.stroke ? layer.strokeWidth * fontPx : 0;
  if (strokeW) { ctx.strokeStyle = layer.stroke!; ctx.lineWidth = strokeW; }

  const drawChar = (c: string) => {
    if (strokeW) ctx.strokeText(c, 0, 0);
    ctx.fillText(c, 0, 0);
  };

  if (Math.abs(layer.curve) < 0.02) {
    ctx.textAlign = "left";
    let x = -total / 2;
    for (let i = 0; i < chars.length; i++) {
      ctx.save(); ctx.translate(x, 0); drawChar(chars[i]); ctx.restore();
      x += widths[i] + spacing;
    }
    return;
  }
  // Arco: el texto recorre un círculo de radio R; curve>0 curva hacia arriba (sonrisa invertida)
  const sweep = Math.min(Math.PI * 1.6, Math.abs(layer.curve) * Math.PI);
  const R = total / sweep;
  const dir = layer.curve > 0 ? 1 : -1;
  ctx.textAlign = "center";
  let a = -sweep / 2;
  for (let i = 0; i < chars.length; i++) {
    const half = (widths[i] / 2) / R;
    a += half;
    ctx.save();
    // centro del círculo debajo (curve>0) o encima (curve<0) de la línea base
    ctx.translate(Math.sin(a) * R, dir * (R - Math.cos(a) * R) - dir * R * (1 - Math.cos(sweep / 2)) * 0.5);
    ctx.rotate(dir * a);
    drawChar(chars[i]);
    ctx.restore();
    a += half + spacing / R;
  }
}

// ---------------------------------------------------------------------------
// Composición
// ---------------------------------------------------------------------------
function drawLayerContent(ctx: CanvasRenderingContext2D, layer: Layer, box: LayerBox, canvas: Size, input: ComposeInput) {
  if (layer.kind === "image") {
    const img = input.getImage(layer.assetId);
    if (!img) return;
    const c = layer.crop;
    if (c) ctx.drawImage(img, c.x * img.width, c.y * img.height, c.w * img.width, c.h * img.height, -box.w / 2, -box.h / 2, box.w, box.h);
    else ctx.drawImage(img, -box.w / 2, -box.h / 2, box.w, box.h);
  } else if (layer.kind === "pattern") {
    drawPattern(ctx, layer, box, canvas);
  } else {
    drawText(ctx, layer, canvas, input.resolveFont);
  }
}

export function composeZone(ctx: CanvasRenderingContext2D, canvas: Size, input: ComposeInput) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = input.baseColor;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const r = islandRect(canvas, input.uvIsland);
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  for (const layer of input.layers) {
    if (!layer.visible) continue;
    const asset = layer.kind === "image" ? input.getImage(layer.assetId) : undefined;
    if (layer.kind === "image" && !asset) continue;
    const box = layerBox(layer, canvas, asset);
    for (const inst of layerInstances(layer, canvas)) {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.translate(inst.cx, inst.cy);
      ctx.rotate(inst.flip ? -box.rotationRad : box.rotationRad);
      // La copia simétrica espeja posición y giro; los glifos de un texto siguen siendo legibles.
      const flipContent = layer.kind === "text" ? layer.flipX : layer.flipX !== inst.flip;
      if (flipContent) ctx.scale(-1, 1);
      if (layer.mask && layer.mask !== "none") {
        maskPath(ctx, layer.mask, box.w, box.h);
        ctx.clip();
      }
      drawLayerContent(ctx, layer, box, canvas, input);
      ctx.restore();
    }
  }

  if (input.stitchInset) {
    drawStitches(ctx, canvas, input.stitchInset, input.stitchColor ?? deriveStitchColor(input.baseColor), input.uvIsland);
  }

  if (input.showSelection && input.selectedLayerId) {
    const layer = input.layers.find((l) => l.id === input.selectedLayerId && l.visible);
    if (layer) {
      const asset = layer.kind === "image" ? input.getImage(layer.assetId) : undefined;
      if (layer.kind !== "image" || asset) {
        const box = layerBox(layer, canvas, asset);
        ctx.save();
        ctx.translate(box.cx, box.cy);
        ctx.rotate(box.rotationRad);
        const lw = Math.max(3, canvas.width / 400);
        ctx.lineWidth = lw;
        ctx.setLineDash([lw * 4, lw * 3]);
        ctx.strokeStyle = "rgba(37, 99, 235, 0.95)";
        ctx.strokeRect(-box.w / 2, -box.h / 2, box.w, box.h);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

/**
 * Fuentes disponibles para capas de texto. Canvas 2D no resuelve `var(--font-…)`, así que se
 * leen los nombres reales de las variables CSS de next/font una vez en el cliente.
 */
import type { FontId } from "@/lib/editor/types";
import { FONT_STACKS } from "@/lib/textures/layerMath";

export const FONT_OPTIONS: { id: FontId; label: string; sample: string }[] = [
  { id: "display", label: "Display", sample: "Aa" },
  { id: "geist", label: "Geist Sans", sample: "Aa" },
  { id: "geist-mono", label: "Geist Mono", sample: "Aa" },
  { id: "serif", label: "Serif", sample: "Aa" },
  { id: "script", label: "Script", sample: "Aa" },
  { id: "mono-system", label: "Mono", sample: "Aa" },
];

let resolved: Record<string, string> | null = null;

export function resolveCanvasFont(font: FontId): string {
  if (typeof document === "undefined") return FONT_STACKS[font];
  if (!resolved) {
    const cs = getComputedStyle(document.documentElement);
    resolved = {};
    for (const [id, stack] of Object.entries(FONT_STACKS)) {
      resolved[id] = stack.replace(/var\((--[\w-]+)\)/g, (_, v) => cs.getPropertyValue(v).trim() || "sans-serif");
    }
  }
  return resolved[font] ?? FONT_STACKS[font];
}

/** Fuerza la carga de la fuente antes de dibujar (evita el primer render con fallback). */
export async function ensureFontLoaded(font: FontId, weight: number, italic: boolean) {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await document.fonts.load(`${italic ? "italic " : ""}${weight} 32px ${resolveCanvasFont(font)}`);
  } catch {
    /* fallback del sistema */
  }
}

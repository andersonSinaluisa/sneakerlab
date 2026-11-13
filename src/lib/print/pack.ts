/**
 * Colocación de piezas en una hoja de película DTF (rollo de ancho fijo, alto libre).
 * Estantes: piezas ordenadas por alto, de izquierda a derecha; se giran 90° si no caben.
 */

export interface PackItem { id: string; w: number; h: number }
export interface Placed extends PackItem { x: number; y: number; rotated: boolean }

export function packShelves(items: PackItem[], sheetWidth: number, gap: number): { placed: Placed[]; height: number } {
  const sorted = [...items].sort((a, b) => Math.max(b.h, b.w) - Math.max(a.h, a.w));
  const placed: Placed[] = [];
  let x = gap, y = gap, shelf = 0;
  for (const it of sorted) {
    // Orientación: tumbada (más ancha que alta) para gastar menos película; girada si no cabe.
    let w = it.w, h = it.h, rotated = false;
    if ((h > w && h + 2 * gap <= sheetWidth) || w + 2 * gap > sheetWidth) { [w, h] = [h, w]; rotated = true; }
    if (w + 2 * gap > sheetWidth) throw new Error(`La pieza ${it.id} (${it.w}×${it.h}) no cabe en una hoja de ${sheetWidth}`);
    if (x + w + gap > sheetWidth) { x = gap; y += shelf + gap; shelf = 0; }
    placed.push({ ...it, x, y, rotated });
    x += w + gap;
    shelf = Math.max(shelf, h);
  }
  return { placed, height: placed.length ? y + shelf + gap : 0 };
}

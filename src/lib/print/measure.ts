/**
 * Medidas físicas de una zona imprimible a partir de su geometría.
 *
 * Para cada triángulo se resuelve el jacobiano posición→UV (dP/du, dP/dv): su longitud es cuántos
 * metros de superficie recorre la textura completa en horizontal y en vertical. Se toma la mediana
 * ponderada por área UV para que bordes doblados o costuras no la distorsionen.
 * Sin dependencias: lo usan el script de medición (Node) y los tests.
 */

export interface PrintMm {
  width: number;
  height: number;
}

function weightedMedian(values: number[], weights: number[]): number {
  const idx = values.map((_, i) => i).filter((i) => Number.isFinite(values[i]) && weights[i] > 0);
  idx.sort((a, b) => values[a] - values[b]);
  const total = idx.reduce((s, i) => s + weights[i], 0);
  let acc = 0;
  for (const i of idx) {
    acc += weights[i];
    if (acc >= total / 2) return values[i];
  }
  return NaN;
}

/**
 * @param positions xyz en metros (ya en espacio mundo)
 * @param uvs       uv normalizadas 0..1 de la textura de la zona
 * @param index     índices de triángulos (o null si no indexado)
 */
export function measureUvScale(positions: ArrayLike<number>, uvs: ArrayLike<number>, index: ArrayLike<number> | null): PrintMm {
  const tri = index ? index.length / 3 : positions.length / 9;
  const du: number[] = [], dv: number[] = [], w: number[] = [];
  const at = (k: number) => (index ? index[k] : k);
  for (let t = 0; t < tri; t++) {
    const a = at(t * 3), b = at(t * 3 + 1), c = at(t * 3 + 2);
    const e1 = [0, 1, 2].map((k) => positions[b * 3 + k] - positions[a * 3 + k]);
    const e2 = [0, 1, 2].map((k) => positions[c * 3 + k] - positions[a * 3 + k]);
    const u1 = uvs[b * 2] - uvs[a * 2], v1 = uvs[b * 2 + 1] - uvs[a * 2 + 1];
    const u2 = uvs[c * 2] - uvs[a * 2], v2 = uvs[c * 2 + 1] - uvs[a * 2 + 1];
    const det = u1 * v2 - u2 * v1;
    if (Math.abs(det) < 1e-12) continue;
    // [e1 e2] = [Pu Pv] · [[u1 u2],[v1 v2]]  ⇒  Pu = (e1·v2 − e2·v1)/det, Pv = (e2·u1 − e1·u2)/det
    const pu = e1.map((x, k) => (x * v2 - e2[k] * v1) / det);
    const pv = e1.map((x, k) => (e2[k] * u1 - x * u2) / det);
    du.push(Math.hypot(...pu));
    dv.push(Math.hypot(...pv));
    w.push(Math.abs(det) / 2);
  }
  return { width: +(weightedMedian(du, w) * 1000).toFixed(1), height: +(weightedMedian(dv, w) * 1000).toFixed(1) };
}

/** Longitud aproximada de la suela para una talla EU (punto de París 6,67 mm + holgura de horma). */
export function outsoleLengthMm(sizeEU: number): number {
  return sizeEU * (20 / 3) + 17;
}

/** Factor de escala de las piezas al pasar de la talla de referencia del modelo a la del pedido. */
export function sizeScale(sizeEU: number, referenceSizeEU: number): number {
  return outsoleLengthMm(sizeEU) / outsoleLengthMm(referenceSizeEU);
}

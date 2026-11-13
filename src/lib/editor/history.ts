/**
 * Historial Undo/Redo genérico basado en instantáneas inmutables.
 * Con immer las instantáneas comparten estructura, así que el costo es bajo.
 *
 * Gestos continuos (arrastrar, sliders): beginGesture() fija una línea base,
 * los cambios intermedios no generan entradas y endGesture() registra una sola.
 */
export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
  gestureBase: T | null;
}

export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [], gestureBase: null };
}

export function commit<T>(h: HistoryState<T>, next: T): HistoryState<T> {
  if (next === h.present) return h;
  if (h.gestureBase !== null) {
    // dentro de un gesto: solo actualiza el presente
    return { ...h, present: next };
  }
  const past = [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], gestureBase: null };
}

export function beginGesture<T>(h: HistoryState<T>): HistoryState<T> {
  if (h.gestureBase !== null) return h;
  return { ...h, gestureBase: h.present };
}

export function endGesture<T>(h: HistoryState<T>): HistoryState<T> {
  if (h.gestureBase === null) return h;
  if (h.gestureBase === h.present) return { ...h, gestureBase: null };
  const past = [...h.past, h.gestureBase].slice(-HISTORY_LIMIT);
  return { past, present: h.present, future: [], gestureBase: null };
}

export function undo<T>(h: HistoryState<T>): HistoryState<T> {
  const settled = endGesture(h);
  if (settled.past.length === 0) return settled;
  const prev = settled.past[settled.past.length - 1];
  return {
    past: settled.past.slice(0, -1),
    present: prev,
    future: [settled.present, ...settled.future],
    gestureBase: null,
  };
}

export function redo<T>(h: HistoryState<T>): HistoryState<T> {
  const settled = endGesture(h);
  if (settled.future.length === 0) return settled;
  const [next, ...rest] = settled.future;
  return {
    past: [...settled.past, settled.present].slice(-HISTORY_LIMIT),
    present: next,
    future: rest,
    gestureBase: null,
  };
}

/** Reemplaza el documento sin historial (cargar proyecto, nuevo diseño). */
export function reset<T>(present: T): HistoryState<T> {
  return createHistory(present);
}

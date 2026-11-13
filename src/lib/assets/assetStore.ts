/**
 * Almacén de recursos de imagen.
 *  - Persistencia: IndexedDB (Blob) — en la Fase 3 se sustituye por subida a S3
 *    mediante el backend, manteniendo la misma interfaz `AssetRepository`.
 *  - Caché de ejecución: imágenes decodificadas listas para el compositor.
 */
import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import type { AssetRef } from "@/lib/editor/types";
import { createId } from "@/lib/utils/id";
import {
  AssetValidationError,
  sanitizeName,
  validateDimensions,
  validateFileMeta,
  validateSignature,
} from "./validation";

export interface AssetRepository {
  put(id: string, blob: Blob): Promise<void>;
  get(id: string): Promise<Blob | undefined>;
}

export const indexedDbAssetRepository: AssetRepository = {
  put: (id, blob) => idbSet(`sneakerlab:asset:${id}`, blob),
  get: (id) => idbGet<Blob>(`sneakerlab:asset:${id}`),
};

/** Lado mayor máximo tras reducir. Suficiente para texturas de 2048 px. */
export const PROCESSED_MAX_SIDE = 2048;

type Status = "loading" | "ready" | "error";
interface RuntimeAsset {
  status: Status;
  image?: HTMLCanvasElement | HTMLImageElement | ImageBitmap;
  width?: number;
  height?: number;
  url?: string;
}

interface AssetRuntimeState {
  assets: Record<string, RuntimeAsset>;
  set: (id: string, value: RuntimeAsset) => void;
}

export const useAssetRuntime = create<AssetRuntimeState>((set) => ({
  assets: {},
  set: (id, value) => set((s) => ({ assets: { ...s.assets, [id]: value } })),
}));

export function getReadyImage(id: string) {
  const a = useAssetRuntime.getState().assets[id];
  if (a?.status !== "ready" || !a.image) return undefined;
  return a.image;
}

async function decode(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob);
  } catch {
    throw new AssetValidationError("No se pudo decodificar la imagen.");
  }
}

function downscale(bitmap: ImageBitmap): HTMLCanvasElement {
  const scale = Math.min(1, PROCESSED_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // WebP conserva transparencia y pesa menos; si el navegador no lo soporta, devuelve PNG.
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo codificar"))), "image/webp", 0.92);
  });
}

/**
 * Valida, normaliza y guarda una imagen subida. Devuelve la referencia para el documento.
 * Lanza AssetValidationError con un mensaje apto para el usuario.
 */
export async function importImageFile(
  file: File,
  repo: AssetRepository = indexedDbAssetRepository,
): Promise<AssetRef> {
  validateFileMeta(file);
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  validateSignature(head, file.type, file.name);
  const bitmap = await decode(file);
  validateDimensions(bitmap.width, bitmap.height, file.name);
  const bitmapW = bitmap.width, bitmapH = bitmap.height;
  const canvas = downscale(bitmap);
  bitmap.close();
  const blob = await canvasToBlob(canvas);

  const id = createId("ast");
  await repo.put(id, blob);
  // El original se guarda aparte para imprimir a máxima calidad (la versión reducida es para el visor).
  await repo.put(originalKey(id), file);
  useAssetRuntime.getState().set(id, {
    status: "ready",
    image: canvas,
    width: canvas.width,
    height: canvas.height,
    url: URL.createObjectURL(blob),
  });
  return {
    id,
    name: sanitizeName(file.name),
    mime: blob.type,
    width: canvas.width,
    height: canvas.height,
    bytes: blob.size,
    createdAt: new Date().toISOString(),
    original: { mime: file.type, width: bitmapW, height: bitmapH, bytes: file.size },
  };
}

/** Clave del archivo original de un recurso en el repositorio local. */
export const originalKey = (id: string) => `${id}:orig`;

/** Rasteriza una imagen (incluido SVG) desde una URL pública a un canvas del tamaño pedido. */
export async function rasterizeFromUrl(url: string, maxSide = 1024): Promise<HTMLCanvasElement> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Imagen inválida: ${url}`));
      el.src = objectUrl;
    });
    const w0 = img.naturalWidth || maxSide, h0 = img.naturalHeight || maxSide;
    const k = maxSide / Math.max(w0, h0);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w0 * k));
    canvas.height = Math.max(1, Math.round(h0 * k));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const urlLoads = new Map<string, Promise<void>>();

/** Carga (una sola vez por id) un recurso de biblioteca referenciado por URL. */
export function ensureUrlAsset(ref: AssetRef): Promise<void> {
  const runtime = useAssetRuntime.getState();
  if (runtime.assets[ref.id]?.status === "ready") return Promise.resolve();
  const pending = urlLoads.get(ref.id);
  if (pending) return pending;
  const p = (async () => {
    runtime.set(ref.id, { status: "loading" });
    try {
      const canvas = await rasterizeFromUrl(ref.url!, ref.rasterSize ?? 1024);
      useAssetRuntime.getState().set(ref.id, {
        status: "ready",
        image: canvas,
        width: canvas.width,
        height: canvas.height,
        url: ref.url,
      });
    } catch (e) {
      useAssetRuntime.getState().set(ref.id, { status: "error" });
      throw e;
    } finally {
      urlLoads.delete(ref.id);
    }
  })();
  urlLoads.set(ref.id, p);
  return p;
}

/** Carga en memoria los recursos referenciados por un documento restaurado. */
export async function hydrateAssets(
  refs: AssetRef[],
  repo: AssetRepository = indexedDbAssetRepository,
): Promise<string[]> {
  const missing: string[] = [];
  const runtime = useAssetRuntime.getState();
  await Promise.all(
    refs.map(async (ref) => {
      if (runtime.assets[ref.id]?.status === "ready") return;
      if (ref.url) {
        try {
          await ensureUrlAsset(ref);
        } catch {
          missing.push(ref.id);
        }
        return;
      }
      runtime.set(ref.id, { status: "loading" });
      try {
        const blob = await repo.get(ref.id);
        if (!blob) throw new Error("missing");
        const bitmap = await createImageBitmap(blob);
        const canvas = downscale(bitmap);
        bitmap.close();
        runtime.set(ref.id, {
          status: "ready",
          image: canvas,
          width: canvas.width,
          height: canvas.height,
          url: URL.createObjectURL(blob),
        });
      } catch {
        runtime.set(ref.id, { status: "error" });
        missing.push(ref.id);
      }
    }),
  );
  return missing;
}

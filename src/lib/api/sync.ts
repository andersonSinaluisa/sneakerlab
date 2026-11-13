/**
 * Sincronización del documento con el servidor.
 * Las imágenes subidas por el usuario viven en IndexedDB (sin `url`); antes de guardar en la nube
 * se suben al almacenamiento del API y la referencia recibe su `url` pública, conservando el id
 * para que las capas no cambien. Al abrir un diseño remoto, `hydrateAssets` ya resuelve por `url`.
 */
import type { DesignDocument } from "@/lib/editor/types";
import { indexedDbAssetRepository, originalKey } from "@/lib/assets/assetStore";
import { assetsApi } from "./client";

/** Sube el original (para imprimir). Si el servidor lo rechaza (p. ej. por tamaño), se sigue sin él. */
async function uploadOriginal(id: string, ref: DesignDocument["assets"][string]) {
  if (!ref.original || ref.original.url) return ref.original;
  const blob = await indexedDbAssetRepository.get(originalKey(id));
  if (!blob) return ref.original;
  try {
    const remote = await assetsApi.upload(blob, { name: ref.name, width: ref.original.width, height: ref.original.height });
    return { ...ref.original, url: remote.url };
  } catch (e) {
    console.warn(`[Hecho a Pie] Original de "${ref.name}" no subido; se imprimirá con la versión reducida`, e);
    return ref.original;
  }
}

export async function syncAssetsToCloud(doc: DesignDocument): Promise<DesignDocument> {
  const used = new Set(doc.layers.flatMap((l) => (l.kind === "image" ? [l.assetId] : [])));
  const assets = { ...doc.assets };
  for (const id of used) {
    const ref = assets[id];
    if (!ref) continue;
    if (ref.url && !ref.url.startsWith("blob:")) {
      if (ref.original && !ref.original.url) assets[id] = { ...ref, original: await uploadOriginal(id, ref) };
      continue;
    }
    const blob = await indexedDbAssetRepository.get(id);
    if (!blob) throw new Error(`La imagen "${ref.name}" no está disponible en este dispositivo`);
    const remote = await assetsApi.upload(blob, { name: ref.name, width: ref.width, height: ref.height });
    assets[id] = { ...ref, url: remote.url, mime: remote.mime, bytes: remote.bytes, original: await uploadOriginal(id, ref) };
  }
  // Recursos no usados por ninguna capa no se suben ni se guardan.
  for (const id of Object.keys(assets)) if (!used.has(id)) delete assets[id];
  return { ...doc, assets };
}

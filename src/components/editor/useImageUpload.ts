import { useCallback, useState } from "react";
import { toast } from "sonner";
import { importImageFile } from "@/lib/assets/assetStore";
import { AssetValidationError } from "@/lib/assets/validation";
import { useEditor } from "@/lib/editor/store";

/** Importa archivos, los registra en el documento y opcionalmente aplica el primero a la zona activa. */
export function useImageUpload() {
  const [busy, setBusy] = useState(false);

  const upload = useCallback(async (files: FileList | File[], applyFirst: boolean) => {
    const list = Array.from(files).slice(0, 10);
    if (!list.length) return;
    setBusy(true);
    let applied = false;
    try {
      for (const file of list) {
        try {
          const asset = await importImageFile(file);
          const s = useEditor.getState();
          s.registerAsset(asset);
          if (applyFirst && !applied) {
            applied = s.addImageLayer(asset.id) !== null;
            if (!applied) toast.info("Selecciona una zona que admita imágenes para aplicarla.");
          }
        } catch (err) {
          toast.error(err instanceof AssetValidationError ? err.message : `No se pudo importar "${file.name}".`);
        }
      }
    } finally {
      setBusy(false);
    }
  }, []);

  return { upload, busy };
}

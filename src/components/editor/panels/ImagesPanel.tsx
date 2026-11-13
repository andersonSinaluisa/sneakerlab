import { useRef } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { useAssetRuntime } from "@/lib/assets/assetStore";
import { ACCEPTED_MIME, MAX_UPLOAD_BYTES } from "@/lib/assets/validation";
import { useDoc, useEditor, useModel } from "@/lib/editor/store";
import { getZone } from "@/lib/model/registry";
import { PanelSection } from "@/components/ui/field";
import { ASSET_DRAG_MIME } from "@/components/viewer/interaction";
import { useImageUpload } from "../useImageUpload";
import { cn } from "@/lib/utils/cn";

export function ImagesPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, busy } = useImageUpload();
  const doc = useDoc();
  const model = useModel();
  const runtime = useAssetRuntime((s) => s.assets);
  const zoneId = useEditor((s) => s.selectedZoneId);
  const shoe = useEditor((s) => s.activeShoe);
  const zone = zoneId ? getZone(model, zoneId) : undefined;
  const canApply = Boolean(zone?.allowImages);
  const assets = Object.values(doc.assets).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <PanelSection title="Subir imágenes">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void upload(e.dataTransfer.files, canApply);
          }}
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 px-4 py-6 text-center transition-colors hover:border-neutral-400 hover:bg-neutral-50"
        >
          {busy ? <Loader2 className="size-5 animate-spin text-neutral-500" /> : <ImagePlus className="size-5 text-neutral-500" />}
          <span className="text-[13px] font-medium text-neutral-800">
            {busy ? "Procesando…" : "Elegir o soltar archivos"}
          </span>
          <span className="text-[11px] text-neutral-400">
            PNG, JPG o WebP · máx. {MAX_UPLOAD_BYTES / 1024 / 1024} MB
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME.join(",")}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files, canApply);
            e.target.value = "";
          }}
        />
        <p className="text-[11px] leading-relaxed text-neutral-400">
          {canApply ? (
            <>
              Se aplicará en <b className="font-medium text-neutral-600">{zone?.label.toLowerCase()}</b> del zapato{" "}
              {model.shoes[shoe].label.toLowerCase()}. También puedes arrastrarla directamente sobre el modelo.
            </>
          ) : (
            "Selecciona en el modelo una zona que admita imágenes (laterales, punta, talón o lengüeta)."
          )}
        </p>
      </PanelSection>

      <PanelSection title={`Biblioteca (${assets.length})`}>
        {assets.length === 0 ? (
          <p className="text-xs text-neutral-400">Tus imágenes aparecerán aquí para reutilizarlas.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {assets.map((a) => {
              const rt = runtime[a.id];
              return (
                <button
                  key={a.id}
                  type="button"
                  draggable={rt?.status === "ready"}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(ASSET_DRAG_MIME, a.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => {
                    if (!canApply) return;
                    useEditor.getState().addImageLayer(a.id);
                  }}
                  title={canApply ? `Aplicar "${a.name}"` : a.name}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-[conic-gradient(#f4f4f5_25%,#fff_0_50%,#f4f4f5_0_75%,#fff_0)] bg-[length:12px_12px]",
                    canApply && "hover:border-neutral-900",
                  )}
                >
                  {rt?.url ? (
                    <img src={rt.url} alt={a.name} className="size-full object-contain p-1" draggable={false} />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-400">
                      {rt?.status === "error" ? "No disponible" : "…"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-neutral-400">
          Sube solo ilustraciones propias o con licencia de uso. Personajes protegidos por derechos de autor
          requieren autorización del titular para su fabricación.
        </p>
      </PanelSection>
    </>
  );
}

import { ChevronDown, ChevronUp, Eye, EyeOff, Shapes, Trash2, Type } from "lucide-react";
import { useAssetRuntime } from "@/lib/assets/assetStore";
import { useDoc, useEditor, useModel } from "@/lib/editor/store";
import { PanelSection } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function LayersPanel() {
  const doc = useDoc();
  const model = useModel();
  const shoe = useEditor((s) => s.activeShoe);
  const selected = useEditor((s) => s.selectedLayerId);
  const runtime = useAssetRuntime((s) => s.assets);
  const zones = model.zones.filter((z) => z.allowImages);
  const s = useEditor.getState;

  const total = doc.layers.filter((l) => l.shoe === shoe).length;

  return (
    <PanelSection title={`Capas · zapato ${model.shoes[shoe].label.toLowerCase()}`}>
      {total === 0 && <p className="text-xs text-neutral-400">Aún no hay imágenes en este zapato.</p>}
      {zones.map((zone) => {
        // Se muestran de arriba (encima) a abajo
        const layers = doc.layers.filter((l) => l.shoe === shoe && l.zoneId === zone.id).reverse();
        if (!layers.length) return null;
        return (
          <div key={zone.id} className="space-y-1">
            <div className="text-[11px] font-medium text-neutral-500">{zone.label}</div>
            {layers.map((l, i) => (
              <div
                key={l.id}
                onClick={() => s().selectLayer(l.id)}
                className={cn(
                  "group flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5",
                  l.id === selected ? "border-neutral-900 bg-neutral-50" : "border-transparent hover:bg-neutral-50",
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border border-neutral-200 bg-white text-neutral-500">
                  {l.kind === "image" && runtime[l.assetId]?.url ? (
                    <img src={runtime[l.assetId]!.url} alt="" className="size-full object-contain" />
                  ) : l.kind === "text" ? (
                    <Type className="size-4" />
                  ) : l.kind === "pattern" ? (
                    <span className="size-full" style={{ background: `repeating-linear-gradient(45deg, ${l.colorA} 0 4px, ${l.colorB} 4px 8px)` }} />
                  ) : (
                    <Shapes className="size-4" />
                  )}
                </div>
                <span className={cn("min-w-0 flex-1 truncate text-xs", !l.visible && "text-neutral-400")}>{l.name}</span>
                <div className="flex opacity-60 group-hover:opacity-100">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Subir capa"
                    disabled={i === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      s().reorderLayer(l.id, "up");
                    }}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Bajar capa"
                    disabled={i === layers.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      s().reorderLayer(l.id, "down");
                    }}
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={l.visible ? "Ocultar" : "Mostrar"}
                    onClick={(e) => {
                      e.stopPropagation();
                      s().updateLayer(l.id, { visible: !l.visible });
                    }}
                  >
                    {l.visible ? <Eye /> : <EyeOff />}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="destructive"
                    aria-label="Eliminar"
                    onClick={(e) => {
                      e.stopPropagation();
                      s().removeLayer(l.id);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </PanelSection>
  );
}

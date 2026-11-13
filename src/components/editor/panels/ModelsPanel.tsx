import { Check } from "lucide-react";
import { listModels } from "@/lib/model/registry";
import { useDoc, useEditor } from "@/lib/editor/store";
import { cn } from "@/lib/utils/cn";
import { Badge, PanelSection } from "@/components/ui/field";

export function ModelsPanel() {
  const doc = useDoc();
  return (
    <PanelSection title="Modelos">
      {listModels().map((m) => {
        const custom = m.zones.filter((z) => z.customizable);
        const active = doc.modelId === m.modelId;
        return (
          <button
            type="button"
            key={m.modelId}
            onClick={() => useEditor.getState().switchModel(m.modelId)}
            className={cn(
              "w-full rounded-xl border p-3 text-left transition-colors",
              active ? "border-neutral-900" : "border-neutral-200 hover:border-neutral-400",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-900">{m.name}</div>
              {active && <Check className="size-4" />}
            </div>
            <div className="mt-1 flex gap-1">
              <Badge>Zapatilla baja</Badge>
              {m.provisional && <Badge tone="amber">Modelo provisional</Badge>}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
              {custom.length} zonas personalizables:{" "}
              {custom.map((z) => z.label.toLowerCase()).join(", ")}.
            </p>
            {m.provisional && (
              <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
                Geometría generada por código, solo como referencia de desarrollo.
              </p>
            )}
            {m.credits && <p className="mt-2 text-[10px] leading-relaxed text-neutral-400">{m.credits}</p>}
          </button>
        );
      })}
      <p className="text-[11px] text-neutral-400">Al cambiar de modelo se conservan colores e imágenes de las zonas equivalentes.</p>
    </PanelSection>
  );
}

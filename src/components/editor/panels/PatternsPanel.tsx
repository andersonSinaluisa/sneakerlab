import { useEditor, useModel } from "@/lib/editor/store";
import { getZone } from "@/lib/model/registry";
import type { PatternId } from "@/lib/editor/types";
import { PanelSection } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";

export const PATTERNS: { id: PatternId; label: string; css: (a: string, b: string) => string }[] = [
  { id: "stripes", label: "Rayas", css: (a, b) => `repeating-linear-gradient(90deg, ${b} 0 8px, ${a} 8px 16px)` },
  { id: "diagonal", label: "Diagonal", css: (a, b) => `repeating-linear-gradient(45deg, ${b} 0 6px, ${a} 6px 16px)` },
  { id: "dots", label: "Lunares", css: (a, b) => `radial-gradient(circle, ${b} 30%, ${a} 32%) 0 0/14px 14px` },
  { id: "checker", label: "Damero", css: (a, b) => `repeating-conic-gradient(${b} 0 25%, ${a} 0 50%) 0 0/16px 16px` },
  { id: "chevron", label: "Chevron", css: (a, b) => `repeating-linear-gradient(135deg, ${b} 0 5px, ${a} 5px 12px)` },
  { id: "stars", label: "Estrellas", css: (a, b) => `radial-gradient(circle, ${b} 22%, ${a} 24%) 0 0/16px 16px` },
  { id: "grid", label: "Cuadrícula", css: (a, b) => `linear-gradient(${b} 2px, transparent 2px) 0 0/12px 12px, linear-gradient(90deg, ${b} 2px, ${a} 2px) 0 0/12px 12px` },
  { id: "scales", label: "Escamas", css: (a, b) => `radial-gradient(circle at 50% 100%, ${a} 40%, ${b} 42%, ${b} 48%, transparent 50%) 0 0/16px 16px` },
];

export function PatternsPanel() {
  const model = useModel();
  const zoneId = useEditor((s) => s.selectedZoneId);
  const shoe = useEditor((s) => s.activeShoe);
  const zone = zoneId ? getZone(model, zoneId) : undefined;
  const can = Boolean(zone?.allowImages);
  const base = useEditor((s) => (zoneId ? s.history.present.shoes[shoe].zones[zoneId]?.color : "#ffffff")) ?? "#ffffff";
  const s = useEditor.getState;
  const zones = model.zones.filter((z) => z.allowImages);

  return (
    <>
      <PanelSection title="Zona">
        <div className="flex flex-wrap gap-1.5">
          {zones.map((z) => (
            <button key={z.id} type="button" onClick={() => s().selectZone(z.id)} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", z.id === zoneId ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400")}>
              {z.label}
            </button>
          ))}
        </div>
      </PanelSection>
      <PanelSection title="Patrones">
        <div className="grid grid-cols-2 gap-2">
          {PATTERNS.map((p) => (
            <button key={p.id} type="button" disabled={!can} onClick={() => s().addPatternLayer(p.id)} className="overflow-hidden rounded-xl border border-neutral-200 text-left hover:border-neutral-900 disabled:opacity-40">
              <div className="h-14" style={{ background: p.css(base, "#111111") }} />
              <div className="px-2 py-1.5 text-xs font-medium text-neutral-800">{p.label}</div>
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-neutral-400">
          {can ? "El patrón cubre la zona y se coloca debajo de imágenes y textos. Ajusta colores, escala, repetición y simetría en Propiedades." : "Selecciona una zona que admita patrones (laterales, punta, talón o lengüeta)."}
        </p>
      </PanelSection>
    </>
  );
}

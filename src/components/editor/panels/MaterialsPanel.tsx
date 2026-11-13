import { Link2 } from "lucide-react";
import { useEditor, useModel } from "@/lib/editor/store";
import { getZone } from "@/lib/model/registry";
import { MATERIAL_PRESETS_LIST, getMaterialPreset } from "@/lib/materials/presets";
import { Badge, PanelSection } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";

const DESCRIPTIONS: Record<string, string> = {
  leather: "Grano fino, brillo moderado con capa protectora.",
  suede: "Mate y aterciopelado, absorbe la luz.",
  canvas: "Tejido visible, acabado mate.",
  mesh: "Malla técnica transpirable con relieve marcado.",
  rubber: "Caucho con micro‑relieve, brillo bajo.",
  foam: "Espuma EVA de celda cerrada, ligera.",
  lace: "Cordón textil trenzado.",
  metal: "Metal pulido.",
};

export function MaterialsPanel() {
  const model = useModel();
  const zoneId = useEditor((s) => s.selectedZoneId);
  const shoe = useEditor((s) => s.activeShoe);
  const link = useEditor((s) => s.linkShoes);
  const zones = model.zones.filter((z) => z.customizable && z.allowMaterials);
  const zone = zoneId ? getZone(model, zoneId) : undefined;
  const current = useEditor((s) => (zoneId ? s.history.present.shoes[shoe].zones[zoneId]?.material : undefined)) ?? zone?.material;
  const options = zone?.materialOptions ?? MATERIAL_PRESETS_LIST.map((m) => m.id);

  return (
    <>
      <PanelSection title="Zona">
        <div className="flex flex-wrap gap-1.5">
          {zones.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => useEditor.getState().selectZone(z.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                z.id === zoneId ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400",
              )}
            >
              {z.label}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
          <input type="checkbox" checked={link} onChange={(e) => useEditor.getState().setLinkShoes(e.target.checked)} className="size-3.5 accent-neutral-900" />
          <Link2 className="size-3.5" /> Aplicar a ambos zapatos
        </label>
      </PanelSection>

      {zone?.allowMaterials ? (
        <PanelSection title={`Material · ${zone.label}`}>
          <div className="space-y-1.5">
            {options.map((id) => {
              const p = getMaterialPreset(id);
              const active = id === current;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => useEditor.getState().setZoneMaterial(zone.id, id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-2.5 text-left transition-colors",
                    active ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400",
                  )}
                >
                  <MaterialSwatch id={id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-neutral-900">{p.label}</span>
                      {p.priceFactor !== 1 && <Badge tone="blue">{p.priceFactor > 1 ? "+" : "−"}{Math.round(Math.abs(p.priceFactor - 1) * 100)}%</Badge>}
                    </div>
                    <p className="text-[11px] leading-snug text-neutral-500">{DESCRIPTIONS[id]}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-400">
            El material cambia la respuesta a la luz (rugosidad, relieve, brillo) sin tocar tu diseño impreso.
          </p>
        </PanelSection>
      ) : (
        <PanelSection>
          <p className="text-xs text-neutral-400">Selecciona una zona que admita cambio de material.</p>
        </PanelSection>
      )}
    </>
  );
}

/** Muestra procedural del acabado (sin cargar texturas). */
function MaterialSwatch({ id }: { id: string }) {
  const p = getMaterialPreset(id as Parameters<typeof getMaterialPreset>[0]);
  const gloss = 1 - p.roughness;
  const style: React.CSSProperties = {
    background:
      p.metalness > 0.5
        ? "linear-gradient(135deg,#f4f4f4 0%,#9a9a9a 45%,#e8e8e8 55%,#6f6f6f 100%)"
        : `radial-gradient(circle at 30% 25%, rgba(255,255,255,${0.25 + gloss * 0.7}) 0%, rgba(255,255,255,0) 45%), #c9c4bb`,
    backgroundImage:
      p.detail === "weave"
        ? `repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0 1px, transparent 1px 3px), radial-gradient(circle at 30% 25%, rgba(255,255,255,${0.2 + gloss * 0.5}) 0%, rgba(255,255,255,0) 45%)`
        : undefined,
  };
  return <span className="mt-0.5 size-9 shrink-0 rounded-lg border border-black/10 bg-[#c9c4bb]" style={style} aria-hidden />;
}

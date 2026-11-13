import { useEffect, useState } from "react";
import { ArrowLeft, Heart, Layers3, Wand2 } from "lucide-react";
import { useDesignStudio } from "@/lib/designs/store";
import { useCategory } from "@/lib/designs/categories";
import { getMaterialPreset } from "@/lib/materials/presets";
import { useModel } from "@/lib/editor/store";
import { checkCompatibility } from "@/lib/designs/apply";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import { PaletteDots, Thumb } from "./DesignStudio";

const VIEW_LABELS: Record<string, string> = { hero: "Perspectiva 3/4", outer: "Lateral exterior", inner: "Lateral interior", back: "Posterior", both: "Ambos zapatos" };

export function DesignDetail({ presetId }: { presetId: string }) {
  const s = useDesignStudio();
  const model = useModel();
  const preset = s.byId(presetId);
  const [view, setView] = useState(0);
  const [combineOpen, setCombineOpen] = useState(false);

  useEffect(() => {
    if (preset) void s.preload(preset.id);
  }, [preset, s]);

  const cat = useCategory(preset?.category);
  if (!preset) return null;
  const fav = s.favorites.includes(preset.id);
  const compat = checkCompatibility(preset, model);
  const views = preset.previewImages.length ? preset.previewImages : preset.thumbnailUrl ? [preset.thumbnailUrl] : [];
  const materials = [...new Set(preset.zones.map((z) => z.material).filter(Boolean))] as string[];
  const zonesUsed = [...new Set(preset.layers.map((l) => l.zoneId))];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-200/80 bg-white/80 px-4 py-3 lg:px-6">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => s.openDetail(null)} aria-label="Volver al catálogo">
          <ArrowLeft />
        </Button>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold tracking-tight text-neutral-900">{preset.name}</div>
          <div className="text-xs text-neutral-500">{cat?.label}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => s.toggleFavorite(preset.id)} aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}>
            <Heart className={cn(fav && "fill-current text-rose-600")} />
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_360px]">
        {/* Previsualizaciones renderizadas con el modelo real */}
        <div className="flex flex-col gap-3 p-4 lg:p-6">
          <div className="group relative aspect-[4/3] max-h-[52vh] w-full overflow-hidden rounded-2xl border border-neutral-200/80 bg-[#e9e7e2]">
            <Thumb src={views[view]} alt={`${preset.name} — ${VIEW_LABELS[viewKey(views[view])] ?? ""}`} className="object-contain group-hover:scale-100" />
            <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-medium text-neutral-700 backdrop-blur">
              {VIEW_LABELS[viewKey(views[view])] ?? "Vista"}
            </span>
          </div>
          {views.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {views.map((v, i) => (
                <button key={v} type="button" onClick={() => setView(i)} className={cn("relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-xl border bg-[#e9e7e2]", i === view ? "border-neutral-900" : "border-neutral-200")} aria-label={VIEW_LABELS[viewKey(v)]}>
                  <Thumb src={v} alt="" className="group-hover:scale-100" />
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-neutral-400">
            Renders del modelo 3D real con las texturas del editor. Usa «Previsualizar en 3D» para verlo en vivo y girarlo.
          </p>
        </div>

        {/* Ficha y acciones */}
        <aside className="flex flex-col gap-4 border-t border-neutral-200/80 bg-white/70 p-4 lg:border-l lg:border-t-0 lg:p-6">
          <div className="flex items-center gap-2">
            {preset.badge && <Badge tone={preset.badge === "popular" ? "amber" : "blue"}>{preset.badge === "popular" ? "Popular" : "Nuevo"}</Badge>}
            {preset.source === "custom" && <Badge>Plantilla propia</Badge>}
          </div>
          {preset.description && <p className="text-[13px] leading-relaxed text-neutral-600">{preset.description}</p>}

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Paleta</div>
            <div className="flex items-center gap-2">
              <PaletteDots palette={preset.colorPalette} size="md" />
              <span className="font-mono text-[11px] text-neutral-400">{preset.colorPalette.join(" · ")}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <Fact label="Zonas con ilustración" value={zonesUsed.map((z) => model.zones.find((m) => m.id === z)?.label ?? z).join(", ") || "—"} />
            <Fact label="Materiales" value={materials.map((m) => getMaterialPreset(m as never).label).join(", ") || "Por defecto"} />
            <Fact label="Ilustraciones" value={`${preset.assets.length} originales`} />
            <Fact label="Modelo" value={preset.compatibleModels.join(", ")} />
          </div>
          {preset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {preset.tags.map((t) => <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">#{t}</span>)}
            </div>
          )}

          {!compat.ok && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              {compat.errors[0]} Al aplicar se cambiará al modelo compatible.
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button className="h-11 rounded-xl text-[14px]" onClick={() => void s.apply(preset.id, { mode: "apply" })} disabled={s.applying !== null}>
              <Wand2 /> {s.applying === preset.id ? "Aplicando…" : "Aplicar diseño"}
            </Button>
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => void s.apply(preset.id, { mode: "customize" })} disabled={s.applying !== null}>
              Personalizar este diseño
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" size="sm" onClick={() => void s.apply(preset.id, { mode: "apply" }).then(() => undefined)}>
                Previsualizar en 3D
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCombineOpen(!combineOpen)}>
                <Layers3 /> Combinar…
              </Button>
            </div>
            {combineOpen && (
              <div className="rounded-xl border border-neutral-200 p-3 text-[12px] text-neutral-600">
                <p className="mb-2">Aplica este diseño a un solo zapato para combinarlo con el que ya tienes en el otro.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => void s.apply(preset.id, { mode: "combine", target: "left" })}>Solo izquierdo</Button>
                  <Button variant="outline" size="sm" onClick={() => void s.apply(preset.id, { mode: "combine", target: "right" })}>Solo derecho</Button>
                </div>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-neutral-400">
              El diseño original no se modifica: trabajas sobre una copia editable que puedes guardar como variante. Deshacer (Ctrl+Z) restaura tu diseño anterior.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function viewKey(url?: string) {
  return url?.split("/").pop()?.replace(/\.\w+$/, "") ?? "";
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{label}</div>
      <div className="text-neutral-800">{value}</div>
    </div>
  );
}

import { useEffect } from "react";
import { Heart, LayoutGrid } from "lucide-react";
import { useDesignStudio } from "@/lib/designs/store";
import { DESIGN_CATEGORIES } from "@/lib/designs/schema";
import { PanelSection } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Thumb } from "@/components/designs/DesignStudio";

/** Panel lateral compacto: acceso al catálogo completo y accesos rápidos (favoritos y destacados). */
export function DesignsPanel() {
  const s = useDesignStudio();
  useEffect(() => { void s.hydrate(); }, [s]);
  const published = s.published();
  const favorites = published.filter((p) => s.favorites.includes(p.id));
  const featured = published.filter((p) => p.badge === "popular").slice(0, 6);

  return (
    <>
      <PanelSection title="Diseños predefinidos">
        <Button className="w-full" onClick={() => s.setOpen(true)}>
          <LayoutGrid /> Abrir catálogo ({published.length})
        </Button>
        <p className="text-[11px] leading-relaxed text-neutral-400">
          Diseños originales con estética anime, manga y japonesa listos para aplicar con un clic y seguir editando.
        </p>
      </PanelSection>
      {favorites.length > 0 && (
        <PanelSection title={`Favoritos (${favorites.length})`}>
          <QuickGrid ids={favorites.map((p) => p.id)} />
        </PanelSection>
      )}
      <PanelSection title="Destacados">
        <QuickGrid ids={featured.map((p) => p.id)} />
      </PanelSection>
    </>
  );
}

function QuickGrid({ ids }: { ids: string[] }) {
  const s = useDesignStudio();
  return (
    <div className="grid grid-cols-2 gap-2">
      {ids.map((id) => {
        const p = s.byId(id)!;
        const cat = DESIGN_CATEGORIES.find((c) => c.id === p.category);
        return (
          <button key={id} type="button" onClick={() => { s.setOpen(true); s.openDetail(id); }} className="group overflow-hidden rounded-xl border border-neutral-200 bg-white text-left hover:border-neutral-400">
            <div className="relative aspect-[4/3] bg-[#e9e7e2]">
              <Thumb src={p.thumbnailUrl} alt={p.name} />
              {s.favorites.includes(id) && <Heart className="absolute right-1.5 top-1.5 size-3.5 fill-current text-rose-600" />}
            </div>
            <div className="px-2 py-1.5">
              <div className="truncate text-[12px] font-medium text-neutral-900">{p.name}</div>
              <div className="truncate text-[10px] text-neutral-400">{cat?.label}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

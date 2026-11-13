/**
 * Design Studio — catálogo visual de diseños predefinidos.
 * Overlay sobre el editor: grid con búsqueda, filtros (grupo, categoría, color), orden, favoritos,
 * detalle con previsualizaciones renderizadas del modelo real y acciones Aplicar / Personalizar / Combinar.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Heart, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useDesignStudio, type SortMode } from "@/lib/designs/store";
import { CATEGORY_GROUPS, DESIGN_CATEGORIES, type DesignCategoryId, type SneakerDesignPreset } from "@/lib/designs/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/field";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { DesignDetail } from "./DesignDetail";

/** Familias de color para el filtro: se compara con la paleta del preset. */
export const COLOR_FAMILIES: { id: string; label: string; swatch: string; test: (h: number, s: number, l: number) => boolean }[] = [
  { id: "black", label: "Negro", swatch: "#111", test: (_h, _s, l) => l < 0.18 },
  { id: "white", label: "Blanco", swatch: "#f5f5f5", test: (_h, s, l) => l > 0.88 || (l > 0.8 && s < 0.25) },
  { id: "red", label: "Rojo", swatch: "#dc2626", test: (h, s, l) => s > 0.35 && l > 0.18 && l < 0.75 && (h < 18 || h >= 340) },
  { id: "orange", label: "Naranja", swatch: "#f97316", test: (h, s, l) => s > 0.35 && l > 0.2 && l < 0.85 && h >= 18 && h < 45 },
  { id: "yellow", label: "Amarillo", swatch: "#facc15", test: (h, s, l) => s > 0.35 && l > 0.3 && l < 0.9 && h >= 45 && h < 70 },
  { id: "green", label: "Verde", swatch: "#16a34a", test: (h, s, l) => s > 0.25 && l > 0.15 && l < 0.85 && h >= 70 && h < 170 },
  { id: "blue", label: "Azul", swatch: "#2563eb", test: (h, s, l) => s > 0.25 && l > 0.15 && l < 0.85 && h >= 170 && h < 255 },
  { id: "purple", label: "Violeta", swatch: "#7c3aed", test: (h, s, l) => s > 0.25 && l > 0.15 && l < 0.85 && h >= 255 && h < 300 },
  { id: "pink", label: "Rosa", swatch: "#ec4899", test: (h, s, l) => s > 0.25 && l > 0.3 && l < 0.92 && h >= 300 && h < 340 },
];

export function hexToHsl(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, s, l];
}

export function presetHasColor(p: SneakerDesignPreset, family: string): boolean {
  const f = COLOR_FAMILIES.find((c) => c.id === family);
  if (!f) return true;
  return p.colorPalette.some((hex) => f.test(...hexToHsl(hex)));
}

const SORTS: { id: SortMode; label: string }[] = [
  { id: "featured", label: "Destacados" },
  { id: "newest", label: "Novedades" },
  { id: "name", label: "Nombre" },
  { id: "favorites", label: "Favoritos primero" },
];

export function DesignStudio() {
  const s = useDesignStudio();
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (s.open) void s.hydrate();
  }, [s.open, s]);

  useEffect(() => {
    if (!s.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (s.detailId) s.openDetail(null);
      else s.setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.open, s.detailId, s]);

  const list = useMemo(() => {
    const q = s.query.trim().toLowerCase();
    const cats = new Map(DESIGN_CATEGORIES.map((c) => [c.id, c]));
    let items = s.published().filter((p) => {
      if (s.group !== "all" && cats.get(p.category)?.group !== s.group) return false;
      if (s.category !== "all" && p.category !== s.category) return false;
      if (s.color && !presetHasColor(p, s.color)) return false;
      if (s.onlyFavorites && !s.favorites.includes(p.id)) return false;
      if (q) {
        const hay = `${p.name} ${p.tags.join(" ")} ${cats.get(p.category)?.label ?? ""} ${p.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const fav = new Set(s.favorites);
    const badgeRank = (p: SneakerDesignPreset) => (p.badge === "popular" ? 0 : p.badge === "new" ? 1 : 2);
    items = [...items].sort((a, b) => {
      switch (s.sort) {
        case "name": return a.name.localeCompare(b.name, "es");
        case "newest": return (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || (b.badge === "new" ? 1 : 0) - (a.badge === "new" ? 1 : 0);
        case "favorites": return Number(fav.has(b.id)) - Number(fav.has(a.id)) || badgeRank(a) - badgeRank(b);
        default: return badgeRank(a) - badgeRank(b) || a.name.localeCompare(b.name, "es");
      }
    });
    return items;
  }, [s]);

  const categoriesInGroup = DESIGN_CATEGORIES.filter((c) => s.group === "all" || c.group === s.group);

  return (
    <AnimatePresence>
      {s.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 z-40 flex flex-col bg-[#f4f3f0]/95 backdrop-blur-sm"
          data-testid="design-studio"
        >
          {s.detailId ? (
            <DesignDetail presetId={s.detailId} />
          ) : (
            <>
              {/* Cabecera */}
              <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200/80 bg-white/80 px-4 py-3 lg:px-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-neutral-900" />
                  <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Diseños</h2>
                  <span className="text-xs text-neutral-400">{list.length}</span>
                </div>
                <div className="relative ml-auto w-full max-w-xs sm:w-auto">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    value={s.query}
                    onChange={(e) => s.setQuery(e.target.value)}
                    placeholder="Buscar diseño, estilo, color…"
                    aria-label="Buscar diseños"
                    className="h-9 w-full rounded-full border border-neutral-200 bg-white pl-9 pr-3 text-[13px] outline-none focus:border-neutral-400 sm:w-72"
                  />
                </div>
                <select
                  value={s.sort}
                  onChange={(e) => s.setSort(e.target.value as SortMode)}
                  aria-label="Ordenar"
                  className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-[13px] text-neutral-700 outline-none"
                >
                  {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <Tip label="Solo favoritos">
                  <Button variant={s.onlyFavorites ? "default" : "outline"} size="icon" className="rounded-full" onClick={() => s.setOnlyFavorites(!s.onlyFavorites)} aria-label="Solo favoritos">
                    <Heart className={cn(s.onlyFavorites && "fill-current")} />
                  </Button>
                </Tip>
                <Button variant="outline" size="icon" className="rounded-full lg:hidden" onClick={() => setFiltersOpen(!filtersOpen)} aria-label="Filtros">
                  <SlidersHorizontal />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => s.setOpen(false)} aria-label="Cerrar diseños">
                  <X />
                </Button>
              </div>

              <div className="flex min-h-0 flex-1">
                {/* Filtros laterales */}
                <aside className={cn("w-60 shrink-0 overflow-y-auto border-r border-neutral-200/80 bg-white/70 p-4", filtersOpen ? "block" : "hidden lg:block")}>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Estilo</div>
                  <div className="flex flex-col gap-1">
                    {([["all", "Todos"], ...Object.entries(CATEGORY_GROUPS)] as [typeof s.group, string][]).map(([id, label]) => (
                      <button key={id} type="button" onClick={() => s.setGroup(id)} className={cn("rounded-lg px-2.5 py-1.5 text-left text-[13px]", s.group === id ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100")}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Categoría</div>
                  <div className="flex flex-wrap gap-1">
                    <CategoryChip active={s.category === "all"} onClick={() => s.setCategory("all")} label="Todas" />
                    {categoriesInGroup.map((c) => (
                      <CategoryChip key={c.id} active={s.category === c.id} onClick={() => s.setCategory(c.id as DesignCategoryId)} label={c.label} />
                    ))}
                  </div>
                  <div className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Color</div>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_FAMILIES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        title={c.label}
                        aria-label={`Color ${c.label}`}
                        onClick={() => s.setColor(s.color === c.id ? null : c.id)}
                        className={cn("size-7 rounded-full border border-black/10 transition-transform hover:scale-110", s.color === c.id && "ring-2 ring-neutral-900 ring-offset-2")}
                        style={{ background: c.swatch }}
                      />
                    ))}
                  </div>
                </aside>

                {/* Grid */}
                <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">
                  {list.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-sm text-neutral-500">
                      <p>No hay diseños que coincidan.</p>
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => { s.setQuery(""); s.setCategory("all"); s.setGroup("all"); s.setColor(null); s.setOnlyFavorites(false); }}>
                        Limpiar filtros
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                      {list.map((p) => (
                        <DesignCard key={p.id} preset={p} />
                      ))}
                    </div>
                  )}
                </main>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CategoryChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-full border px-2.5 py-1 text-[11px] transition-colors", active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400")}>
      {label}
    </button>
  );
}

export function DesignCard({ preset }: { preset: SneakerDesignPreset }) {
  const s = useDesignStudio();
  const fav = s.favorites.includes(preset.id);
  const cat = DESIGN_CATEGORIES.find((c) => c.id === preset.category);
  return (
    <motion.article layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="group relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition-shadow hover:shadow-md">
      <button type="button" className="block w-full text-left" onClick={() => s.openDetail(preset.id)} onMouseEnter={() => void s.preload(preset.id)}>
        <div className="relative aspect-[4/3] overflow-hidden bg-[#e9e7e2]">
          <Thumb src={preset.thumbnailUrl} alt={preset.name} />
          {preset.badge && (
            <span className="absolute left-2 top-2">
              <Badge tone={preset.badge === "popular" ? "amber" : "blue"}>{preset.badge === "popular" ? "Popular" : "Nuevo"}</Badge>
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-2 px-3 pb-3 pt-2.5">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-neutral-900">{preset.name}</div>
            <div className="truncate text-[11px] text-neutral-500">{cat?.label}</div>
          </div>
          <PaletteDots palette={preset.colorPalette} />
        </div>
      </button>
      <button
        type="button"
        aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
        onClick={(e) => { e.stopPropagation(); s.toggleFavorite(preset.id); }}
        className={cn("absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-opacity", fav ? "text-rose-600" : "text-neutral-500 opacity-0 group-hover:opacity-100 focus:opacity-100")}
      >
        <Heart className={cn("size-4", fav && "fill-current")} />
      </button>
      <div className="pointer-events-none absolute inset-x-3 bottom-14 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
        <Button size="sm" className="pointer-events-auto rounded-full shadow" onClick={() => void s.apply(preset.id)} disabled={s.applying !== null}>
          {s.applying === preset.id ? "Aplicando…" : "Aplicar"}
        </Button>
      </div>
    </motion.article>
  );
}

export function PaletteDots({ palette, size = "sm" }: { palette: string[]; size?: "sm" | "md" }) {
  return (
    <div className="flex shrink-0 -space-x-1">
      {palette.slice(0, 4).map((c, i) => (
        <span key={i} className={cn("rounded-full border border-white shadow-sm", size === "sm" ? "size-3.5" : "size-5")} style={{ background: c }} />
      ))}
    </div>
  );
}

/** Miniatura con carga diferida y estado de "sin render" cuando aún no se ha generado. */
export function Thumb({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn("flex size-full items-center justify-center text-[11px] text-neutral-400", className)}>
        Vista previa pendiente
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={cn("size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]", className)} />;
}

/**
 * Administración de plantillas (Fase 4 del Design Studio).
 * Hoy persiste en IndexedDB (presets personalizados) y lista los integrados en solo lectura;
 * en la Fase 3 del producto cada acción llama a /api/admin/designs con las mismas entidades.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, Eye, EyeOff, Pencil, Trash2, Upload, Wand2 } from "lucide-react";
import { useDesignStudio } from "@/lib/designs/store";
import { CATEGORY_GROUPS, DESIGN_CATEGORIES, designPresetSchema, type DesignCategoryId, type SneakerDesignPreset } from "@/lib/designs/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/field";
import { Thumb, PaletteDots } from "./DesignStudio";
import { cn } from "@/lib/utils/cn";

export default function AdminDesigns() {
  const s = useDesignStudio();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | "custom" | "builtin" | "categories">("all");
  useEffect(() => { void s.hydrate(); }, [s]);

  const list = useMemo(() => {
    const all = s.all();
    return tab === "custom" ? all.filter((p) => p.source === "custom") : tab === "builtin" ? all.filter((p) => p.source === "builtin") : all;
  }, [s, tab]);

  const setStatus = async (p: SneakerDesignPreset, status: SneakerDesignPreset["status"]) => {
    if (p.source === "builtin") { toast.info("Los diseños integrados se gestionan en el código del catálogo (src/lib/designs/catalog.ts)."); return; }
    if (status === "published" && !p.thumbnailUrl) { toast.error("Genera una miniatura antes de publicar."); return; }
    await s.saveCustom({ ...p, status, updatedAt: new Date().toISOString() });
    toast.success(status === "published" ? `"${p.name}" publicado en el catálogo` : `"${p.name}" retirado del catálogo`);
  };
  const duplicate = async (p: SneakerDesignPreset) => {
    const copy: SneakerDesignPreset = { ...p, id: `${p.id}-copia-${Date.now().toString(36).slice(-4)}`, name: `${p.name} (copia)`, status: "draft", source: "custom", badge: undefined, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await s.saveCustom(copy);
    toast.success("Duplicado como borrador");
  };
  const exportJson = (p: SneakerDesignPreset) => {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${p.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const preset = designPresetSchema.parse({ ...data, source: "custom", status: "draft" });
      await s.saveCustom(preset);
      toast.success(`Importado "${preset.name}" como borrador`);
    } catch (e) {
      toast.error(`JSON inválido: ${e instanceof Error ? e.message.slice(0, 120) : ""}`);
    }
  };
  const remove = async (p: SneakerDesignPreset) => {
    if (!window.confirm(`¿Eliminar la plantilla "${p.name}"?`)) return;
    await s.deleteCustom(p.id);
  };

  const counts = { published: list.filter((p) => p.status === "published").length, draft: list.filter((p) => p.status !== "published").length };

  return (
    <div className="min-h-dvh bg-[#f4f3f0] text-neutral-900">
      <header className="flex items-center gap-3 border-b border-neutral-200/80 bg-white px-4 py-3 lg:px-6">
        <Link to="/disenar" className="flex size-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100" aria-label="Volver al editor"><ArrowLeft className="size-4" /></Link>
        <div>
          <div className="text-[15px] font-semibold tracking-tight">Administración · Diseños</div>
          <div className="text-xs text-neutral-500">{counts.published} publicados · {counts.draft} borradores</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="cursor-pointer">
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && void importJson(e.target.files[0])} />
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium hover:bg-neutral-50"><Upload className="size-4" /> Importar JSON</span>
          </label>
          <Button asChild><Link to="/disenar?admin=1"><Wand2 /> Crear desde el editor</Link></Button>
        </div>
      </header>

      <div className="flex gap-1 border-b border-neutral-200/80 bg-white px-4 lg:px-6">
        {([["all", "Todos"], ["custom", "Plantillas propias"], ["builtin", "Integrados"], ["categories", "Categorías"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={cn("border-b-2 px-3 py-2.5 text-[13px]", tab === id ? "border-neutral-900 font-medium text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800")}>{label}</button>
        ))}
      </div>

      <main className="p-4 lg:p-6">
        {tab === "categories" ? (
          <CategoriesTable />
        ) : list.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay plantillas aquí. Diseña un zapato en el editor y usa «Guardar como plantilla».</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
            <table className="w-full text-[13px]">
              <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wider text-neutral-400">
                <tr><th className="px-4 py-2.5">Diseño</th><th className="px-3 py-2.5">Categoría</th><th className="px-3 py-2.5">Zonas / capas</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5">Origen</th><th className="px-3 py-2.5 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {list.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/60">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-[#e9e7e2]"><Thumb src={p.thumbnailUrl} alt="" className="group-hover:scale-100" /></div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.name}</div>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-400"><span className="font-mono">{p.id}</span><PaletteDots palette={p.colorPalette} /></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-neutral-600">{DESIGN_CATEGORIES.find((c) => c.id === p.category)?.label}</td>
                    <td className="px-3 py-2 text-neutral-600">{new Set(p.layers.map((l) => l.zoneId)).size} / {p.layers.length}</td>
                    <td className="px-3 py-2">
                      <Badge tone={p.status === "published" ? "blue" : p.status === "pending-assets" ? "amber" : "neutral"}>{p.status === "published" ? "Publicado" : p.status === "pending-assets" ? "Faltan recursos" : "Borrador"}</Badge>
                      {p.pendingAssets.length > 0 && <div className="mt-1 text-[11px] text-amber-700">{p.pendingAssets[0]}</div>}
                    </td>
                    <td className="px-3 py-2 text-neutral-500">{p.source === "builtin" ? "Integrado" : "Propio"}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-0.5">
                        {p.source === "custom" && (
                          <Button variant="ghost" size="icon-sm" aria-label={p.status === "published" ? "Despublicar" : "Publicar"} onClick={() => void setStatus(p, p.status === "published" ? "draft" : "published")}>
                            {p.status === "published" ? <EyeOff /> : <Eye />}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" aria-label="Abrir en el editor" onClick={() => { sessionStorage.setItem("sneakerlab:openPreset", p.id); navigate("/disenar?admin=1"); }}><Pencil /></Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Duplicar" onClick={() => void duplicate(p)}><Copy /></Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Exportar JSON" onClick={() => exportJson(p)}><Download /></Button>
                        {p.source === "custom" && <Button variant="destructive" size="icon-sm" aria-label="Eliminar" onClick={() => void remove(p)}><Trash2 /></Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-neutral-400">
          Flujo: diseña en el editor → «Guardar como plantilla» (borrador con miniatura) → aquí: publicar, despublicar, duplicar o exportar el JSON para añadirlo al catálogo integrado. Los integrados viven en el código y se regeneran con <code>npm run designs:render</code>.
        </p>
      </main>
    </div>
  );
}

function CategoriesTable() {
  const s = useDesignStudio();
  const all = s.all();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {(Object.keys(CATEGORY_GROUPS) as (keyof typeof CATEGORY_GROUPS)[]).map((g) => (
        <div key={g} className="rounded-2xl border border-neutral-200/80 bg-white p-4">
          <div className="mb-2 text-[13px] font-semibold">{CATEGORY_GROUPS[g]}</div>
          <ul className="divide-y divide-neutral-100 text-[13px]">
            {DESIGN_CATEGORIES.filter((c) => c.group === g).map((c) => {
              const n = all.filter((p) => p.category === (c.id as DesignCategoryId) && p.status === "published").length;
              return (
                <li key={c.id} className="flex items-center justify-between py-1.5">
                  <span className={cn(n === 0 && "text-neutral-400")}>{c.label}</span>
                  <span className="text-[11px] text-neutral-400">{n} diseño{n === 1 ? "" : "s"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="text-[11px] text-neutral-400 md:col-span-3">Las categorías son un catálogo cerrado en <code>src/lib/designs/schema.ts</code>; en la Fase 3 pasan a la entidad DesignCategory del backend.</p>
    </div>
  );
}

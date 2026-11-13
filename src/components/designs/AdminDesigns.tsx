/**
 * Administración de plantillas y estilos.
 *  - Diseños: plantillas del servidor (crear desde el editor, publicar/retirar, editar, duplicar,
 *    exportar, eliminar) y los integrados del código (solo lectura).
 *  - Estilos: categorías del catálogo (crear, renombrar, cambiar de grupo, ordenar, ocultar/mostrar).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast, Toaster } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, CloudUpload, Copy, Download, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, Upload, Wand2 } from "lucide-react";
import { useDesignStudio } from "@/lib/designs/store";
import { useCategories, type DesignCategory } from "@/lib/designs/categories";
import { designPresetSchema, type SneakerDesignPreset } from "@/lib/designs/schema";
import { BUILTIN_PRESETS } from "@/lib/designs/catalog";
import { adminApi } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth";
import { AuthDialog } from "@/components/account/AuthDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/field";
import { Thumb, PaletteDots } from "./DesignStudio";
import { cn } from "@/lib/utils/cn";

type Tab = "all" | "custom" | "builtin" | "styles";
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export default function AdminDesigns() {
  const user = useAuth((a) => a.user);
  const status = useAuth((a) => a.status);
  useEffect(() => { void useAuth.getState().hydrate(); }, []);

  if (status === "idle" || status === "loading") return <Shell><Loader2 className="size-4 animate-spin text-neutral-400" /></Shell>;
  if (!user) return <Shell><p className="text-sm text-neutral-500">Inicia sesión como administrador.</p><AuthDialog onClose={() => { if (!useAuth.getState().user) history.back(); }} /></Shell>;
  if (user.role !== "admin") return <Shell><p className="text-sm text-neutral-500">Tu cuenta no tiene permisos de administración.</p></Shell>;
  return <AdminDesignsInner />;
}

function Shell({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) {
  return (
    <div className="h-dvh overflow-y-auto bg-[#f4f3f0] text-neutral-900">
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200/80 bg-white px-4 py-3 lg:px-6">
        <Link to="/disenar" className="flex size-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100" aria-label="Volver al editor"><ArrowLeft className="size-4" /></Link>
        {header ?? <div className="text-[15px] font-semibold tracking-tight">Administración · Diseños</div>}
      </header>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}

function AdminDesignsInner() {
  const s = useDesignStudio();
  const categories = useCategories((c) => c.list);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      await s.hydrate();
      try { await s.loadAdmin(); } catch (e) { toast.error(errMsg(e, "No se pudieron cargar las plantillas")); }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => {
    const all = s.all();
    return tab === "custom" ? all.filter((p) => p.source === "custom") : tab === "builtin" ? all.filter((p) => p.source === "builtin") : all;
  }, [s, tab]);

  const act = async (id: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(id);
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error(errMsg(e, "No se pudo completar la acción")); } finally { setBusy(null); }
  };

  const setPublished = (p: SneakerDesignPreset, published: boolean) => {
    if (p.source === "builtin") { toast.info("Los diseños integrados viven en el código (src/lib/designs/catalog.ts). Para ocultarlos, oculta su estilo o duplícalos."); return; }
    if (s.isLocal(p.id)) { toast.info("Primero súbela al servidor."); return; }
    if (published && !p.thumbnailUrl) { toast.error("Ábrela en el editor y vuelve a guardarla para generar la miniatura."); return; }
    void act(p.id, () => s.publish(p.id, published), published ? `"${p.name}" publicado en las plantillas` : `"${p.name}" retirado de las plantillas`);
  };
  const upload = (p: SneakerDesignPreset) => void act(p.id, () => s.saveCustom({ ...p, status: "draft" }), `"${p.name}" subido al servidor como borrador`);
  const duplicate = (p: SneakerDesignPreset) => {
    const now = new Date().toISOString();
    const copy: SneakerDesignPreset = { ...p, id: `${p.id.slice(0, 100)}-copia-${Date.now().toString(36).slice(-4)}`, name: `${p.name} (copia)`.slice(0, 60), status: "draft", source: "custom", badge: undefined, version: 1, createdAt: now, updatedAt: now };
    void act(p.id, () => s.saveCustom(copy), "Duplicado como borrador");
  };
  const exportJson = (p: SneakerDesignPreset) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }));
    a.download = `${p.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const preset = designPresetSchema.parse({ ...data, source: "custom", status: "draft" });
      if (s.all().some((p) => p.id === preset.id)) preset.id = `${preset.id.slice(0, 100)}-${Date.now().toString(36).slice(-4)}`;
      await s.saveCustom(preset);
      toast.success(`Importado "${preset.name}" como borrador`);
    } catch (e) {
      toast.error(`No se pudo importar: ${errMsg(e, "").slice(0, 140)}`);
    }
  };
  const remove = (p: SneakerDesignPreset) => {
    if (!window.confirm(`¿Eliminar la plantilla "${p.name}"? Dejará de aparecer para los clientes.`)) return;
    void act(p.id, () => s.deleteCustom(p.id), "Plantilla eliminada");
  };
  const edit = (p: SneakerDesignPreset) => { sessionStorage.setItem("sneakerlab:openPreset", p.id); navigate("/disenar?admin=1"); };

  const published = list.filter((p) => p.status === "published").length;
  const header = (
    <>
      <div>
        <div className="text-[15px] font-semibold tracking-tight">Administración · Diseños</div>
        <div className="text-xs text-neutral-500">{tab === "styles" ? `${categories.filter((c) => c.active).length} estilos visibles de ${categories.length}` : `${published} publicados · ${list.length - published} sin publicar`}</div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <label className="cursor-pointer">
          <input type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importJson(f); }} />
          <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium hover:bg-neutral-50"><Upload className="size-4" /> <span className="hidden sm:inline">Importar JSON</span></span>
        </label>
        <Button asChild><Link to="/disenar?admin=1" onClick={() => useDesignStudio.getState().setEditing(null)}><Wand2 /> Crear desde el editor</Link></Button>
      </div>
    </>
  );

  return (
    <Shell header={header}>
      <div className="flex gap-1 overflow-x-auto border-b border-neutral-200/80 bg-white px-4 lg:px-6">
        {([["all", "Todos"], ["custom", "Plantillas propias"], ["builtin", "Integrados"], ["styles", "Estilos"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={cn("shrink-0 border-b-2 px-3 py-2.5 text-[13px]", tab === id ? "border-neutral-900 font-medium text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800")}>{label}</button>
        ))}
      </div>

      <main className="p-4 lg:p-6">
        {tab === "styles" ? (
          <StylesManager />
        ) : loading ? (
          <Loader2 className="size-4 animate-spin text-neutral-400" />
        ) : list.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay plantillas aquí. Diseña un zapato en el editor y usa «Guardar como plantilla».</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wider text-neutral-400">
                <tr><th className="px-4 py-2.5">Diseño</th><th className="px-3 py-2.5">Estilo</th><th className="px-3 py-2.5">Zonas / capas</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5">Origen</th><th className="px-3 py-2.5 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {list.map((p) => {
                  const cat = categories.find((c) => c.id === p.category);
                  const local = s.isLocal(p.id);
                  return (
                    <tr key={p.id} className={cn("hover:bg-neutral-50/60", busy === p.id && "opacity-50")}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-[#e9e7e2]"><Thumb src={p.thumbnailUrl} alt="" className="group-hover:scale-100" /></div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{p.name}</div>
                            <div className="flex items-center gap-2 text-[11px] text-neutral-400"><span className="font-mono">{p.id}</span><PaletteDots palette={p.colorPalette} /></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-neutral-600">
                        {cat?.label ?? <span className="text-red-600">{p.category} (no existe)</span>}
                        {cat && !cat.active && <div className="text-[11px] text-amber-700">Estilo oculto: no se ve</div>}
                      </td>
                      <td className="px-3 py-2 text-neutral-600">{new Set(p.layers.map((l) => l.zoneId)).size} / {p.layers.length}</td>
                      <td className="px-3 py-2">
                        <Badge tone={p.status === "published" ? "blue" : p.status === "pending-assets" ? "amber" : "neutral"}>{p.status === "published" ? "Publicado" : p.status === "pending-assets" ? "Faltan recursos" : "Borrador"}</Badge>
                        {p.pendingAssets.length > 0 && <div className="mt-1 text-[11px] text-amber-700">{p.pendingAssets[0]}</div>}
                      </td>
                      <td className="px-3 py-2 text-neutral-500">{p.source === "builtin" ? "Integrado" : local ? <span className="text-amber-700">Solo en este navegador</span> : "Servidor"}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-0.5">
                          {local ? (
                            <Button variant="ghost" size="icon-sm" aria-label="Subir al servidor" title="Subir al servidor" onClick={() => upload(p)}><CloudUpload /></Button>
                          ) : p.source === "custom" && (
                            <Button variant="ghost" size="icon-sm" aria-label={p.status === "published" ? "Retirar de las plantillas" : "Publicar en las plantillas"} title={p.status === "published" ? "Retirar de las plantillas" : "Publicar en las plantillas"} onClick={() => setPublished(p, p.status !== "published")}>
                              {p.status === "published" ? <EyeOff /> : <Eye />}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon-sm" aria-label="Abrir en el editor" title={p.source === "custom" && !local ? "Editar en el editor" : "Abrir en el editor"} onClick={() => edit(p)}><Pencil /></Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Duplicar" title="Duplicar como borrador" onClick={() => duplicate(p)}><Copy /></Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Exportar JSON" title="Exportar JSON" onClick={() => exportJson(p)}><Download /></Button>
                          {p.source === "custom" && <Button variant="destructive" size="icon-sm" aria-label="Eliminar" title="Eliminar" onClick={() => remove(p)}><Trash2 /></Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {tab !== "styles" && (
          <p className="mt-4 text-[11px] leading-relaxed text-neutral-400">
            Flujo: «Crear desde el editor» → diseña → «Guardar como plantilla» (borrador con miniatura) → aquí, publícala con el ojo y aparece en las plantillas de los clientes.
            Para cambiar una plantilla, ábrela con el lápiz, edítala y vuelve a «Guardar como plantilla» → «Actualizar». Los integrados viven en el código; duplícalos para tener una versión editable.
          </p>
        )}
      </main>
    </Shell>
  );
}

/* ---------- Estilos ---------- */

function StylesManager() {
  const list = useCategories((c) => c.list);
  const groups = useCategories((c) => c.groups);
  const source = useCategories((c) => c.source);
  // Listas estables del store (d.all() crea un array nuevo en cada llamada).
  const remote = useDesignStudio((d) => d.remote);
  const presets = useMemo(() => [...BUILTIN_PRESETS, ...remote], [remote]);
  const [label, setLabel] = useState("");
  const [group, setGroup] = useState(Object.keys(groups)[0] ?? "urban");
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(id);
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error(errMsg(e, "No se pudo guardar")); } finally { setBusy(null); }
  };
  const update = (c: DesignCategory, patch: Partial<Pick<DesignCategory, "label" | "group" | "sort" | "active">>, ok?: string) =>
    run(c.id, async () => useCategories.getState().upsert((await adminApi.updateCategory(c.id, patch)).category), ok);
  const create = () => run("new", async () => {
    const { category } = await adminApi.createCategory({ label: label.trim(), group });
    useCategories.getState().upsert(category);
    setLabel("");
  }, `Estilo «${label.trim()}» creado. Ya puedes usarlo al guardar una plantilla.`);
  const remove = (c: DesignCategory) => {
    if (!window.confirm(`¿Eliminar el estilo «${c.label}»?`)) return;
    void run(c.id, async () => { await adminApi.deleteCategory(c.id); useCategories.getState().remove(c.id); }, "Estilo eliminado");
  };
  // Subir/bajar dentro del grupo: intercambia el orden con el vecino.
  const move = (c: DesignCategory, dir: -1 | 1) => {
    const inGroup = list.filter((x) => x.group === c.group);
    const i = inGroup.findIndex((x) => x.id === c.id);
    const other = inGroup[i + dir];
    if (!other) return;
    void run(c.id, async () => {
      const a = (await adminApi.updateCategory(c.id, { sort: other.sort })).category;
      const b = (await adminApi.updateCategory(other.id, { sort: c.sort === other.sort ? c.sort + dir : c.sort })).category;
      useCategories.getState().upsert(a);
      useCategories.getState().upsert(b);
    });
  };
  const count = (id: string) => presets.filter((p) => p.category === id && p.status === "published").length;

  if (source !== "server") return <p className="text-sm text-neutral-500">No se pudo conectar con el servidor para administrar los estilos.</p>;

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-neutral-200/80 bg-white p-4"
        onSubmit={(e) => { e.preventDefault(); if (label.trim()) void create(); }}
      >
        <label className="min-w-48 flex-1">
          <span className="mb-1 block text-xs text-neutral-500">Nuevo estilo</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="p. ej. Fútbol, Floral, Retro 80s" className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-neutral-900" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-neutral-500">Grupo</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-[13px] outline-none">
            {Object.entries(groups).map(([g, l]) => <option key={g} value={g}>{l}</option>)}
          </select>
        </label>
        <Button type="submit" disabled={!label.trim() || busy === "new"}>{busy === "new" ? <Loader2 className="animate-spin" /> : <Plus />} Crear estilo</Button>
      </form>

      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(groups).map(([g, gLabel]) => {
          const items = list.filter((c) => c.group === g);
          return (
            <section key={g} className="rounded-2xl border border-neutral-200/80 bg-white p-4">
              <h3 className="mb-2 text-[13px] font-semibold">{gLabel} <span className="font-normal text-neutral-400">· {items.length}</span></h3>
              <ul className="divide-y divide-neutral-100">
                {items.map((c, i) => (
                  <StyleRow
                    key={c.id} c={c} groups={groups} busy={busy === c.id} published={count(c.id)}
                    first={i === 0} last={i === items.length - 1}
                    onRename={(l) => update(c, { label: l }, "Estilo renombrado")}
                    onGroup={(gr) => update(c, { group: gr }, "Estilo movido de grupo")}
                    onToggle={() => update(c, { active: !c.active }, c.active ? `«${c.label}» oculto: sus diseños no se muestran` : `«${c.label}» visible en las plantillas`)}
                    onMove={(d) => move(c, d)}
                    onDelete={() => remove(c)}
                  />
                ))}
                {items.length === 0 && <li className="py-2 text-[12px] text-neutral-400">Sin estilos.</li>}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-neutral-400">
        Un estilo oculto desaparece del filtro de plantillas junto con sus diseños, sin borrarlos. Los integrados no se eliminan (los usan diseños del código); los creados aquí, sí, si ninguna plantilla los usa.
      </p>
    </div>
  );
}

function StyleRow({ c, groups, busy, published, first, last, onRename, onGroup, onToggle, onMove, onDelete }: {
  c: DesignCategory; groups: Record<string, string>; busy: boolean; published: number; first: boolean; last: boolean;
  onRename: (label: string) => void; onGroup: (g: string) => void; onToggle: () => void; onMove: (d: -1 | 1) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(c.label);
  const commit = () => { setEditing(false); const v = value.trim(); if (v && v !== c.label) onRename(v); else setValue(c.label); };
  return (
    <li className={cn("flex items-center gap-1.5 py-1.5 text-[13px]", busy && "opacity-50")}>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input autoFocus value={value} maxLength={60} onChange={(e) => setValue(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setValue(c.label); setEditing(false); } }} className="h-7 w-full rounded-md border border-neutral-300 px-2 outline-none focus:border-neutral-900" />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className={cn("block max-w-full truncate text-left hover:underline", !c.active && "text-neutral-400 line-through")} title="Renombrar">{c.label}</button>
        )}
        <div className="text-[11px] text-neutral-400">{published} publicado{published === 1 ? "" : "s"}{c.builtin ? " · integrado" : ""}</div>
      </div>
      <select value={c.group} onChange={(e) => onGroup(e.target.value)} className="h-7 max-w-24 rounded-md border border-neutral-200 bg-white px-1 text-[11px] text-neutral-600 outline-none" aria-label="Grupo">
        {Object.entries(groups).map(([g, l]) => <option key={g} value={g}>{l}</option>)}
      </select>
      <Button variant="ghost" size="icon-sm" disabled={first} onClick={() => onMove(-1)} aria-label="Subir"><ArrowUp /></Button>
      <Button variant="ghost" size="icon-sm" disabled={last} onClick={() => onMove(1)} aria-label="Bajar"><ArrowDown /></Button>
      <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label={c.active ? "Ocultar" : "Mostrar"} title={c.active ? "Ocultar de las plantillas" : "Mostrar en las plantillas"}>{c.active ? <Eye /> : <EyeOff />}</Button>
      {!c.builtin && <Button variant="destructive" size="icon-sm" onClick={onDelete} aria-label="Eliminar"><Trash2 /></Button>}
    </li>
  );
}

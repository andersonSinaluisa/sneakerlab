import { useState } from "react";
import { Download, X } from "lucide-react";
import { toast } from "sonner";
import { useDoc, useEditor } from "@/lib/editor/store";
import { EXPORT_VIEWS, captureViews, composeSheet, download, type ExportedView } from "@/lib/render/exportViews";
import { sceneBridge } from "@/components/viewer/interaction";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const doc = useDoc();
  const [selected, setSelected] = useState<Set<string>>(new Set(EXPORT_VIEWS.map((v) => v.id)));
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<ExportedView[] | null>(null);
  const safe = doc.name.replace(/[^\w\- ]+/g, "").trim() || "sneakerlab";

  const run = async () => {
    setBusy("Preparando…");
    const prevSel = { layer: useEditor.getState().selectedLayerId, zone: useEditor.getState().selectedZoneId };
    useEditor.setState({ selectedLayerId: null, selectedZoneId: null, hoveredZoneId: null });
    try {
      const views = EXPORT_VIEWS.filter((v) => selected.has(v.id)).map((v) => v.id);
      const out = await captureViews(views, (i, n) => setBusy(`Capturando ${i + 1} de ${n}…`));
      setResults(out);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      useEditor.setState({ selectedLayerId: prevSel.layer, selectedZoneId: prevSel.zone });
      setBusy(null);
    }
  };

  const downloadAll = () => {
    results?.forEach((r, i) => setTimeout(() => download(r.dataUrl, `${safe}-${r.id}.png`), i * 250));
  };
  const downloadSheet = async () => {
    if (!results) return;
    setBusy("Componiendo hoja…");
    try { download(await composeSheet(results, doc.name), `${safe}-hoja.png`); } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-neutral-900">Exportar vistas</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar"><X /></Button>
        </div>
        {!results ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EXPORT_VIEWS.map((v) => (
                <label key={v.id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px]", selected.has(v.id) ? "border-neutral-900" : "border-neutral-200")}>
                  <input type="checkbox" className="accent-neutral-900" checked={selected.has(v.id)} onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(v.id); else n.delete(v.id); setSelected(n); }} />
                  {v.label}
                </label>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-neutral-400">Se capturan con el visor actual (calidad y fondo activos), sin marcos de selección. La cámara vuelve a su posición al terminar.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button onClick={() => void run()} disabled={!!busy || selected.size === 0 || !sceneBridge.capture}>{busy ?? `Capturar ${selected.size} vista${selected.size === 1 ? "" : "s"}`}</Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {results.map((r) => (
                <button key={r.id} type="button" onClick={() => download(r.dataUrl, `${safe}-${r.id}.png`)} className="group overflow-hidden rounded-xl border border-neutral-200 text-left hover:border-neutral-900">
                  <img src={r.dataUrl} alt={r.label} className="aspect-[4/3] w-full object-cover" />
                  <div className="flex items-center justify-between px-2 py-1.5 text-[11px] text-neutral-600"><span>{r.label}</span><Download className="size-3.5 opacity-0 group-hover:opacity-100" /></div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setResults(null)}>Volver</Button>
              <Button variant="outline" onClick={downloadAll}><Download /> Descargar todas</Button>
              <Button onClick={() => void downloadSheet()} disabled={!!busy}>{busy ?? "Descargar hoja de producto"}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

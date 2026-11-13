import { useEffect, useState } from "react";
import { Copy, Link2, Link2Off, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { designsApi, type DesignSummary } from "@/lib/api/client";
import { syncAssetsToCloud } from "@/lib/api/sync";
import { useEditor } from "@/lib/editor/store";
import { hydrateAssets } from "@/lib/assets/assetStore";
import { getModel } from "@/lib/model/registry";
import { Button } from "@/components/ui/button";

const REMOTE_KEY = "sneakerlab:remoteDesignId";
/** Relación borrador local ↔ diseño remoto (para actualizar en vez de duplicar al volver a guardar). */
export const remoteLink = {
  get: (localId: string) => { try { const m = JSON.parse(sessionStorage.getItem(REMOTE_KEY) ?? "{}"); return m[localId] as string | undefined; } catch { return undefined; } },
  set: (localId: string, remoteId: string) => { const m = JSON.parse(sessionStorage.getItem(REMOTE_KEY) ?? "{}"); m[localId] = remoteId; sessionStorage.setItem(REMOTE_KEY, JSON.stringify(m)); },
};

/** Sube las imágenes pendientes y crea/actualiza el diseño en la cuenta del usuario. */
export async function saveToCloud() {
  const local = useEditor.getState().doc();
  const doc = await syncAssetsToCloud(local);
  // Conserva las URL asignadas a los recursos también en el borrador local.
  useEditor.getState().loadDocument({ ...local, assets: { ...local.assets, ...doc.assets } });
  const existing = remoteLink.get(local.id);
  if (existing) {
    try {
      return (await designsApi.update(existing, doc)).design;
    } catch { /* se borró en otro dispositivo: crear de nuevo */ }
  }
  const created = (await designsApi.create(doc)).design;
  remoteLink.set(local.id, created.id);
  return created;
}

export function CloudDesignsDialog({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<DesignSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    try { setList((await designsApi.list()).designs); } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo cargar"); setList([]); }
  };
  useEffect(() => { void Promise.resolve().then(refresh); }, []);

  const open = async (d: DesignSummary) => {
    setBusy(d.id);
    try {
      const { design } = await designsApi.get(d.id);
      getModel(design.document.modelId);
      useEditor.getState().loadDocument(design.document);
      remoteLink.set(design.document.id, design.id);
      const missing = await hydrateAssets(Object.values(design.document.assets));
      if (missing.length) toast.warning(`${missing.length} imagen(es) no se pudieron cargar`);
      toast.success(`"${design.name}" abierto`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir");
    } finally { setBusy(null); }
  };

  const remove = async (d: DesignSummary) => {
    if (!window.confirm(`¿Eliminar "${d.name}" de tu cuenta? El borrador local no se toca.`)) return;
    setBusy(d.id);
    try { await designsApi.remove(d.id); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo eliminar"); } finally { setBusy(null); }
  };

  const share = async (d: DesignSummary) => {
    setBusy(d.id);
    try {
      const { design } = await designsApi.share(d.id, !d.isPublic);
      if (design.isPublic && design.shareToken) {
        const url = `${location.origin}/disenar?shared=${design.shareToken}`;
        await navigator.clipboard?.writeText(url).catch(() => undefined);
        toast.success("Enlace público copiado");
      } else toast("Enlace público desactivado");
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo compartir"); } finally { setBusy(null); }
  };

  const duplicate = async (d: DesignSummary) => {
    setBusy(d.id);
    try { await designsApi.duplicate(d.id); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo duplicar"); } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="flex max-h-[80dvh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5">
          <h3 className="text-[15px] font-semibold text-neutral-900">Mis diseños</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar"><X /></Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pt-3">
          {!list ? (
            <div className="flex items-center gap-2 py-8 text-[13px] text-neutral-400"><Loader2 className="size-4 animate-spin" /> Cargando…</div>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-neutral-400">Aún no tienes diseños guardados en tu cuenta. Usa «Guardar en mi cuenta» en el menú.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {list.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                    {d.thumbnailUrl && <img src={d.thumbnailUrl} alt="" className="size-full object-cover" />}
                  </div>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(d)} disabled={busy === d.id}>
                    <div className="truncate text-[13px] font-medium text-neutral-900">{d.name}</div>
                    <div className="text-[11px] text-neutral-400">{d.modelId} · {new Date(d.updatedAt).toLocaleString("es")}{d.isPublic ? " · público" : ""}</div>
                  </button>
                  <Button variant="ghost" size="icon-sm" onClick={() => share(d)} disabled={busy === d.id} aria-label={d.isPublic ? "Dejar de compartir" : "Compartir"}>{d.isPublic ? <Link2Off /> : <Link2 />}</Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => duplicate(d)} disabled={busy === d.id} aria-label="Duplicar"><Copy /></Button>
                  <Button variant="destructive" size="icon-sm" onClick={() => remove(d)} disabled={busy === d.id} aria-label="Eliminar"><Trash2 /></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

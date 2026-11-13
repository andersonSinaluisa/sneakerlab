/**
 * "Guardar como plantilla": convierte el diseño actual del editor en un preset personalizado,
 * captura una miniatura con el modelo real y lo guarda (borrador) en el catálogo del administrador.
 */
import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useDesignStudio } from "@/lib/designs/store";
import type { SneakerDesignPreset } from "@/lib/designs/schema";
import { useCategories } from "@/lib/designs/categories";
import { presetFromDocument } from "@/lib/designs/apply";
import { DESIGN_ASSETS } from "@/lib/designs/assets";
import { useEditor, useModel } from "@/lib/editor/store";
import { sceneBridge } from "@/components/viewer/interaction";
import { Button } from "@/components/ui/button";

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "plantilla";

export function SaveAsTemplateDialog({ onClose, existing }: { onClose: () => void; existing?: SneakerDesignPreset }) {
  const model = useModel();
  const doc = useEditor((s) => s.history.present);
  const studio = useDesignStudio();
  const [name, setName] = useState(existing?.name ?? doc.name);
  const categories = useCategories((c) => c.list);
  const groups = useCategories((c) => c.groups);
  const [category, setCategory] = useState<string>(existing?.category ?? categories.find((c) => c.active)?.id ?? "anime-full-color");
  // Editando una plantilla del servidor: se puede actualizar o guardar como nueva.
  const [asNew, setAsNew] = useState(!existing);
  const [tags, setTags] = useState(existing?.tags.join(", ") ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const target = asNew ? undefined : existing;
      const id = target?.id ?? `${slug(name)}-${Date.now().toString(36).slice(-4)}`;
      const { preset, skippedUploads } = presetFromDocument(doc, model, {
        id, name: name.trim() || "Plantilla", category, description: description.trim() || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      }, DESIGN_ASSETS);
      // Miniatura con el modelo real (vista actual del visor)
      let thumbnailUrl = target?.thumbnailUrl;
      if (sceneBridge.capture) {
        try {
          const png = await sceneBridge.capture();
          thumbnailUrl = await downscaleDataUrl(png, 800);
        } catch { /* sin miniatura */ }
      }
      const final: SneakerDesignPreset = {
        ...preset,
        thumbnailUrl,
        previewImages: thumbnailUrl ? [thumbnailUrl] : [],
        status: target?.status === "published" ? "published" : "draft",
        badge: target?.badge,
        version: (target?.version ?? 0) + 1,
        createdAt: target?.createdAt ?? preset.createdAt,
      };
      const saved = await studio.saveCustom(final);
      studio.setEditing(saved.id);
      toast.success(target ? (saved.status === "published" ? "Plantilla actualizada (sigue publicada)" : "Plantilla actualizada") : "Plantilla guardada como borrador. Publícala desde Administración → Diseños.");
      if (skippedUploads.length) toast.warning(`${skippedUploads.length} imagen(es) subidas no se incluyeron: solo los recursos de la biblioteca forman parte de una plantilla.`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la plantilla");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-neutral-900">{existing && !asNew ? "Actualizar plantilla" : "Guardar como plantilla"}</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar"><X /></Button>
        </div>
        <div className="space-y-3 text-[13px]">
          {existing && (
            <div className="flex rounded-lg border border-neutral-200 p-0.5 text-[12px]">
              <button type="button" onClick={() => setAsNew(false)} className={`flex-1 rounded-md px-2 py-1.5 ${!asNew ? "bg-neutral-900 text-white" : "text-neutral-600"}`}>Actualizar «{existing.name}»</button>
              <button type="button" onClick={() => setAsNew(true)} className={`flex-1 rounded-md px-2 py-1.5 ${asNew ? "bg-neutral-900 text-white" : "text-neutral-600"}`}>Guardar como nueva</button>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-500">Nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-9 w-full rounded-lg border border-neutral-200 px-3 outline-none focus:border-neutral-400" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-500">Estilo</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 outline-none">
              {Object.entries(groups).map(([g, label]) => (
                <optgroup key={g} label={label}>
                  {categories.filter((c) => c.group === g).map((c) => <option key={c.id} value={c.id}>{c.label}{c.active ? "" : " (oculto)"}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-500">Etiquetas (separadas por coma)</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="h-9 w-full rounded-lg border border-neutral-200 px-3 outline-none focus:border-neutral-400" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-500">Descripción corta</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={240} rows={2} className="w-full rounded-lg border border-neutral-200 px-3 py-2 outline-none focus:border-neutral-400" />
          </label>
          <p className="text-[11px] leading-relaxed text-neutral-400">
            Se guardan colores, materiales y capas de ambos zapatos con sus posiciones; la miniatura se captura del visor. Una plantilla nueva queda como borrador hasta publicarla desde Administración → Diseños. Los estilos se crean en Administración → Estilos.
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={busy || !name.trim()}>{busy ? "Guardando…" : "Guardar"}</Button>
        </div>
      </div>
    </div>
  );
}

async function downscaleDataUrl(dataUrl: string, maxSide: number): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

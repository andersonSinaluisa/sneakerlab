import { useEffect } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import { useEditor } from "@/lib/editor/store";
import { localProjectRepository } from "@/lib/editor/persistence";
import { hydrateAssets } from "@/lib/assets/assetStore";

type SaveStatus = "idle" | "restoring" | "saving" | "saved" | "error";
export const useSaveStatus = create<{ status: SaveStatus; set: (s: SaveStatus) => void }>((set) => ({
  status: "restoring",
  set: (status) => set({ status }),
}));

export async function saveNow() {
  const set = useSaveStatus.getState().set;
  set("saving");
  try {
    await localProjectRepository.saveDraft(useEditor.getState().doc());
    set("saved");
    return true;
  } catch {
    set("error");
    return false;
  }
}

/** Restaura el borrador al iniciar y lo guarda automáticamente tras cada cambio. */
export function useAutosave() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ready = false;

    (async () => {
      try {
        const draft = await localProjectRepository.loadDraft();
        if (cancelled) return;
        if (draft) {
          useEditor.getState().loadDocument(draft);
          const missing = await hydrateAssets(Object.values(draft.assets));
          if (missing.length) toast.warning(`${missing.length} imagen(es) del borrador no se pudieron recuperar.`);
          toast.success("Borrador restaurado");
        }
      } catch {
        toast.error("No se pudo leer el borrador local.");
      } finally {
        ready = true;
        useSaveStatus.getState().set("saved");
        // Enlace público de un diseño (?shared=token): se abre como copia editable.
        const shared = new URLSearchParams(window.location.search).get("shared");
        if (shared) {
          try {
            const { designsApi } = await import("@/lib/api/client");
            const { design } = await designsApi.shared(shared);
            const copy = { ...design.document, id: `dsg_${Math.random().toString(36).slice(2, 10)}`, name: `${design.name} (copia)` };
            useEditor.getState().loadDocument(copy);
            await hydrateAssets(Object.values(copy.assets));
            toast.success(`Diseño compartido "${design.name}" abierto como copia`);
            window.history.replaceState(null, "", window.location.pathname);
          } catch {
            toast.error("El enlace compartido no es válido o ya no está disponible.");
          }
        }
        // Llegada desde Administración (sessionStorage) o desde la landing (?diseno=id):
        // abre la plantilla indicada como copia editable.
        const fromLanding = new URLSearchParams(window.location.search).get("diseno");
        const fromAdmin = sessionStorage.getItem("sneakerlab:openPreset");
        const pending = fromAdmin ?? fromLanding;
        if (fromLanding) window.history.replaceState(null, "", window.location.pathname);
        if (pending) {
          sessionStorage.removeItem("sneakerlab:openPreset");
          const { useDesignStudio } = await import("@/lib/designs/store");
          await useDesignStudio.getState().hydrate();
          const studio = useDesignStudio.getState();
          // Admin: plantilla del servidor → "Guardar como plantilla" la actualiza en vez de duplicarla.
          if (fromAdmin && studio.remote.length === 0) await studio.loadAdmin().catch(() => undefined);
          const ok = await useDesignStudio.getState().apply(pending, { mode: "customize" });
          if (ok && fromAdmin && useDesignStudio.getState().remote.some((p) => p.id === pending)) useDesignStudio.getState().setEditing(pending);
        }
      }
    })();

    const unsub = useEditor.subscribe((s, prev) => {
      if (!ready || s.history.present === prev.history.present) return;
      if (s.history.gestureBase !== null) return; // espera a que termine el gesto
      clearTimeout(timer);
      useSaveStatus.getState().set("saving");
      timer = setTimeout(() => void saveNow(), 700);
    });
    const beforeUnload = () => {
      if (useSaveStatus.getState().status === "saving") void saveNow();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsub();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        s.redo();
      } else if (mod && key === "s") {
        e.preventDefault();
        void saveNow().then((ok) => (ok ? toast.success("Diseño guardado") : toast.error("No se pudo guardar")));
      } else if (mod && key === "d" && s.selectedLayerId) {
        e.preventDefault();
        s.duplicateLayer(s.selectedLayerId);
      } else if ((key === "delete" || key === "backspace") && s.selectedLayerId) {
        e.preventDefault();
        s.removeLayer(s.selectedLayerId);
      } else if (key === "escape") {
        s.selectLayer(null);
      } else if (s.selectedLayerId && key.startsWith("arrow")) {
        e.preventDefault();
        const layer = s.doc().layers.find((l) => l.id === s.selectedLayerId);
        if (!layer) return;
        const step = e.shiftKey ? 0.02 : 0.004;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        s.updateLayer(layer.id, { x: layer.x + dx, y: layer.y + dy });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

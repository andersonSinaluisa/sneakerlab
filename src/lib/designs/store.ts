/**
 * Estado del Design Studio: catálogo (builtin + personalizados), favoritos y filtros.
 * Los presets personalizados y los favoritos se guardan en IndexedDB; en la Fase 3 pasan al backend
 * (entidades DesignPreset / UserFavorite) manteniendo esta misma interfaz.
 */
import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { toast } from "sonner";
import { BUILTIN_PRESETS } from "./catalog";
import { designPresetSchema, type DesignCategoryId, type SneakerDesignPreset } from "./schema";
import { DESIGN_ASSETS } from "./assets";
import { applyPresetToDocument, checkCompatibility, type ApplyTarget } from "./apply";
import { ensureUrlAsset } from "@/lib/assets/assetStore";
import { useEditor } from "@/lib/editor/store";
import { getModel } from "@/lib/model/registry";
import { assetRefFromDesignAsset } from "./apply";

const CUSTOM_KEY = "sneakerlab:designs:custom:v1";
const FAV_KEY = "sneakerlab:designs:favorites:v1";

export type SortMode = "featured" | "newest" | "name" | "favorites";

interface DesignStudioState {
  open: boolean;
  detailId: string | null;
  custom: SneakerDesignPreset[];
  favorites: string[];
  hydrated: boolean;
  query: string;
  category: DesignCategoryId | "all";
  group: "all" | "anime" | "japan" | "urban";
  color: string | null;
  sort: SortMode;
  onlyFavorites: boolean;
  applying: string | null;

  setOpen: (v: boolean) => void;
  openDetail: (id: string | null) => void;
  setQuery: (q: string) => void;
  setCategory: (c: DesignStudioState["category"]) => void;
  setGroup: (g: DesignStudioState["group"]) => void;
  setColor: (c: string | null) => void;
  setSort: (s: SortMode) => void;
  setOnlyFavorites: (v: boolean) => void;
  toggleFavorite: (id: string) => void;
  hydrate: () => Promise<void>;

  all: () => SneakerDesignPreset[];
  published: () => SneakerDesignPreset[];
  byId: (id: string) => SneakerDesignPreset | undefined;
  /** Aplica el preset al documento actual (crea una copia editable; el preset no cambia). */
  apply: (id: string, opts?: { target?: ApplyTarget; mode?: "apply" | "customize" | "combine" }) => Promise<boolean>;
  /** Precarga ilustraciones del preset (para previsualizar rápido). */
  preload: (id: string) => Promise<void>;

  saveCustom: (preset: SneakerDesignPreset) => Promise<void>;
  deleteCustom: (id: string) => Promise<void>;
}

export const useDesignStudio = create<DesignStudioState>((set, get) => ({
  open: false,
  detailId: null,
  custom: [],
  favorites: [],
  hydrated: false,
  query: "",
  category: "all",
  group: "all",
  color: null,
  sort: "featured",
  onlyFavorites: false,
  applying: null,

  setOpen: (open) => set({ open, detailId: open ? get().detailId : null }),
  openDetail: (detailId) => set({ detailId }),
  setQuery: (query) => set({ query }),
  setCategory: (category) => set({ category }),
  setGroup: (group) => set({ group, category: "all" }),
  setColor: (color) => set({ color }),
  setSort: (sort) => set({ sort }),
  setOnlyFavorites: (onlyFavorites) => set({ onlyFavorites }),
  toggleFavorite: (id) => {
    const favorites = get().favorites.includes(id) ? get().favorites.filter((f) => f !== id) : [...get().favorites, id];
    set({ favorites });
    void idbSet(FAV_KEY, favorites);
  },

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const [custom, favorites] = await Promise.all([idbGet<unknown[]>(CUSTOM_KEY), idbGet<string[]>(FAV_KEY)]);
      const parsed = (custom ?? []).flatMap((c) => {
        const r = designPresetSchema.safeParse(c);
        return r.success ? [r.data] : [];
      });
      set({ custom: parsed, favorites: favorites ?? [], hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  all: () => [...BUILTIN_PRESETS, ...get().custom],
  published: () => get().all().filter((p) => p.status === "published"),
  byId: (id) => get().all().find((p) => p.id === id),

  preload: async (id) => {
    const preset = get().byId(id);
    if (!preset) return;
    await Promise.allSettled(preset.assets.map((a) => ensureUrlAsset(assetRefFromDesignAsset(a))));
  },

  apply: async (id, opts = {}) => {
    const preset = get().byId(id);
    if (!preset) return false;
    const editor = useEditor.getState();
    const doc = editor.doc();
    let model = getModel(doc.modelId);
    // 1. Compatibilidad: si el modelo actual no es compatible, cambia al primero compatible.
    let compat = checkCompatibility(preset, model);
    if (!compat.ok && preset.compatibleModels.length) {
      try {
        const alt = getModel(preset.compatibleModels[0]);
        editor.switchModel(alt.modelId);
        model = alt;
        compat = checkCompatibility(preset, model);
      } catch {
        /* sin modelo alternativo */
      }
    }
    if (!compat.ok) {
      toast.error(compat.errors[0] ?? "El diseño no es compatible con este modelo.");
      return false;
    }
    set({ applying: id });
    try {
      // 2. Recursos gráficos
      const results = await Promise.allSettled(preset.assets.map((a) => ensureUrlAsset(assetRefFromDesignAsset(a))));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) toast.warning(`${failed} ilustración(es) no se pudieron cargar; el diseño se aplica sin ellas.`);
      // 3–6. Colores, materiales, capas con posiciones guardadas → texturas se recomponen solas
      const mode = opts.mode ?? "apply";
      const target = opts.target ?? "both";
      const current = useEditor.getState().doc();
      const name = mode === "customize" ? `${preset.name} · mi versión` : mode === "combine" ? current.name : preset.name;
      // En todos los modos se reemplazan las capas de los zapatos afectados; "combine" solo limita el zapato.
      const next = applyPresetToDocument(current, preset, model, { target, replaceLayers: true, name });
      useEditor.getState().applyDocument(next);
      // 7. Vista 3/4
      useEditor.getState().setCameraView("threeQuarter");
      useEditor.getState().selectZone(preset.layers[0]?.zoneId ?? null, target === "both" ? "right" : target);
      for (const w of compat.warnings) console.info("[DesignStudio]", w);
      toast.success(mode === "customize" ? `Copia editable de "${preset.name}" lista` : `Diseño "${preset.name}" aplicado`);
      // 8. Seguir editando: se cierra el catálogo
      set({ open: false, detailId: null });
      return true;
    } finally {
      set({ applying: null });
    }
  },

  saveCustom: async (preset) => {
    const custom = [...get().custom.filter((p) => p.id !== preset.id), preset];
    set({ custom });
    await idbSet(CUSTOM_KEY, custom);
  },
  deleteCustom: async (id) => {
    const custom = get().custom.filter((p) => p.id !== id);
    set({ custom });
    await idbSet(CUSTOM_KEY, custom);
  },
}));

export { DESIGN_ASSETS };

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
import { adminApi, assetsApi, presetsApi } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth";
import { isCategoryVisible, useCategories } from "./categories";

const CUSTOM_KEY = "sneakerlab:designs:custom:v1";
const FAV_KEY = "sneakerlab:designs:favorites:v1";

export type SortMode = "featured" | "newest" | "name" | "favorites";

interface DesignStudioState {
  open: boolean;
  detailId: string | null;
  /** Plantillas de administración guardadas en el servidor. */
  remote: SneakerDesignPreset[];
  /** Copias locales de versiones anteriores (IndexedDB), pendientes de subir. */
  custom: SneakerDesignPreset[];
  favorites: string[];
  hydrated: boolean;
  query: string;
  category: DesignCategoryId | "all";
  /** "all" o un id de grupo de estilos (anime, japan, urban…). */
  group: string;
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

  /** Crea o actualiza una plantilla en el servidor (admin). Devuelve la versión guardada. */
  saveCustom: (preset: SneakerDesignPreset) => Promise<SneakerDesignPreset>;
  publish: (id: string, published: boolean) => Promise<void>;
  deleteCustom: (id: string) => Promise<void>;
  /** Admin: todas las plantillas del servidor (también borradores) y todos los estilos. */
  loadAdmin: () => Promise<void>;
  /** ¿Solo existe en IndexedDB de este navegador (versión anterior)? */
  isLocal: (id: string) => boolean;
  /** Plantilla del servidor que se está editando en el editor (para actualizarla, no duplicarla). */
  editingId: string | null;
  setEditing: (id: string | null) => void;
}

export const useDesignStudio = create<DesignStudioState>((set, get) => ({
  open: false,
  detailId: null,
  remote: [],
  custom: [],
  editingId: null,
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
    // Plantillas publicadas por administración y estilos visibles (sin API: solo integrados).
    await Promise.all([
      presetsApi.published().then(
        ({ presets }) => { if (!get().remote.length) set({ remote: presets.flatMap((p) => { try { return [parseServer(p)]; } catch { return []; } }) }); },
        () => undefined,
      ),
      useCategories.getState().load(),
    ]);
  },

  // Servidor primero; las copias locales antiguas solo si aún no se subieron.
  all: () => {
    const remoteIds = new Set(get().remote.map((p) => p.id));
    return [...BUILTIN_PRESETS, ...get().remote, ...get().custom.filter((p) => !remoteIds.has(p.id))];
  },
  // Al catálogo de clientes solo llega lo publicado en el servidor (y los integrados), con su estilo visible.
  published: () => [...BUILTIN_PRESETS, ...get().remote].filter((p) => p.status === "published" && isCategoryVisible(p.category)),
  isLocal: (id) => get().custom.some((p) => p.id === id) && !get().remote.some((p) => p.id === id),
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
    // Aplicar un diseño deja de "editar" la plantilla anterior (quien abre desde Administración lo vuelve a fijar).
    set({ applying: id, editingId: null });
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
    requireAdmin();
    const body = await withUploadedImages(preset);
    const exists = get().remote.some((p) => p.id === preset.id);
    const { preset: saved } = exists ? await adminApi.updatePreset(preset.id, body) : await adminApi.savePreset(body);
    set({ remote: [...get().remote.filter((p) => p.id !== saved.id), parseServer(saved)] });
    // Si venía de la copia local antigua (IndexedDB), ya vive en el servidor.
    if (get().custom.some((p) => p.id === preset.id)) await dropLocal(preset.id);
    return parseServer(saved);
  },
  publish: async (id, published) => {
    requireAdmin();
    const { preset } = await adminApi.publishPreset(id, published);
    set({ remote: get().remote.map((p) => (p.id === id ? parseServer(preset) : p)) });
  },
  deleteCustom: async (id) => {
    if (get().remote.some((p) => p.id === id)) {
      requireAdmin();
      await adminApi.deletePreset(id);
      set({ remote: get().remote.filter((p) => p.id !== id) });
    }
    if (get().custom.some((p) => p.id === id)) await dropLocal(id);
  },
  loadAdmin: async () => {
    const [{ presets }] = await Promise.all([adminApi.presets(), useCategories.getState().load(true)]);
    set({ remote: presets.map(parseServer) });
  },
  setEditing: (editingId) => set({ editingId }),
}));

/* ---------- Servidor ---------- */

function requireAdmin() {
  if (useAuth.getState().user?.role !== "admin") throw new Error("Inicia sesión como administrador para gestionar plantillas.");
}

function parseServer(p: unknown): SneakerDesignPreset {
  return designPresetSchema.parse({ ...(p as object), source: "custom" });
}

async function dropLocal(id: string) {
  const custom = useDesignStudio.getState().custom.filter((p) => p.id !== id);
  useDesignStudio.setState({ custom });
  await idbSet(CUSTOM_KEY, custom);
}

/** Las miniaturas capturadas llegan como data: URL; se suben al almacenamiento y se guarda su URL. */
async function withUploadedImages(preset: SneakerDesignPreset): Promise<SneakerDesignPreset> {
  const cache = new Map<string, string>();
  const up = async (url: string | undefined) => {
    if (!url?.startsWith("data:")) return url;
    if (!cache.has(url)) {
      const blob = await (await fetch(url)).blob();
      const bitmap = await createImageBitmap(blob);
      const remote = await assetsApi.upload(blob, { name: `${preset.id}-miniatura`, width: bitmap.width, height: bitmap.height });
      bitmap.close();
      cache.set(url, remote.url);
    }
    return cache.get(url);
  };
  const thumbnailUrl = await up(preset.thumbnailUrl);
  const previewImages = (await Promise.all(preset.previewImages.map(up))).filter((u): u is string => !!u);
  return { ...preset, thumbnailUrl, previewImages };
}

export { DESIGN_ASSETS };

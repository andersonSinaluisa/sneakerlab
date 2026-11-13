/**
 * Estilos (categorías) de las plantillas. Viven en el servidor (tabla design_categories) y los
 * administra el admin; los integrados de schema.ts son la semilla y el respaldo sin conexión.
 */
import { create } from "zustand";
import { adminApi, catalogApi, type DesignCategory } from "@/lib/api/client";
import { CATEGORY_GROUPS, DESIGN_CATEGORIES } from "./schema";

export type { DesignCategory };

const FALLBACK: DesignCategory[] = DESIGN_CATEGORIES.map((c, i) => ({ id: c.id, label: c.label, group: c.group, sort: (i + 1) * 10, active: true, builtin: true }));

interface CategoriesState {
  list: DesignCategory[];
  groups: Record<string, string>;
  /** "server": lista real; "fallback": integrados (sin conexión o aún cargando). */
  source: "fallback" | "server";
  /** Carga los visibles (público) o todos, incluidos los ocultos (admin). */
  load: (admin?: boolean) => Promise<void>;
  upsert: (c: DesignCategory) => void;
  remove: (id: string) => void;
}

export const useCategories = create<CategoriesState>((set, get) => ({
  list: FALLBACK,
  groups: { ...CATEGORY_GROUPS },
  source: "fallback",
  load: async (admin = false) => {
    try {
      const r = admin ? await adminApi.categories() : await catalogApi.categories();
      set({ list: r.categories, groups: r.groups, source: "server" });
    } catch {
      /* sin API: se quedan los integrados */
    }
  },
  upsert: (c) => set({ list: [...get().list.filter((x) => x.id !== c.id), c].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, "es")) }),
  remove: (id) => set({ list: get().list.filter((c) => c.id !== id) }),
}));

export const categoryById = (id: string) => useCategories.getState().list.find((c) => c.id === id);

/** Hook: estilo de un id (para etiquetas en tarjetas y fichas). */
export function useCategory(id: string | undefined) {
  return useCategories((s) => (id ? s.list.find((c) => c.id === id) : undefined));
}

/** ¿Se muestra en el catálogo? Un estilo oculto oculta sus diseños; uno desconocido no los bloquea. */
export function isCategoryVisible(id: string): boolean {
  const c = categoryById(id);
  return !c || c.active;
}

/**
 * Estado del editor (Zustand).
 *  - `history`: documento editable con Undo/Redo (lo que se guarda).
 *  - resto: estado de UI efímero (selección, vista, herramienta activa).
 */
import { create } from "zustand";
import type { MaterialPresetId, ShoeSide } from "@/lib/model/schema";
import { DEFAULT_MODEL_ID, getModel, getZone } from "@/lib/model/registry";
import { createId } from "@/lib/utils/id";
import { initialLayerWidth } from "@/lib/textures/layerMath";
import * as H from "./history";
import * as D from "./document";
import type { AssetRef, DesignDocument, ImageLayer, PatternLayer, TextLayer } from "./types";

export type ToolCategory =
  | "designs"
  | "models"
  | "colors"
  | "materials"
  | "images"
  | "text"
  | "patterns"
  | "layers"
  | "ai";

export type CameraView = "outer" | "inner" | "top" | "back" | "front" | "threeQuarter" | "both";
export type QualityTier = "low" | "medium" | "high";

export interface EditorState {
  history: H.HistoryState<DesignDocument>;

  activeShoe: ShoeSide;
  /** Aplicar cambios de color a ambos zapatos a la vez. */
  linkShoes: boolean;
  selectedZoneId: string | null;
  selectedLayerId: string | null;
  hoveredZoneId: string | null;
  activeTool: ToolCategory;
  cameraView: CameraView;
  /** Se incrementa para forzar "restaurar cámara" aunque la vista no cambie. */
  cameraNonce: number;
  controlsHidden: boolean;
  background: "studio" | "white" | "dark";
  /** Nivel de calidad de render; "auto" se resuelve al montar el visor. */
  quality: QualityTier | "auto";
  resolvedQuality: QualityTier;
  draggingLayer: boolean;
  mobilePanelOpen: boolean;

  // documento
  doc: () => DesignDocument;
  loadDocument: (doc: DesignDocument) => void;
  /** Reemplaza el documento como una entrada del historial (deshacer vuelve al anterior). */
  applyDocument: (doc: DesignDocument) => void;
  newDocument: () => void;
  /** Deja el zapato tal como es (colores/materiales de fábrica, sin capas). Se puede deshacer. */
  clearDesign: () => void;
  renameDocument: (name: string) => void;
  switchModel: (modelId: string) => void;
  setZoneColor: (zoneId: string, color: string) => void;
  setZoneMaterial: (zoneId: string, material: MaterialPresetId) => void;
  registerAsset: (asset: AssetRef) => void;
  addImageLayer: (assetId: string, target?: { shoe?: ShoeSide; zoneId?: string; x?: number; y?: number }) => string | null;
  addTextLayer: (text?: string, target?: { shoe?: ShoeSide; zoneId?: string }) => string | null;
  addPatternLayer: (pattern?: PatternLayer["pattern"], target?: { shoe?: ShoeSide; zoneId?: string }) => string | null;
  updateLayer: (id: string, patch: D.LayerPatch) => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  copyLayerToOtherShoe: (id: string) => void;
  reorderLayer: (id: string, dir: "up" | "down") => void;
  beginGesture: () => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;

  // UI
  setActiveShoe: (shoe: ShoeSide) => void;
  setLinkShoes: (v: boolean) => void;
  selectZone: (zoneId: string | null, shoe?: ShoeSide) => void;
  selectLayer: (layerId: string | null) => void;
  setHoveredZone: (zoneId: string | null) => void;
  setActiveTool: (tool: ToolCategory) => void;
  setCameraView: (view: CameraView) => void;
  resetCamera: () => void;
  setControlsHidden: (v: boolean) => void;
  setBackground: (bg: EditorState["background"]) => void;
  setQuality: (q: QualityTier | "auto") => void;
  setResolvedQuality: (q: QualityTier) => void;
  setDraggingLayer: (v: boolean) => void;
  setMobilePanelOpen: (v: boolean) => void;
}

const initialDoc = () => D.createDocument(getModel(DEFAULT_MODEL_ID));

function isDark(hex: string) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  return 0.2126 * parseInt(m[1], 16) + 0.7152 * parseInt(m[2], 16) + 0.0722 * parseInt(m[3], 16) < 128;
}

export const useEditor = create<EditorState>((set, get) => {
  const apply = (fn: (doc: DesignDocument) => DesignDocument) =>
    set((s) => ({ history: H.commit(s.history, fn(s.history.present)) }));

  return {
    history: H.createHistory(initialDoc()),
    activeShoe: "right",
    linkShoes: false,
    selectedZoneId: "outer",
    selectedLayerId: null,
    hoveredZoneId: null,
    activeTool: "images",
    cameraView: "outer",
    cameraNonce: 0,
    controlsHidden: false,
    background: "studio",
    quality: "auto",
    resolvedQuality: "medium",
    draggingLayer: false,
    mobilePanelOpen: false,

    doc: () => get().history.present,

    loadDocument: (doc) => {
      const model = getModel(doc.modelId);
      set({
        history: H.reset(D.normalizeDocument(doc, model)),
        selectedLayerId: null,
      });
    },
    applyDocument: (doc) => {
      apply(() => D.normalizeDocument(doc, getModel(doc.modelId)));
      set({ selectedLayerId: null });
    },
    newDocument: () =>
      set({ history: H.reset(initialDoc()), selectedLayerId: null, selectedZoneId: "outer" }),
    clearDesign: () => {
      apply((d) => D.clearDesign(d, getModel(d.modelId)));
      set({ selectedLayerId: null });
    },
    renameDocument: (name) => {
      const clean = name.replace(/[\u0000-\u001f<>]/g, "").slice(0, 80).trim() || "Diseño sin título";
      apply((d) => ({ ...d, name: clean }));
    },

    switchModel: (modelId) => {
      if (modelId === get().doc().modelId) return;
      apply((d) => D.switchModel(d, getModel(modelId)));
      set({ selectedLayerId: null, selectedZoneId: getModel(modelId).zones.find((z) => z.allowImages)?.id ?? null });
    },

    setZoneColor: (zoneId, color) => {
      const { linkShoes, activeShoe } = get();
      const zone = getZone(getModel(get().doc().modelId), zoneId);
      if (!zone?.allowColors || !/^#[0-9a-fA-F]{6}$/.test(color)) return;
      apply((d) => D.setZoneColor(d, linkShoes ? ["right", "left"] : [activeShoe], zoneId, color));
    },

    setZoneMaterial: (zoneId, material) => {
      const { linkShoes, activeShoe } = get();
      const zone = getZone(getModel(get().doc().modelId), zoneId);
      if (!zone?.allowMaterials) return;
      if (zone.materialOptions && !zone.materialOptions.includes(material)) return;
      apply((d) => D.setZoneMaterial(d, linkShoes ? ["right", "left"] : [activeShoe], zoneId, material));
    },

    registerAsset: (asset) =>
      apply((d) => ({ ...d, assets: { ...d.assets, [asset.id]: asset } })),

    addImageLayer: (assetId, target) => {
      const s = get();
      const doc = s.doc();
      const asset = doc.assets[assetId];
      const shoe = target?.shoe ?? s.activeShoe;
      const zoneId = target?.zoneId ?? s.selectedZoneId;
      if (!asset || !zoneId) return null;
      const zone = getZone(getModel(doc.modelId), zoneId);
      if (!zone?.allowImages || !zone.texture) return null;
      const layer: ImageLayer = {
        id: createId("lyr"),
        kind: "image",
        name: asset.name,
        assetId,
        shoe,
        zoneId,
        x: target?.x ?? 0.5,
        y: target?.y ?? 0.5,
        width: initialLayerWidth(zone.texture, asset),
        rotation: 0,
        opacity: 1,
        flipX: false,
        visible: true,
      };
      apply((d) => D.addLayer(d, layer));
      set({ selectedLayerId: layer.id, selectedZoneId: zoneId, activeShoe: shoe });
      return layer.id;
    },

    addTextLayer: (text = "TU TEXTO", target) => {
      const s = get();
      const doc = s.doc();
      const shoe = target?.shoe ?? s.activeShoe;
      const zoneId = target?.zoneId ?? s.selectedZoneId;
      if (!zoneId) return null;
      const zone = getZone(getModel(doc.modelId), zoneId);
      if (!zone?.allowText || !zone.texture) return null;
      const dark = isDark(doc.shoes[shoe].zones[zoneId]?.color ?? zone.defaultColor);
      const layer: TextLayer = {
        id: createId("lyr"), kind: "text", name: text.slice(0, 24) || "Texto", shoe, zoneId,
        x: 0.5, y: 0.5, width: 0.5, rotation: 0, opacity: 1, flipX: false, visible: true,
        text, font: "display", weight: 800, italic: false, size: 0.32, letterSpacing: 0.04,
        fill: dark ? "#ffffff" : "#111111", strokeWidth: 0, curve: 0, align: "center",
      };
      apply((d) => D.addLayer(d, layer));
      set({ selectedLayerId: layer.id, selectedZoneId: zoneId, activeShoe: shoe });
      return layer.id;
    },
    addPatternLayer: (pattern = "stripes", target) => {
      const s = get();
      const doc = s.doc();
      const shoe = target?.shoe ?? s.activeShoe;
      const zoneId = target?.zoneId ?? s.selectedZoneId;
      if (!zoneId) return null;
      const zone = getZone(getModel(doc.modelId), zoneId);
      if (!zone?.allowImages || !zone.texture) return null;
      const baseColor = doc.shoes[shoe].zones[zoneId]?.color ?? zone.defaultColor;
      const layer: PatternLayer = {
        id: createId("lyr"), kind: "pattern", name: `Patrón · ${pattern}`, shoe, zoneId,
        x: 0.5, y: 0.5, width: 1, height: 1, rotation: 0, opacity: 1, flipX: false, visible: true,
        pattern, colorA: baseColor, colorB: isDark(baseColor) ? "#f5f5f5" : "#111111", scale: 0.12,
      };
      // los patrones van debajo de imágenes y textos: se insertan al principio de la zona
      apply((d) => {
        const next = D.addLayer(d, layer);
        const idx = next.layers.findIndex((l) => l.id === layer.id);
        const first = next.layers.findIndex((l) => l.shoe === shoe && l.zoneId === zoneId);
        if (first >= 0 && first < idx) {
          const arr = [...next.layers];
          arr.splice(idx, 1);
          arr.splice(first, 0, layer);
          return { ...next, layers: arr };
        }
        return next;
      });
      set({ selectedLayerId: layer.id, selectedZoneId: zoneId, activeShoe: shoe });
      return layer.id;
    },
    updateLayer: (id, patch) => apply((d) => D.updateLayer(d, id, patch)),
    removeLayer: (id) => {
      apply((d) => D.removeLayer(d, id));
      if (get().selectedLayerId === id) set({ selectedLayerId: null });
    },
    duplicateLayer: (id) => {
      let newId: string | null = null;
      apply((d) => {
        const r = D.duplicateLayer(d, id);
        newId = r.newId;
        return r.doc;
      });
      if (newId) set({ selectedLayerId: newId });
    },
    copyLayerToOtherShoe: (id) => {
      const layer = get().doc().layers.find((l) => l.id === id);
      if (!layer) return;
      const other: ShoeSide = layer.shoe === "right" ? "left" : "right";
      apply((d) => D.duplicateLayer(d, id, { shoe: other }).doc);
    },
    reorderLayer: (id, dir) => apply((d) => D.reorderLayer(d, id, dir)),

    beginGesture: () => set((s) => ({ history: H.beginGesture(s.history) })),
    endGesture: () => set((s) => ({ history: H.endGesture(s.history) })),
    undo: () => {
      set((s) => ({ history: H.undo(s.history) }));
      const sel = get().selectedLayerId;
      if (sel && !get().doc().layers.some((l) => l.id === sel)) set({ selectedLayerId: null });
    },
    redo: () => set((s) => ({ history: H.redo(s.history) })),

    setActiveShoe: (shoe) => set({ activeShoe: shoe, selectedLayerId: null }),
    setLinkShoes: (v) => set({ linkShoes: v }),
    selectZone: (zoneId, shoe) =>
      set((s) => ({
        selectedZoneId: zoneId,
        activeShoe: shoe ?? s.activeShoe,
        selectedLayerId: null,
      })),
    selectLayer: (layerId) => {
      if (!layerId) return set({ selectedLayerId: null });
      const layer = get().doc().layers.find((l) => l.id === layerId);
      if (!layer) return;
      set({ selectedLayerId: layerId, selectedZoneId: layer.zoneId, activeShoe: layer.shoe });
    },
    setHoveredZone: (zoneId) => set({ hoveredZoneId: zoneId }),
    setActiveTool: (tool) => set({ activeTool: tool }),
    setCameraView: (view) => set((s) => ({ cameraView: view, cameraNonce: s.cameraNonce + 1 })),
    resetCamera: () => set((s) => ({ cameraNonce: s.cameraNonce + 1 })),
    setControlsHidden: (v) => set({ controlsHidden: v }),
    setBackground: (bg) => set({ background: bg }),
    setQuality: (q) => set({ quality: q }),
    setResolvedQuality: (q) => set({ resolvedQuality: q }),
    setDraggingLayer: (v) => set({ draggingLayer: v }),
    setMobilePanelOpen: (v) => set({ mobilePanelOpen: v }),
  };
});

/** Selectores de conveniencia */
export const useDoc = () => useEditor((s) => s.history.present);
export const useCanUndo = () => useEditor((s) => s.history.past.length > 0);
export const useCanRedo = () => useEditor((s) => s.history.future.length > 0);
export const useModel = () => getModel(useEditor((s) => s.history.present.modelId));

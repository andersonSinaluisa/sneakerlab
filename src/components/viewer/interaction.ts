/**
 * Puente entre el DOM y la escena 3D: permite hacer raycast desde fuera del
 * Canvas (drag & drop de archivos) y compartir el estado de arrastre de capas.
 */
import type * as THREE from "three";
import type { CameraControls } from "@react-three/drei";
import type { ShoeSide } from "@/lib/model/schema";

export interface ZoneHit {
  shoe: ShoeSide;
  zoneId: string;
  uv: { x: number; y: number };
  mesh: THREE.Mesh;
}

export interface ZoneUserData {
  zoneId: string;
  shoe: ShoeSide;
  allowImages: boolean;
  texture?: { width: number; height: number };
  uvIsland?: { u0: number; v0: number; u1: number; v1: number };
}

export const ASSET_DRAG_MIME = "application/x-sneakerlab-asset";

type PickFn = (clientX: number, clientY: number, only?: THREE.Object3D) => ZoneHit | null;

export const sceneBridge: {
  pick: PickFn | null;
  controls: CameraControls | null;
  capture: (() => Promise<string>) | null;
  /** Bounding box del zapato (derecho, en origen) publicado por SneakerModel. */
  modelBox: THREE.Box3 | null;
  modelVersion: number;
} = { pick: null, controls: null, capture: null, modelBox: null, modelVersion: 0 };

export interface LayerDrag {
  layerId: string;
  mesh: THREE.Mesh;
  offsetX: number;
  offsetY: number;
  moved: boolean;
}

export const dragState: { current: LayerDrag | null } = { current: null };

export function zoneData(obj: THREE.Object3D | null | undefined): ZoneUserData | null {
  const d = obj?.userData as Partial<ZoneUserData> | undefined;
  return d?.zoneId && d.shoe ? (d as ZoneUserData) : null;
}

export function isWorldVisible(obj: THREE.Object3D): boolean {
  let o: THREE.Object3D | null = obj;
  while (o) {
    if (!o.visible) return false;
    o = o.parent;
  }
  return true;
}

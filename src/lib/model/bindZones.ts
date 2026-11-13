/**
 * Enlaza un modelo cargado (GLB) con su configuración de zonas.
 * Es el único lugar que conoce nombres de meshes; los componentes React
 * trabajan exclusivamente con ids de zona.
 */
import type * as THREE from "three";
import type { ModelConfig, ShoeSide, ZoneConfig } from "./schema";

export interface BoundZone {
  zone: ZoneConfig;
  mesh: THREE.Mesh;
}

export interface BoundShoe {
  side: ShoeSide;
  root: THREE.Object3D;
  zones: BoundZone[];
}

export interface BindResult {
  shoes: Record<ShoeSide, BoundShoe>;
  warnings: string[];
}

export function bindZones(scene: THREE.Object3D, model: ModelConfig): BindResult {
  const warnings: string[] = [];
  const shoes = {} as Record<ShoeSide, BoundShoe>;

  for (const side of ["right", "left"] as const) {
    const root = scene.getObjectByName(model.shoes[side].nodeName);
    if (!root) {
      throw new Error(`El GLB no contiene el nodo "${model.shoes[side].nodeName}" (${side})`);
    }
    const zones: BoundZone[] = [];
    for (const zone of model.zones) {
      const obj = root.getObjectByName(zone.meshNames[side]);
      const mesh = obj && (obj as THREE.Mesh).isMesh ? (obj as THREE.Mesh) : undefined;
      if (!mesh) {
        warnings.push(`Mesh "${zone.meshNames[side]}" no encontrado para la zona ${zone.id} (${side})`);
        continue;
      }
      if ((zone.allowImages || zone.allowText) && !mesh.geometry.attributes.uv) {
        warnings.push(`El mesh "${mesh.name}" no tiene UVs; la zona ${zone.id} no admitirá imágenes`);
      }
      zones.push({ zone, mesh });
    }
    shoes[side] = { side, root, zones };
  }
  return { shoes, warnings };
}

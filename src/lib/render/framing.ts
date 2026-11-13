/**
 * Encuadre de cámara calculado a partir del bounding box del modelo.
 * Funciones puras sobre vectores de Three (probable en Node).
 */
import * as THREE from "three";
import type { CameraView } from "@/lib/editor/store";
import type { ShoeSide } from "@/lib/model/schema";

export interface ModelFrame {
  /** Caja del zapato activo en coordenadas de mundo. */
  box: THREE.Box3;
  size: THREE.Vector3;
  center: THREE.Vector3;
  /** Eje longitudinal: +X apunta a la punta (convención del manifiesto). */
  toeDir: THREE.Vector3;
  /** Hacia el exterior del zapato activo. */
  outerDir: THREE.Vector3;
}

export function measure(source: THREE.Object3D | THREE.Box3, side: ShoeSide): ModelFrame {
  const box = source instanceof THREE.Box3 ? source.clone() : new THREE.Box3().setFromObject(source);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return {
    box,
    size,
    center,
    toeDir: new THREE.Vector3(1, 0, 0),
    outerDir: new THREE.Vector3(0, 0, side === "right" ? 1 : -1),
  };
}

/** Dirección de cámara (desde el objetivo hacia la cámara) por vista. */
export function viewDirection(view: CameraView, f: ModelFrame): THREE.Vector3 {
  const up = new THREE.Vector3(0, 1, 0);
  const o = f.outerDir.clone();
  const t = f.toeDir.clone();
  switch (view) {
    case "outer":
      return o.multiplyScalar(1).add(t.clone().multiplyScalar(0.05)).add(up.clone().multiplyScalar(0.18));
    case "inner":
      return o.multiplyScalar(-1).add(t.clone().multiplyScalar(0.05)).add(up.clone().multiplyScalar(0.18));
    case "top":
      return up.add(t.clone().multiplyScalar(-0.02));
    case "back":
      return t.multiplyScalar(-1).add(up.clone().multiplyScalar(0.32)).add(o.clone().multiplyScalar(0.02));
    case "front":
      return t.add(up.clone().multiplyScalar(0.3)).add(o.clone().multiplyScalar(0.02));
    case "threeQuarter":
      return t.clone().multiplyScalar(0.8).add(o.clone().multiplyScalar(0.95)).add(up.clone().multiplyScalar(0.55));
    case "both":
      return t.clone().multiplyScalar(0.85).add(o.clone().multiplyScalar(0.7)).add(up.clone().multiplyScalar(0.7));
  }
}

/**
 * Tamaño proyectado (ancho, alto) de la caja vista desde `dir`, usando los 8 vértices.
 */
export function projectedExtent(
  box: THREE.Box3,
  dir: THREE.Vector3,
  target?: THREE.Vector3,
): { width: number; height: number } {
  const forward = dir.clone().normalize().negate(); // cámara mira hacia -dir
  const worldUp = Math.abs(forward.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    const x = v.dot(right), y = v.dot(up);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (!target) return { width: maxX - minX, height: maxY - minY };
  // El objetivo no está en el centro: la mitad más lejana define la extensión simétrica.
  const tx = target.dot(right), ty = target.dot(up);
  return {
    width: 2 * Math.max(maxX - tx, tx - minX),
    height: 2 * Math.max(maxY - ty, ty - minY),
  };
}

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  distance: number;
}

/** Distancia para que la caja quepa con margen en un frustum (fov vertical en grados). */
export function fitDistance(width: number, height: number, vfovDeg: number, aspect: number, margin = 1.15): number {
  const v = THREE.MathUtils.degToRad(vfovDeg);
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect);
  return Math.max(width / 2 / Math.tan(h / 2), height / 2 / Math.tan(v / 2)) * margin;
}

export function computePose(
  view: CameraView,
  frame: ModelFrame,
  opts: { vfov: number; aspect: number; focusHeight: number; bothBox?: THREE.Box3 },
): CameraPose {
  const box = view === "both" && opts.bothBox ? opts.bothBox : frame.box;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const target = new THREE.Vector3(center.x, box.min.y + size.y * opts.focusHeight, center.z);
  const dir = viewDirection(view, frame).normalize();
  const distance = perspectiveFitDistance(box, dir, target, opts.vfov, opts.aspect, view === "top" ? 1.08 : 1.15);
  return { position: dir.clone().multiplyScalar(distance).add(target), target, distance };
}

/**
 * Distancia mínima (perspectiva exacta) para que los 8 vértices queden dentro del frustum:
 * para cada vértice, d ≥ |coord lateral| / tan(semiángulo) + profundidad hacia la cámara.
 */
export function perspectiveFitDistance(
  box: THREE.Box3,
  dir: THREE.Vector3,
  target: THREE.Vector3,
  vfovDeg: number,
  aspect: number,
  margin = 1.15,
): number {
  const toCam = dir.clone().normalize();
  const forward = toCam.clone().negate();
  const worldUp = Math.abs(forward.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(vfovDeg) / 2) / margin;
  const tanH = tanV * aspect;
  let d = 0;
  const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(target);
    const depth = v.dot(toCam); // positivo = más cerca de la cámara
    d = Math.max(d, Math.abs(v.dot(right)) / tanH + depth, Math.abs(v.dot(up)) / tanV + depth);
  }
  return d;
}

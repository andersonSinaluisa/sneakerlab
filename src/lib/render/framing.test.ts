import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { computePose, fitDistance, measure, projectedExtent } from "./framing";

const box = new THREE.Box3(new THREE.Vector3(-1.4, 0, -0.5), new THREE.Vector3(1.4, 1.1, 0.5));

describe("framing", () => {
  it("la extensión proyectada depende de la dirección", () => {
    const side = projectedExtent(box, new THREE.Vector3(0, 0, 1));
    const front = projectedExtent(box, new THREE.Vector3(1, 0, 0));
    expect(side.width).toBeCloseTo(2.8);
    expect(front.width).toBeCloseTo(1.0);
    expect(side.height).toBeCloseTo(1.1);
  });

  it("la cámara siempre encuadra la caja completa", () => {
    const frame = measure(box, "right");
    for (const view of ["outer", "inner", "top", "back", "front", "threeQuarter"] as const) {
      const pose = computePose(view, frame, { vfov: 30, aspect: 16 / 9, focusHeight: 0.45 });
      const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.01, 100);
      cam.position.copy(pose.position);
      cam.lookAt(pose.target);
      cam.updateMatrixWorld();
      const frustum = new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
      );
      for (let i = 0; i < 8; i++) {
        const v = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
        expect(frustum.containsPoint(v), `${view} vértice ${i}`).toBe(true);
      }
    }
  });

  it("escala con el tamaño del modelo (sin coordenadas fijas)", () => {
    const small = measure(box, "right");
    const big = measure(box.clone().expandByScalar(5), "right");
    const a = computePose("outer", small, { vfov: 30, aspect: 1.5, focusHeight: 0.45 });
    const b = computePose("outer", big, { vfov: 30, aspect: 1.5, focusHeight: 0.45 });
    expect(b.distance / a.distance).toBeGreaterThan(3);
  });

  it("fitDistance usa el eje limitante", () => {
    expect(fitDistance(10, 1, 30, 1, 1)).toBeGreaterThan(fitDistance(1, 1, 30, 1, 1));
  });
});

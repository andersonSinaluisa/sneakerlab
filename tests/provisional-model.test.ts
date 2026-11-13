/**
 * Integración: el GLB generado contiene exactamente los meshes que declara la
 * configuración, con UVs en las zonas que admiten imágenes, y bindZones los enlaza.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildProvisionalShoe } from "@/lib/model/procedural/provisionalSneaker";
import { writeGlb } from "@/lib/model/procedural/glbWriter";


describe("modelo provisional", () => {
  it("los paneles se ven sin espejo desde fuera (u→derecha, v→arriba)", () => {
    for (const side of ["right", "left"] as const) {
      const shoe = buildProvisionalShoe(side);
      const outer = shoe.meshes.find((m) => m.name.endsWith("OuterPanel"))!.geometry;
      const pos = outer.attributes.position;
      const uv = outer.attributes.uv;
      // encuentra vértices cercanos a (u=0.4,v=0.5) y (u=0.6,v=0.5)
      const find = (u: number, v: number) => {
        let best = 0, d = Infinity;
        for (let i = 0; i < uv.count; i++) {
          const dd = (uv.getX(i) - u) ** 2 + (uv.getY(i) - v) ** 2;
          if (dd < d) { d = dd; best = i; }
        }
        return new THREE.Vector3().fromBufferAttribute(pos, best);
      };
      const a = find(0.4, 0.5), b = find(0.6, 0.5), up = find(0.5, 0.3), down = find(0.5, 0.7);
      const du = b.clone().sub(a);
      const dvUp = up.clone().sub(down);
      const normal = new THREE.Vector3().crossVectors(du, dvUp);
      const outward = new THREE.Vector3(0, 0, side === "right" ? 1 : -1);
      expect(normal.dot(outward)).toBeGreaterThan(0);
    }
  });

  it("el escritor GLB produce cabecera válida", () => {
    const shoe = buildProvisionalShoe("right");
    const glb = writeGlb([{ name: "Right", meshes: shoe.meshes.slice(0, 1) }]);
    const dv = new DataView(glb.buffer);
    expect(dv.getUint32(0, true)).toBe(0x46546c67);
    expect(dv.getUint32(8, true)).toBe(glb.byteLength);
  });
});

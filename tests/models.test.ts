/**
 * Integración: cada GLB del catálogo contiene los meshes que declara su manifiesto,
 * las zonas con imágenes tienen UVs en 0..1 y bindZones los enlaza sin advertencias.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { listModels } from "@/lib/model/registry";
import { bindZones } from "@/lib/model/bindZones";

// Node no decodifica imágenes: se omite la carga de texturas.
(globalThis as unknown as { self: unknown }).self = globalThis;
globalThis.createImageBitmap = (async () => ({ width: 1, height: 1, close() {} })) as unknown as typeof createImageBitmap;

function parse(buf: ArrayBuffer): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return new Promise((res, rej) => loader.parse(buf, "", (g) => res(g.scene), rej));
}

describe.each(listModels())("modelo $modelId", (model) => {
  it("enlaza todas las zonas sin advertencias y con UVs válidas", async () => {
    const file = readFileSync(resolve(__dirname, "../public", model.source.url.slice(1)));
    const scene = await parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    const { shoes, warnings } = bindZones(scene, model);
    expect(warnings).toEqual([]);
    for (const side of ["right", "left"] as const) {
      expect(shoes[side].zones).toHaveLength(model.zones.length);
      for (const { zone, mesh } of shoes[side].zones) {
        if (!zone.allowImages) continue;
        const uv = mesh.geometry.attributes.uv;
        expect(uv, `${zone.id} ${side} uv`).toBeDefined();
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < uv.count; i++) {
          min = Math.min(min, uv.getX(i), uv.getY(i));
          max = Math.max(max, uv.getX(i), uv.getY(i));
        }
        expect(min, `${zone.id} ${side} uv min`).toBeGreaterThanOrEqual(-0.01);
        expect(max, `${zone.id} ${side} uv max`).toBeLessThanOrEqual(1.01);
      }
    }
  });

  it("los dos zapatos son espejo: mismo tamaño, lados opuestos", async () => {
    const file = readFileSync(resolve(__dirname, "../public", model.source.url.slice(1)));
    const scene = await parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    const { shoes } = bindZones(scene, model);
    const br = new THREE.Box3().setFromObject(shoes.right.root).getSize(new THREE.Vector3());
    const bl = new THREE.Box3().setFromObject(shoes.left.root).getSize(new THREE.Vector3());
    expect(br.distanceTo(bl)).toBeLessThan(br.length() * 0.01);
    const outer = model.zones.find((z) => z.id === "outer")!;
    const cr = new THREE.Box3().setFromObject(shoes.right.root.getObjectByName(outer.meshNames.right)!).getCenter(new THREE.Vector3());
    const cl = new THREE.Box3().setFromObject(shoes.left.root.getObjectByName(outer.meshNames.left)!).getCenter(new THREE.Vector3());
    expect(cr.z).toBeGreaterThan(0);
    expect(cl.z).toBeLessThan(0);
  });
});

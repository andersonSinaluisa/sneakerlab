/**
 * Mide en milímetros las zonas imprimibles de cada modelo y lo guarda en su manifiesto:
 *   zones[].texture.printMm  → ancho × alto físicos de la textura completa de la zona
 *   print.referenceSizeEU    → talla EU equivalente a la longitud del modelo
 * El paquete de producción (DTF) escala desde ahí a la talla de cada pedido.
 *
 *   npm run model:print-sizes            (tras regenerar un GLB con model:prepare*)
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { NodeIO, type Node as GNode } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { measureUvScale, outsoleLengthMm } from "../src/lib/print/measure";

type Mat4 = number[];
const apply = (m: Mat4, x: number, y: number, z: number) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const dir = resolve("src/config/models");

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const path = resolve(dir, file);
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const doc = await io.read(resolve("public", manifest.source.url.replace(/^\//, "")));
  const nodes = new Map<string, GNode>(doc.getRoot().listNodes().map((n) => [n.getName(), n]));

  // Longitud del modelo (eje mayor del bounding box de ambos zapatos) → talla de referencia
  const right = nodes.get(manifest.shoes.right.nodeName);
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const visit = (n: GNode) => {
    const mesh = n.getMesh();
    if (mesh) {
      const m = n.getWorldMatrix() as unknown as Mat4;
      for (const p of mesh.listPrimitives()) {
        const pos = p.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          const [x, y, z] = pos.getElement(i, []) as number[];
          const w = apply(m, x, y, z);
          min = min.map((v, k) => Math.min(v, w[k]));
          max = max.map((v, k) => Math.max(v, w[k]));
        }
      }
    }
    n.listChildren().forEach(visit);
  };
  if (right) visit(right);
  const lengthMm = Math.max(...max.map((v, k) => v - min[k])) * 1000 * (manifest.unitScale ?? 1);
  const referenceSizeEU = Math.round(((lengthMm - outsoleLengthMm(0)) / (20 / 3)) * 2) / 2;
  manifest.print = { ...(manifest.print ?? {}), referenceSizeEU };

  const report: string[] = [];
  for (const zone of manifest.zones) {
    if (!zone.texture) continue;
    const node = nodes.get(zone.meshNames.right);
    const mesh = node?.getMesh();
    if (!node || !mesh) { report.push(`${zone.id}: malla ${zone.meshNames.right} no encontrada`); continue; }
    const m = node.getWorldMatrix() as unknown as Mat4;
    const positions: number[] = [], uvs: number[] = [], index: number[] = [];
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute("POSITION"), uv = p.getAttribute("TEXCOORD_0"), idx = p.getIndices();
      if (!pos || !uv) continue;
      const base = positions.length / 3;
      for (let i = 0; i < pos.getCount(); i++) {
        const [x, y, z] = pos.getElement(i, []) as number[];
        positions.push(...apply(m, x, y, z).map((v) => v * (manifest.unitScale ?? 1)));
        uvs.push(...(uv.getElement(i, []) as number[]));
      }
      if (idx) for (let i = 0; i < idx.getCount(); i++) index.push(base + idx.getScalar(i));
      else for (let i = 0; i < pos.getCount(); i++) index.push(base + i);
    }
    zone.texture.printMm = measureUvScale(positions, uvs, index);
    report.push(`${zone.id}: ${zone.texture.printMm.width} × ${zone.texture.printMm.height} mm`);
  }
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`${manifest.modelId}: ${lengthMm.toFixed(0)} mm ≈ EU ${referenceSizeEU}\n  ${report.join("\n  ")}`);
}

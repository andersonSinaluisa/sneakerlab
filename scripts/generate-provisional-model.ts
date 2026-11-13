/**
 * Genera public/models/sneaker-low-01.glb (MODELO PROVISIONAL).
 * Uso: npm run model:generate
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildProvisionalShoe,
  measurePanelAspect,
} from "../src/lib/model/procedural/provisionalSneaker";
import { writeGlb } from "../src/lib/model/procedural/glbWriter";

const right = buildProvisionalShoe("right");
const left = buildProvisionalShoe("left");

const glb = writeGlb(
  [
    { name: right.nodeName, meshes: right.meshes },
    { name: left.nodeName, meshes: left.meshes },
  ],
  { provisional: true, note: "Modelo provisional generado proceduralmente. Reemplazar por modelo profesional." },
);

const out = resolve(process.cwd(), "public/models/sneaker-low-01.glb");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, glb);
console.log(`GLB escrito: ${out} (${(glb.byteLength / 1024).toFixed(1)} KB)`);

for (const m of right.meshes) {
  if (/Panel|Toe|Heel|Tongue/.test(m.name)) {
    console.log(`  ${m.name}: aspecto físico ≈ ${measurePanelAspect(m.geometry).toFixed(2)}`);
  }
}

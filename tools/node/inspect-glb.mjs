import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
const file = process.argv[2];
const buf = readFileSync(file);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
// JSON header
const dv = new DataView(ab); const jl = dv.getUint32(12, true);
const json = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 20, jl)));
console.log("generator:", json.asset?.generator, "| ext:", json.extensionsUsed, "| images:", (json.images||[]).length, "| textures:", (json.textures||[]).length);
// Node: sin decodificador de imágenes; se ignoran las texturas para inspeccionar geometría.
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
globalThis.URL.createObjectURL ??= () => "blob:";
console.log("materials:", (json.materials||[]).map(m=>m.name).join(", "));
console.log("nodes:", (json.nodes||[]).map(n=>n.name).join(", "));
console.log("images:", (json.images||[]).map(i=>`${i.mimeType} ${i.bufferView!==undefined?"(embedded)":i.uri}`).join(", "));
const loader = new GLTFLoader();
loader.setDRACOLoader(new DRACOLoader().setDecoderPath("node_modules/three/examples/jsm/libs/draco/"));
loader.parse(ab, "", (g) => {
  const box = new THREE.Box3().setFromObject(g.scene); const size = box.getSize(new THREE.Vector3());
  console.log("bbox size:", size.toArray().map(v=>v.toFixed(3)), "min:", box.min.toArray().map(v=>v.toFixed(3)));
  let tris = 0;
  g.scene.traverse((o) => {
    if (o.isMesh) {
      const geo = o.geometry; const n = geo.index ? geo.index.count/3 : geo.attributes.position.count/3; tris += n;
      const uv = geo.attributes.uv; let ur = "no-uv";
      if (uv) { let mn=[9,9],mx=[-9,-9]; for (let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i); mn=[Math.min(mn[0],u),Math.min(mn[1],v)]; mx=[Math.max(mx[0],u),Math.max(mx[1],v)];} ur=`uv[${mn.map(x=>x.toFixed(2))}..${mx.map(x=>x.toFixed(2))}]`; }
      const mats = Array.isArray(o.material)?o.material:[o.material];
      const b = new THREE.Box3().setFromObject(o); const c = b.getCenter(new THREE.Vector3()); const s=b.getSize(new THREE.Vector3());
      console.log(`MESH ${o.name} | parent=${o.parent?.name} | tris=${n} | ${ur} | mats=${mats.map(m=>`${m.name}[map:${!!m.map},nrm:${!!m.normalMap},rough:${!!m.roughnessMap},color:#${m.color?.getHexString()}]`).join(";")} | center=${c.toArray().map(v=>v.toFixed(2))} size=${s.toArray().map(v=>v.toFixed(2))}`);
    } else if (o.type !== "Mesh") console.log(`NODE ${o.type} ${o.name} children=${o.children.length}`);
  });
  console.log("total tris:", tris);
}, (e) => console.error("ERR", e));

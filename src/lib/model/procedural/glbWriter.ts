/**
 * Escritor GLB mínimo (glTF 2.0 binario) sin dependencias de navegador.
 * Solo se usa para exportar el modelo provisional desde Node.
 */
import type * as THREE from "three";

export interface GlbMeshInput {
  name: string;
  geometry: THREE.BufferGeometry;
  color: [number, number, number];
}
export interface GlbNodeInput {
  name: string;
  meshes: GlbMeshInput[];
}

const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const FLOAT = 5126;
const UNSIGNED_INT = 5125;

export function writeGlb(nodesIn: GlbNodeInput[], extras: Record<string, unknown> = {}): Uint8Array {
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  const bufferViews: object[] = [];
  const accessors: object[] = [];
  const meshes: object[] = [];
  const materials: object[] = [];
  const nodes: object[] = [];

  const pushView = (data: ArrayBufferView, target: number) => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const pad = (4 - (byteLength % 4)) % 4;
    if (pad) {
      chunks.push(new Uint8Array(pad));
      byteLength += pad;
    }
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.byteLength, target });
    chunks.push(bytes);
    byteLength += bytes.byteLength;
    return bufferViews.length - 1;
  };

  const pushAccessor = (
    arr: Float32Array | Uint32Array,
    itemSize: number,
    target: number,
    withBounds = false,
  ) => {
    const view = pushView(arr, target);
    const type = itemSize === 1 ? "SCALAR" : `VEC${itemSize}`;
    const acc: Record<string, unknown> = {
      bufferView: view,
      componentType: arr instanceof Float32Array ? FLOAT : UNSIGNED_INT,
      count: arr.length / itemSize,
      type,
    };
    if (withBounds) {
      const min = new Array(itemSize).fill(Infinity);
      const max = new Array(itemSize).fill(-Infinity);
      for (let i = 0; i < arr.length; i++) {
        const k = i % itemSize;
        min[k] = Math.min(min[k], arr[i]);
        max[k] = Math.max(max[k], arr[i]);
      }
      acc.min = min;
      acc.max = max;
    }
    accessors.push(acc);
    return accessors.length - 1;
  };

  const rootChildren: number[] = [];
  for (const n of nodesIn) {
    const childIdx: number[] = [];
    for (const m of n.meshes) {
      const g = m.geometry;
      const pos = new Float32Array(g.attributes.position.array as ArrayLike<number>);
      const nor = new Float32Array(g.attributes.normal.array as ArrayLike<number>);
      const attributes: Record<string, number> = {
        POSITION: pushAccessor(pos, 3, ARRAY_BUFFER, true),
        NORMAL: pushAccessor(nor, 3, ARRAY_BUFFER),
      };
      if (g.attributes.uv) {
        attributes.TEXCOORD_0 = pushAccessor(
          new Float32Array(g.attributes.uv.array as ArrayLike<number>),
          2,
          ARRAY_BUFFER,
        );
      }
      let indices: Uint32Array;
      if (g.index) indices = new Uint32Array(g.index.array as ArrayLike<number>);
      else indices = Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
      const idxAcc = pushAccessor(indices, 1, ELEMENT_ARRAY_BUFFER);

      materials.push({
        name: `${m.name}_mat`,
        pbrMetallicRoughness: {
          baseColorFactor: [...m.color, 1],
          metallicFactor: 0,
          roughnessFactor: 0.7,
        },
      });
      meshes.push({
        name: m.name,
        primitives: [{ attributes, indices: idxAcc, material: materials.length - 1 }],
      });
      nodes.push({ name: m.name, mesh: meshes.length - 1 });
      childIdx.push(nodes.length - 1);
    }
    nodes.push({ name: n.name, children: childIdx });
    rootChildren.push(nodes.length - 1);
  }

  const json = {
    asset: { version: "2.0", generator: "SneakerLab provisional generator" },
    scene: 0,
    scenes: [{ name: "Scene", nodes: rootChildren }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength }],
    extras,
  };

  const bin = new Uint8Array(byteLength + ((4 - (byteLength % 4)) % 4));
  let off = 0;
  for (const c of chunks) {
    bin.set(c, off);
    off += c.byteLength;
  }

  let jsonStr = JSON.stringify(json);
  while (jsonStr.length % 4) jsonStr += " ";
  const jsonBytes = new TextEncoder().encode(jsonStr);

  const total = 12 + 8 + jsonBytes.byteLength + 8 + bin.byteLength;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.byteLength, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  out.set(jsonBytes, 20);
  const binHeader = 20 + jsonBytes.byteLength;
  dv.setUint32(binHeader, bin.byteLength, true);
  dv.setUint32(binHeader + 4, 0x004e4942, true); // 'BIN\0'
  out.set(bin, binHeader + 8);
  return out;
}

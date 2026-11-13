/**
 * Preparación de un GLB profesional para SneakerLab (alternativa en Node al pipeline de Blender).
 *
 *   node tools/node/prepare-sneaker.mjs --input assets/src/white.glb --recipe tools/node/recipes/unbranded-white.json \
 *        --output public/models/court-low-01.glb --manifest src/config/models/court-low-01.json
 *
 * Pasos (no destructivos: el archivo de entrada no se modifica):
 *  1. Aplica las transformaciones de nodos a la geometría y normaliza escala/orientación:
 *     largo = `lengthMeters`, suelo en y=0, centro en el origen, punta hacia +X, exterior del derecho hacia +Z.
 *  2. Divide mallas en zonas por reglas espaciales (`split`) y une mallas que forman una misma zona (`join`).
 *  3. En zonas con impresión: normaliza las UV al rango 0..1 de su caja envolvente y corrige la
 *     orientación (u → derecha, v → abajo vistas desde fuera) con una cámara de referencia por zona.
 *     Mide la proporción física del panel para dimensionar el lienzo de textura.
 *  4. Genera el zapato izquierdo por espejo (z → −z, normales y sentido de las caras corregidos) y
 *     repite la corrección de orientación UV para la nueva vista.
 *  5. Simplifica mallas pesadas, suelda, cuantiza y comprime con meshopt.
 *  6. Escribe el GLB (nodos raíz `Right` y `Left`) y el manifiesto JSON de SneakerLab.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { Document, NodeIO, Primitive, Accessor } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, simplify, weld, meshopt, transformPrimitive, joinPrimitives } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
if (!args.input || !args.recipe || !args.output) {
  console.error("Uso: --input <glb> --recipe <json> --output <glb> [--manifest <json>] [--report <json>]");
  process.exit(2);
}
const recipe = JSON.parse(readFileSync(args.recipe, "utf8"));
const report = { errors: [], warnings: [], info: [], zones: {} };
const warn = (m) => (report.warnings.push(m), console.warn("[WARN]", m));
const note = (m) => (report.info.push(m), console.log("[INFO]", m));
const fail = (m) => (report.errors.push(m), console.error("[ERROR]", m));

// ---------------------------------------------------------------------------
// Utilidades de geometría
// ---------------------------------------------------------------------------
const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};

/** Matriz 4x4 (column-major) de la transformación mundo de un nodo. */
function worldMatrix(node) {
  return node.getWorldMatrix();
}

/** Convierte una primitiva indexada en arrays planos. */
function readPrim(prim) {
  const pos = prim.getAttribute("POSITION");
  const nor = prim.getAttribute("NORMAL");
  const uv = prim.getAttribute("TEXCOORD_0");
  const idx = prim.getIndices();
  const count = pos.getCount();
  const positions = new Float32Array(count * 3);
  const normals = nor ? new Float32Array(count * 3) : null;
  const uvs = uv ? new Float32Array(count * 2) : null;
  const p = [0, 0, 0], n = [0, 0, 0], t = [0, 0];
  for (let i = 0; i < count; i++) {
    pos.getElement(i, p); positions.set(p, i * 3);
    if (normals) { nor.getElement(i, n); normals.set(n, i * 3); }
    if (uvs) { uv.getElement(i, t); uvs.set(t, i * 2); }
  }
  let indices;
  if (idx) { indices = new Uint32Array(idx.getCount()); for (let i = 0; i < indices.length; i++) indices[i] = idx.getScalar(i); }
  else indices = Uint32Array.from({ length: count }, (_, i) => i);
  return { positions, normals, uvs, indices };
}

function writePrim(doc, geo, material, name) {
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  const prim = doc.createPrimitive().setMode(Primitive.Mode.TRIANGLES);
  prim.setAttribute("POSITION", doc.createAccessor().setType(Accessor.Type.VEC3).setArray(geo.positions).setBuffer(buffer));
  if (geo.normals) prim.setAttribute("NORMAL", doc.createAccessor().setType(Accessor.Type.VEC3).setArray(geo.normals).setBuffer(buffer));
  if (geo.uvs) prim.setAttribute("TEXCOORD_0", doc.createAccessor().setType(Accessor.Type.VEC2).setArray(geo.uvs).setBuffer(buffer));
  prim.setIndices(doc.createAccessor().setType(Accessor.Type.SCALAR).setArray(geo.indices).setBuffer(buffer));
  if (material) prim.setMaterial(material);
  return doc.createMesh(name).addPrimitive(prim);
}

/** Reparte los triángulos de una geometría en cubetas según el centroide. Reindexa vértices. */
function splitGeometry(geo, bucketOf) {
  const out = new Map();
  const { positions, normals, uvs, indices } = geo;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    const cx = (positions[a * 3] + positions[b * 3] + positions[c * 3]) / 3;
    const cy = (positions[a * 3 + 1] + positions[b * 3 + 1] + positions[c * 3 + 1]) / 3;
    const cz = (positions[a * 3 + 2] + positions[b * 3 + 2] + positions[c * 3 + 2]) / 3;
    const key = bucketOf([cx, cy, cz]);
    if (!out.has(key)) out.set(key, { map: new Map(), pos: [], nor: [], uv: [], idx: [] });
    const bk = out.get(key);
    for (const i of [a, b, c]) {
      let ni = bk.map.get(i);
      if (ni === undefined) {
        ni = bk.pos.length / 3;
        bk.map.set(i, ni);
        bk.pos.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        if (normals) bk.nor.push(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        if (uvs) bk.uv.push(uvs[i * 2], uvs[i * 2 + 1]);
      }
      bk.idx.push(ni);
    }
  }
  const result = {};
  for (const [k, bk] of out) {
    result[k] = {
      positions: Float32Array.from(bk.pos),
      normals: normals ? Float32Array.from(bk.nor) : null,
      uvs: uvs ? Float32Array.from(bk.uv) : null,
      indices: Uint32Array.from(bk.idx),
    };
  }
  return result;
}

function mergeGeometries(list) {
  const total = list.reduce((s, g) => s + g.positions.length / 3, 0);
  const positions = new Float32Array(total * 3);
  const hasN = list.every((g) => g.normals), hasUV = list.every((g) => g.uvs);
  const normals = hasN ? new Float32Array(total * 3) : null;
  const uvs = hasUV ? new Float32Array(total * 2) : null;
  const indices = new Uint32Array(list.reduce((s, g) => s + g.indices.length, 0));
  let vo = 0, io = 0;
  for (const g of list) {
    positions.set(g.positions, vo * 3);
    if (normals) normals.set(g.normals, vo * 3);
    if (uvs) uvs.set(g.uvs, vo * 2);
    for (let i = 0; i < g.indices.length; i++) indices[io + i] = g.indices[i] + vo;
    vo += g.positions.length / 3; io += g.indices.length;
  }
  return { positions, normals, uvs, indices };
}

/**
 * Corta una geometría por el plano `axis = value` dividiendo los triángulos que lo cruzan
 * (posición, normal y UV interpoladas). Devuelve { below, above } (above: coordenada ≥ value).
 * Da un borde recto en lugar del dentado de asignar triángulos enteros por centroide.
 */
function clipByPlane(geo, axis, value) {
  const { positions, normals, uvs, indices } = geo;
  const P = Array.from(positions), N = normals ? Array.from(normals) : null, T = uvs ? Array.from(uvs) : null;
  const edgeCache = new Map();
  const side = (i) => P[i * 3 + axis] >= value;
  const cut = (a, b) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (edgeCache.has(key)) return edgeCache.get(key);
    const t = (value - P[a * 3 + axis]) / (P[b * 3 + axis] - P[a * 3 + axis]);
    const ni = P.length / 3;
    for (let k = 0; k < 3; k++) P.push(P[a * 3 + k] + (P[b * 3 + k] - P[a * 3 + k]) * t);
    P[ni * 3 + axis] = value;
    if (N) {
      const n = [0, 1, 2].map((k) => N[a * 3 + k] + (N[b * 3 + k] - N[a * 3 + k]) * t);
      const l = Math.hypot(...n) || 1;
      N.push(n[0] / l, n[1] / l, n[2] / l);
    }
    if (T) for (let k = 0; k < 2; k++) T.push(T[a * 2 + k] + (T[b * 2 + k] - T[a * 2 + k]) * t);
    edgeCache.set(key, ni);
    return ni;
  };
  const out = { below: [], above: [] };
  for (let t = 0; t < indices.length; t += 3) {
    const tri = [indices[t], indices[t + 1], indices[t + 2]];
    const s = tri.map(side);
    if (s[0] === s[1] && s[1] === s[2]) { out[s[0] ? "above" : "below"].push(...tri); continue; }
    // Recorre el triángulo en orden y reparte vértices + intersecciones en dos polígonos (conserva el sentido).
    const poly = { above: [], below: [] };
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3];
      poly[s[k] ? "above" : "below"].push(a);
      if (s[k] !== s[(k + 1) % 3]) { const m = cut(a, b); poly.above.push(m); poly.below.push(m); }
    }
    for (const which of ["above", "below"]) {
      const p = poly[which];
      for (let k = 1; k + 1 < p.length; k++) out[which].push(p[0], p[k], p[k + 1]);
    }
  }
  const full = { positions: Float32Array.from(P), normals: N ? Float32Array.from(N) : null, uvs: T ? Float32Array.from(T) : null };
  const pick = (idx) => idx.length ? splitGeometry({ ...full, indices: Uint32Array.from(idx) }, () => "in").in : null;
  return { below: pick(out.below), above: pick(out.above) };
}

/**
 * Divide una geometría en componentes conexos (vértices soldados por posición), ordenados por número
 * de triángulos de mayor a menor; los empates se ordenan por centroide (x, luego z) para que los
 * índices de la receta sean estables.
 */
function splitComponents(geo) {
  const keyOf = new Map();
  const vid = new Uint32Array(geo.positions.length / 3);
  for (let i = 0; i < vid.length; i++) {
    const k = `${geo.positions[i * 3].toFixed(6)},${geo.positions[i * 3 + 1].toFixed(6)},${geo.positions[i * 3 + 2].toFixed(6)}`;
    if (!keyOf.has(k)) keyOf.set(k, keyOf.size);
    vid[i] = keyOf.get(k);
  }
  const parent = Uint32Array.from({ length: keyOf.size }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
  const tri = geo.indices;
  for (let t = 0; t < tri.length; t += 3) {
    const a = find(vid[tri[t]]);
    parent[find(vid[tri[t + 1]])] = a;
    parent[find(vid[tri[t + 2]])] = a;
  }
  const groups = new Map();
  for (let t = 0; t < tri.length; t += 3) {
    const r = find(vid[tri[t]]);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(t);
  }
  const comps = [...groups.values()].map((tris) => {
    const sub = splitGeometry({ ...geo, indices: Uint32Array.from(tris.flatMap((t) => [tri[t], tri[t + 1], tri[t + 2]])) }, () => "in").in;
    const b = bounds(sub);
    return { geo: sub, n: tris.length, cx: b.center[0], cz: b.center[2] };
  });
  comps.sort((a, b) => b.n - a.n || a.cx - b.cx || a.cz - b.cz);
  return comps.map((c) => c.geo);
}

function bounds(geo) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < geo.positions.length; i += 3)
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], geo.positions[i + k]); max[k] = Math.max(max[k], geo.positions[i + k]); }
  return { min, max, size: v3.sub(max, min), center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2] };
}

/** Aplica una transformación afín (rotación 180° Y opcional, espejo, escala, traslación) a la geometría. */
function transformGeometry(geo, { rotateY180 = false, mirrorZ = false, scale = 1, translate = [0, 0, 0] }) {
  const { positions, normals, indices } = geo;
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (rotateY180) { x = -x; z = -z; }
    if (mirrorZ) z = -z;
    positions[i] = x * scale + translate[0]; positions[i + 1] = y * scale + translate[1]; positions[i + 2] = z * scale + translate[2];
    if (normals) {
      let nx = normals[i], nz = normals[i + 2];
      if (rotateY180) { nx = -nx; nz = -nz; }
      if (mirrorZ) nz = -nz;
      normals[i] = nx; normals[i + 2] = nz;
    }
  }
  if (mirrorZ) for (let t = 0; t < indices.length; t += 3) { const tmp = indices[t + 1]; indices[t + 1] = indices[t + 2]; indices[t + 2] = tmp; }
  return geo;
}

// ---------------------------------------------------------------------------
// UVs: normalización, orientación y proporción física
// ---------------------------------------------------------------------------

/** Cámaras de referencia por zona: desde dónde se mira el panel y qué dirección es "arriba" en pantalla. */
function referenceCamera(zoneId, sideSign) {
  const o = sideSign; // exterior del zapato: +Z derecho, −Z izquierdo
  switch (zoneId) {
    case "outer": return { forward: [0, 0, -o], up: [0, 1, 0] };
    case "inner": return { forward: [0, 0, o], up: [0, 1, 0] };
    case "toe": return { forward: [-1, -0.4, 0], up: [0, 1, 0] };
    case "heel": return { forward: [1, -0.3, 0], up: [0, 1, 0] };
    case "tongue": return { forward: [0.3, -1, 0], up: [-1, 0, 0] }; // desde arriba, tobillo = arriba
    case "upper":
    case "vamp": return { forward: [0, -1, -o * 0.6], up: [-1, 0, 0] };
    default: return { forward: [0, 0, -o], up: [0, 1, 0] };
  }
}

/** Tangentes medias ponderadas por área UV: dirección y longitud en mundo de una unidad de u y de v. */
function uvTangents(positions, uvs, indices) {
  let T = [0, 0, 0], B = [0, 0, 0], lenT = 0, lenB = 0, n = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const p0 = [positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]];
    const p1 = [positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]];
    const p2 = [positions[c * 3], positions[c * 3 + 1], positions[c * 3 + 2]];
    const e1 = v3.sub(p1, p0), e2 = v3.sub(p2, p0);
    const du1 = uvs[b * 2] - uvs[a * 2], dv1 = uvs[b * 2 + 1] - uvs[a * 2 + 1];
    const du2 = uvs[c * 2] - uvs[a * 2], dv2 = uvs[c * 2 + 1] - uvs[a * 2 + 1];
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-12) continue;
    const tt = v3.scale(v3.sub(v3.scale(e1, dv2), v3.scale(e2, dv1)), 1 / det);
    const bb = v3.scale(v3.sub(v3.scale(e2, du1), v3.scale(e1, du2)), 1 / det);
    const w = Math.abs(det);
    T = [T[0] + tt[0] * w, T[1] + tt[1] * w, T[2] + tt[2] * w];
    B = [B[0] + bb[0] * w, B[1] + bb[1] * w, B[2] + bb[2] * w];
    lenT += v3.len(tt) * w; lenB += v3.len(bb) * w; n += w;
  }
  return { T, B, lenT: lenT / (n || 1), lenB: lenB / (n || 1) };
}

/**
 * Normaliza UVs a 0..1 y orienta: u crece hacia la derecha de la cámara, v hacia abajo.
 * Devuelve la proporción física ancho/alto del panel.
 */
function normalizeUVs(geo, zoneId, sideSign) {
  const { positions, uvs, indices } = geo;
  if (!uvs) return null;
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (let i = 0; i < uvs.length; i += 2) { u0 = Math.min(u0, uvs[i]); u1 = Math.max(u1, uvs[i]); v0 = Math.min(v0, uvs[i + 1]); v1 = Math.max(v1, uvs[i + 1]); }
  const du = u1 - u0 || 1, dv = v1 - v0 || 1;
  for (let i = 0; i < uvs.length; i += 2) { uvs[i] = (uvs[i] - u0) / du; uvs[i + 1] = (uvs[i + 1] - v0) / dv; }

  const cam = referenceCamera(zoneId, sideSign);
  const fwd = v3.norm(cam.forward);
  const right = v3.norm(v3.cross(fwd, cam.up));
  const up = v3.norm(v3.cross(right, fwd));
  let { T, B, lenT, lenB } = uvTangents(positions, uvs, indices);
  // ¿Panel desenvuelto girado 90°? Entonces u recorre la vertical: intercambiamos u↔v.
  let swapped = false;
  if (Math.abs(v3.dot(v3.norm(T), right)) < Math.abs(v3.dot(v3.norm(T), up))) {
    swapped = true;
    for (let i = 0; i < uvs.length; i += 2) { const tmp = uvs[i]; uvs[i] = uvs[i + 1]; uvs[i + 1] = tmp; }
    ({ T, B, lenT, lenB } = uvTangents(positions, uvs, indices));
  }
  const flipU = v3.dot(T, right) < 0;
  const flipV = v3.dot(B, up) > 0; // v debe crecer hacia abajo
  if (flipU || flipV) for (let i = 0; i < uvs.length; i += 2) { if (flipU) uvs[i] = 1 - uvs[i]; if (flipV) uvs[i + 1] = 1 - uvs[i + 1]; }
  if (swapped) note(`${zoneId} (${sideSign > 0 ? "R" : "L"}): UV giradas 90°, corregidas`);
  return { aspect: lenT / lenB, flipU, flipV, swapped, uvRange: { u0, v0, u1, v1 } };
}

/**
 * Proyección planar: u a la derecha de la cámara de referencia, v hacia abajo. Ideal para paneles
 * casi planos (laterales, lengüeta). Devuelve la proporción física ancho/alto.
 */
function projectPlanar(geo, zoneId, sideSign) {
  const cam = referenceCamera(zoneId, sideSign);
  const fwd = v3.norm(cam.forward);
  const right = v3.norm(v3.cross(fwd, cam.up));
  const up = v3.norm(v3.cross(right, fwd));
  const { positions } = geo;
  const n = positions.length / 3;
  const uvs = new Float32Array(n * 2);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const p = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    const u = v3.dot(p, right), v = -v3.dot(p, up);
    uvs[i * 2] = u; uvs[i * 2 + 1] = v;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  for (let i = 0; i < n; i++) { uvs[i * 2] = (uvs[i * 2] - u0) / (u1 - u0); uvs[i * 2 + 1] = (uvs[i * 2 + 1] - v0) / (v1 - v0); }
  geo.uvs = uvs;
  return { aspect: (u1 - u0) / (v1 - v0), mode: "planar" };
}

/**
 * Proyección cilíndrica alrededor del eje vertical que pasa por `center` (x,z): u = ángulo, v = altura.
 * Para la punta (`facing` = +1: el eje mira a +X) y el talón (`facing` = −1). Envuelve paneles curvos
 * sin el estiramiento lateral de una proyección plana. u crece hacia la derecha del espectador.
 */
function projectCylindrical(geo, center, facing) {
  const { positions } = geo;
  const n = positions.length / 3;
  const uvs = new Float32Array(n * 2);
  let a0 = Infinity, a1 = -Infinity, y0 = Infinity, y1 = -Infinity, rSum = 0;
  for (let i = 0; i < n; i++) {
    const dx = (positions[i * 3] - center[0]) * facing, dz = positions[i * 3 + 2] - center[1];
    // Espectador frente al panel: para la punta (mira hacia −X) su derecha es −Z; para el talón, +Z.
    const angle = Math.atan2(dz, dx) * -facing;
    const y = positions[i * 3 + 1];
    uvs[i * 2] = angle; uvs[i * 2 + 1] = -y;
    a0 = Math.min(a0, angle); a1 = Math.max(a1, angle); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    rSum += Math.hypot(dx, dz);
  }
  for (let i = 0; i < n; i++) { uvs[i * 2] = (uvs[i * 2] - a0) / (a1 - a0); uvs[i * 2 + 1] = (uvs[i * 2 + 1] + y1) / (y1 - y0); }
  geo.uvs = uvs;
  const arc = (rSum / n) * (a1 - a0);
  return { aspect: arc / (y1 - y0), mode: "cylindrical", arcDeg: +((a1 - a0) * 180 / Math.PI).toFixed(0) };
}

/** Elige y aplica la proyección UV de una zona imprimible según la receta. */
function buildPrintUVs(geo, zoneId, rule, sideSign, lengthFractionToX) {
  const mode = rule.uv ?? (zoneId === "toe" || zoneId === "heel" ? "cylindrical" : "planar");
  if (mode === "keep") return normalizeUVs(geo, zoneId, sideSign);
  if (mode === "planar") return projectPlanar(geo, zoneId, sideSign);
  const b = bounds(geo);
  const facing = zoneId === "heel" || rule.facing === "-x" ? -1 : 1;
  // Eje del cilindro: en el plano de corte de la región (borde trasero de la punta / delantero del talón)
  const cx = rule.region?.xFrom !== undefined && facing > 0 ? lengthFractionToX(rule.region.xFrom)
    : rule.region?.xTo !== undefined && facing < 0 ? lengthFractionToX(rule.region.xTo)
    : facing > 0 ? b.min[0] : b.max[0];
  return projectCylindrical(geo, [cx, 0], facing);
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const src = await io.read(resolve(args.input));

// 1) Geometrías en espacio mundo, indexadas por nombre de nodo/malla
const sourceGeos = new Map();
const sourceMaterials = new Map();
const seenNames = new Map();
for (const node of src.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const m = worldMatrix(node);
  // Nombres duplicados (frecuente en exportaciones de Sketchfab): se sufijan _1, _2… como hace three.js
  const base = node.getName() || mesh.getName();
  const seen = seenNames.get(base) ?? 0;
  seenNames.set(base, seen + 1);
  const key = seen ? `${base}_${seen}` : base;
  // Mallas descartadas (logotipos, piezas sueltas): fuera antes de normalizar para no alterar la caja.
  if (recipe.exclude?.includes(key)) { note(`Malla excluida: ${key}`); continue; }
  for (const prim of mesh.listPrimitives()) {
    const clone = prim.clone();
    transformPrimitive(clone, m);
    const geo = readPrim(clone);
    const existing = sourceGeos.get(key);
    sourceGeos.set(key, existing ? mergeGeometries([existing, geo]) : geo);
    if (!sourceMaterials.has(key)) sourceMaterials.set(key, prim.getMaterial());
    clone.dispose();
  }
}
note(`Mallas de origen: ${[...sourceGeos.keys()].join(", ")}`);

// 2) Normalización global de escala y orientación (sobre la unión de todo)
const all = mergeGeometries([...sourceGeos.values()]);
const gb = bounds(all);
const longAxis = gb.size[0] >= gb.size[2] ? 0 : 2;
if (longAxis !== 0) fail("El eje largo del zapato no es X; añade una rotación previa en la receta (no implementado)");
const scale = recipe.lengthMeters / gb.size[0];
// ¿Hacia dónde apunta la punta? La receta lo fija ("toe": "+x" | "-x"); por defecto se detecta por anchura
const rotateY180 = recipe.toe === "-x";
const mirrorInput = recipe.inputIsLeftShoe === true;
const t0 = { rotateY180, mirrorZ: mirrorInput, scale, translate: [0, 0, 0] };
for (const geo of sourceGeos.values()) transformGeometry(geo, t0);
const gb2 = bounds(mergeGeometries([...sourceGeos.values()]));
const translate = [-gb2.center[0], -gb2.min[1], -gb2.center[2]];
for (const geo of sourceGeos.values()) for (let i = 0; i < geo.positions.length; i += 3) { geo.positions[i] += translate[0]; geo.positions[i + 1] += translate[1]; geo.positions[i + 2] += translate[2]; }
const finalBounds = bounds(mergeGeometries([...sourceGeos.values()]));
note(`Normalizado: largo ${finalBounds.size[0].toFixed(3)} m, alto ${finalBounds.size[1].toFixed(3)} m, ancho ${finalBounds.size[2].toFixed(3)} m`);

// 3) Zonas: split / join / 1:1
const zoneGeos = new Map(); // zoneId -> geo (zapato derecho)
const zoneMaterialSrc = new Map();
const L = finalBounds.size[0];
const xAt = (f) => finalBounds.min[0] + L * f; // fracción del largo (0 = talón, 1 = punta)

for (const name of recipe.exclude ?? []) if (!seenNames.has(name.replace(/_\d+$/, "")) && !seenNames.has(name)) warn(`exclude: no existe la malla "${name}"`);

// Componentes conexos por malla (para assets que traen varios paneles en una sola malla).
const componentCache = new Map();
const usedComponents = new Map(); // malla -> Set(índices)
function componentsFor(srcName) {
  if (!componentCache.has(srcName)) componentCache.set(srcName, splitComponents(sourceGeos.get(srcName)));
  return componentCache.get(srcName);
}
for (const [mesh, list] of Object.entries(recipe.dropComponents ?? {})) {
  if (!sourceGeos.has(mesh)) { fail(`dropComponents: no existe la malla "${mesh}"`); continue; }
  const set = usedComponents.get(mesh) ?? new Set();
  for (const i of list) set.add(i);
  usedComponents.set(mesh, set);
  note(`${mesh}: componentes descartados ${list.join(", ")} (${list.map((i) => componentsFor(mesh)[i]?.indices.length / 3).join(", ")} triángulos)`);
}

for (const [zoneId, rule] of Object.entries(recipe.zones)) {
  const parts = [];
  for (const entry of rule.from) {
    // "malla" o { "mesh": "malla", "components": [índices por tamaño, de mayor a menor] }
    const srcName = typeof entry === "string" ? entry : entry.mesh;
    let g = sourceGeos.get(srcName);
    if (!g) { fail(`Zona ${zoneId}: no existe la malla de origen "${srcName}"`); continue; }
    if (typeof entry !== "string" && entry.components) {
      const comps = componentsFor(srcName);
      const missing = entry.components.filter((i) => !comps[i]);
      if (missing.length) { fail(`Zona ${zoneId}: ${srcName} no tiene los componentes ${missing.join(", ")} (hay ${comps.length})`); continue; }
      g = mergeGeometries(entry.components.map((i) => comps[i]));
      const set = usedComponents.get(srcName) ?? new Set();
      for (const i of entry.components) set.add(i);
      usedComponents.set(srcName, set);
    }
    if (!zoneMaterialSrc.has(zoneId)) zoneMaterialSrc.set(zoneId, sourceMaterials.get(srcName));
    // La región puede declararse por entrada (solo recorta esa malla/componentes) o para toda la zona.
    const region = typeof entry !== "string" && "region" in entry ? entry.region : rule.region;
    if (region?.cut === "exact") {
      // Corte por planos: los triángulos que cruzan el límite se dividen (borde recto).
      let piece = g;
      if (piece && region.xFrom !== undefined) piece = clipByPlane(piece, 0, xAt(region.xFrom)).above;
      if (piece && region.xTo !== undefined) piece = clipByPlane(piece, 0, xAt(region.xTo)).below;
      if (piece && region.zSide !== undefined) piece = clipByPlane(piece, 2, 0)[region.zSide === "outer" ? "above" : "below"];
      if (piece) parts.push(piece); else warn(`Zona ${zoneId}: la región no contiene triángulos de ${srcName}`);
    } else if (region) {
      // región espacial: xFrom/xTo en fracción del largo; zSide: "outer" | "inner"
      const r = region;
      const sub = splitGeometry(g, ([x, , z]) => {
        const inX = (r.xFrom === undefined || x >= xAt(r.xFrom)) && (r.xTo === undefined || x < xAt(r.xTo));
        const inZ = r.zSide === undefined || (r.zSide === "outer" ? z >= 0 : z < 0);
        return inX && inZ ? "in" : "out";
      });
      if (sub.in) parts.push(sub.in); else warn(`Zona ${zoneId}: la región no contiene triángulos de ${srcName}`);
    } else parts.push(g);
  }
  if (parts.length) zoneGeos.set(zoneId, mergeGeometries(parts));
}
for (const [mesh, set] of usedComponents) {
  const total = componentsFor(mesh).length;
  const unused = Array.from({ length: total }, (_, i) => i).filter((i) => !set.has(i));
  if (unused.length) warn(`${mesh}: componentes sin zona ni descarte: ${unused.join(", ")}`);
}

// Detección de zapato derecho/izquierdo por asimetría de la planta (el arco está en el lado interior).
{
  const soleZone = recipe.soleZoneForSideDetection;
  const g = soleZone && zoneGeos.get(soleZone);
  if (g) {
    const xa = xAt(0.42), xb = xAt(0.58);
    let zp = 0, zn = 0, np = 0, nn = 0;
    for (let i = 0; i < g.positions.length; i += 3) {
      const x = g.positions[i], z = g.positions[i + 2];
      if (x < xa || x > xb) continue;
      if (z > 0) { zp = Math.max(zp, z); np++; } else { zn = Math.min(zn, z); nn++; }
    }
    note(`Planta a media longitud: +Z ${zp.toFixed(3)} / −Z ${(-zn).toFixed(3)} → ${zp > -zn ? "+Z es exterior (derecho)" : "−Z es exterior (parece zapato izquierdo)"}`);
    if (zp < -zn && !mirrorInput) warn("La planta sugiere que el asset es un zapato IZQUIERDO; añade \"inputIsLeftShoe\": true en la receta si se confirma visualmente");
  }
}

// 4) UVs y proporción (derecho) + espejo (izquierdo)
const doc = new Document();
doc.createBuffer();
const sceneOut = doc.createScene("Scene");
const matCache = new Map();
function materialFor(zoneId) {
  if (matCache.has(zoneId)) return matCache.get(zoneId);
  const srcMat = zoneMaterialSrc.get(zoneId);
  const m = doc.createMaterial(`${zoneId}_mat`).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.6).setMetallicFactor(0);
  if (srcMat?.getNormalTexture()) {
    const st = srcMat.getNormalTexture();
    const tex = doc.createTexture(st.getName() || `${zoneId}_normal`).setImage(st.getImage()).setMimeType(st.getMimeType());
    m.setNormalTexture(tex).setNormalScale(srcMat.getNormalScale());
    note(`${zoneId}: conserva normal map del asset`);
  }
  matCache.set(zoneId, m);
  return m;
}

const manifestZones = [];
const roots = { right: doc.createNode("Right"), left: doc.createNode("Left") };
sceneOut.addChild(roots.right).addChild(roots.left);

for (const [zoneId, rule] of Object.entries(recipe.zones)) {
  const right = zoneGeos.get(zoneId);
  if (!right) continue;
  const left = {
    positions: Float32Array.from(right.positions), normals: right.normals ? Float32Array.from(right.normals) : null,
    uvs: right.uvs ? Float32Array.from(right.uvs) : null, indices: Uint32Array.from(right.indices),
  };
  transformGeometry(left, { mirrorZ: true });
  let aspect = null;
  if (rule.images) {
    const r = buildPrintUVs(right, zoneId, rule, +1, xAt);
    const l = buildPrintUVs(left, zoneId, rule, -1, xAt);
    aspect = r?.aspect ?? 1;
    note(`${zoneId}: UV ${r?.mode}${r?.arcDeg ? ` (${r.arcDeg}°)` : ""}, proporción ${aspect.toFixed(2)}`);
    report.zones[zoneId] = { tris: right.indices.length / 3, uv: r, left: l };
  } else report.zones[zoneId] = { tris: right.indices.length / 3 };

  const suffix = rule.meshSuffix;
  const mat = materialFor(zoneId);
  const mr = writePrim(doc, right, mat, `R_${suffix}`);
  const ml = writePrim(doc, left, mat, `L_${suffix}`);
  roots.right.addChild(doc.createNode(`R_${suffix}`).setMesh(mr));
  roots.left.addChild(doc.createNode(`L_${suffix}`).setMesh(ml));

  const z = {
    id: zoneId, label: rule.label,
    meshNames: { right: `R_${suffix}`, left: `L_${suffix}` },
    customizable: rule.customizable ?? true,
    allowImages: !!rule.images, allowText: !!rule.images,
    allowColors: rule.colors ?? (rule.customizable ?? true),
    allowMaterials: !!rule.materialOptions,
    defaultColor: rule.defaultColor ?? "#f2f1ee",
    material: rule.material ?? "leather",
  };
  if (rule.materialOptions) z.materialOptions = rule.materialOptions;
  if (rule.images) {
    const w = 2048;
    const h = Math.max(256, Math.min(2048, Math.round((w / aspect) / 8) * 8));
    z.texture = { width: w, height: h };
    if (rule.stitchInset !== undefined) z.stitchInset = rule.stitchInset;
  }
  if (rule.lining) z.lining = true;
  if (rule.detailRepeat) z.detailRepeat = rule.detailRepeat;
  manifestZones.push(z);
}

// 5) Optimización
const simplifyTargets = recipe.simplify ?? {};
for (const mesh of doc.getRoot().listMeshes()) {
  const zoneId = Object.entries(recipe.zones).find(([, r]) => mesh.getName().endsWith(`_${r.meshSuffix}`))?.[0];
  const ratio = zoneId && simplifyTargets[zoneId];
  if (ratio) {
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.001, filter: (p) => mesh.listPrimitives().includes(p) }));
  }
}
await doc.transform(weld(), dedup(), prune({ keepAttributes: true }), quantize({ quantizePosition: 14, quantizeTexcoord: 12, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));

let totalTris = 0;
for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) totalTris += p.getIndices().getCount() / 3;
note(`Triángulos totales (ambos zapatos): ${Math.round(totalTris)}`);

// 6) Salida
mkdirSync(dirname(resolve(args.output)), { recursive: true });
const glb = await io.writeBinary(doc);
writeFileSync(resolve(args.output), glb);
note(`GLB escrito: ${args.output} (${(glb.byteLength / 1024).toFixed(0)} KB)`);

if (args.manifest) {
  const modelId = basename(args.output).replace(/\.glb$/, "");
  const manifest = {
    modelId, name: recipe.name ?? modelId, version: 1, provisional: false,
    source: { type: "glb", url: `/models/${basename(args.output)}`, compression: ["meshopt"] },
    unitScale: 1,
    shoes: { right: { nodeName: "Right", label: "Derecho" }, left: { nodeName: "Left", label: "Izquierdo" } },
    layout: { bothShoesGap: 0.3, focusHeight: 0.42 },
    liningColor: recipe.liningColor ?? "#d9d6d0",
    credits: recipe.credits,
    zones: manifestZones,
  };
  mkdirSync(dirname(resolve(args.manifest)), { recursive: true });
  writeFileSync(resolve(args.manifest), JSON.stringify(manifest, null, 2) + "\n");
  note(`Manifiesto escrito: ${args.manifest}`);
}
if (args.report) writeFileSync(resolve(args.report), JSON.stringify(report, null, 2));
if (report.errors.length) process.exit(1);

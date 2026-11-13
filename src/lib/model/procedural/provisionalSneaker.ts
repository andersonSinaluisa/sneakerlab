/**
 * MODELO PROVISIONAL — "Classic Low (provisional)"
 *
 * Generador procedural de una zapatilla baja genérica, sin marcas.
 * Existe solo para que el MVP funcione sin un modelo profesional.
 * Se ejecuta en Node (scripts/generate-provisional-model.ts) y se exporta a
 * /public/models/sneaker-low-01.glb. La app carga ese GLB exactamente igual
 * que cargaría un modelo profesional: reemplazar el archivo + su JSON de
 * metadatos es suficiente.
 *
 * Convenciones:
 *  - Unidad ≈ 10 cm. Largo 2.8, ancho ~1.0. Punta hacia +X, arriba +Y.
 *  - Zapato derecho: lateral exterior hacia +Z. El izquierdo es su espejo.
 *  - UVs en convención glTF (v = 0 arriba de la imagen). Cada panel
 *    personalizable ocupa su propio espacio UV 0..1 completo, orientado para
 *    que una imagen se lea sin espejo vista desde fuera del zapato.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Side = "right" | "left";

const L = 2.8; // largo
const HALF_L = L / 2;
const W = 1.02; // ancho máximo
const OUTSOLE_H = 0.09;
const MIDSOLE_H = 0.21;
export const UPPER_BASE_Y = OUTSOLE_H + MIDSOLE_H;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const sgnPow = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p);

/** Interpolación suave entre puntos de control (xs ascendentes). */
function curve(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  for (let i = 0; i < xs.length - 1; i++) {
    if (x <= xs[i + 1]) {
      const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
      const s = (1 - Math.cos(Math.PI * t)) / 2;
      return ys[i] + (ys[i + 1] - ys[i]) * s;
    }
  }
  return ys[ys.length - 1];
}

/** Media anchura de la planta según posición normalizada (1 = punta). */
const halfWidth = (xn: number) => (W / 2) * (0.76 + 0.24 * smoothstep(-0.95, 0.35, xn));

/** Punto del contorno de la planta. phi = 0 punta, phi>0 lado +Z (exterior derecho). */
function outline(phi: number, scale = 1): { x: number; z: number; xn: number } {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const x = HALF_L * sgnPow(c, 0.85);
  const xn = x / HALF_L;
  const z = halfWidth(xn) * sgnPow(s, 0.75);
  return { x: x * scale, z: z * scale, xn };
}

/** Altura de la parte superior del upper sobre la entresuela. */
const topHeight = (xn: number) =>
  curve([-1, -0.78, -0.42, 0.22, 0.5, 1], [0.9, 0.78, 0.68, 0.58, 0.47, 0.25], xn);

/** Cierre: fracción de la media anchura en el borde superior. */
const closure = (xn: number) =>
  curve([-1, -0.62, -0.42, 0.22, 0.48, 1], [0.7, 0.7, 0.42, 0.42, 0, 0], xn);

/** Punto de la superficie del upper. v: 0 abajo, 1 borde superior. */
function upperPoint(phi: number, v: number, zSign: number): THREE.Vector3 {
  const b = outline(phi);
  const xn = b.xn;
  const toePull = smoothstep(0.35, 1, xn) * 0.36;
  const heelLean = smoothstep(-0.6, -1, xn) * 0.07;
  const tx = b.x - toePull + heelLean;
  const tz = b.z * closure(xn);
  const ty = UPPER_BASE_Y + topHeight(xn);

  // normal horizontal del contorno (hacia fuera)
  const e = 1e-3;
  const b2 = outline(phi + e);
  let nx = b2.z - b.z;
  let nz = -(b2.x - b.x);
  if (nx * b.x + nz * b.z < 0) {
    nx = -nx;
    nz = -nz;
  }
  const nl = Math.hypot(nx, nz) || 1;
  nx /= nl;
  nz /= nl;

  const bulge = Math.sin(Math.PI * Math.min(1, v * 1.05)) * 0.075;
  const vv = v;
  const x = b.x + (tx - b.x) * vv + nx * bulge;
  const z = b.z + (tz - b.z) * vv + nz * bulge;
  const y = UPPER_BASE_Y + (ty - UPPER_BASE_Y) * vv;
  return new THREE.Vector3(x, y, z * zSign);
}

/**
 * Construye un panel paramétrico (u,v) con UVs 0..1. Se garantiza que
 * dP/du × dP/dv apunte hacia "fuera": así la cara frontal mira al exterior
 * y las imágenes no aparecen espejadas.
 */
function buildPanel(
  fn: (a: number, v: number) => THREE.Vector3,
  segU: number,
  segV: number,
  outward: (p: THREE.Vector3) => THREE.Vector3,
): THREE.BufferGeometry {
  // ¿Hay que invertir u para que la orientación sea correcta?
  const p0 = fn(0.5, 0.5);
  const du = fn(0.51, 0.5).sub(fn(0.49, 0.5));
  // v crece hacia arriba en el espacio del panel; en UV glTF v=0 es arriba.
  const dvUp = fn(0.5, 0.51).sub(fn(0.5, 0.49));
  const cross = new THREE.Vector3().crossVectors(du, dvUp);
  const flipU = cross.dot(outward(p0)) < 0;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    for (let i = 0; i <= segU; i++) {
      const uParam = i / segU;
      const a = flipU ? 1 - uParam : uParam;
      const p = fn(a, v);
      positions.push(p.x, p.y, p.z);
      uvs.push(uParam, 1 - v); // glTF: v=0 arriba
    }
  }
  const row = segU + 1;
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      // u→derecha, v(arriba)→arriba: CCW visto desde fuera
      indices.push(a, b, d, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Espeja en Z corrigiendo el orden de vértices (para piezas sin imágenes). */
function mirrorZ(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = (src.index ? src.toNonIndexed() : src.clone()) as THREE.BufferGeometry;
  geo.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1));
  for (const name of Object.keys(geo.attributes)) {
    const attr = geo.attributes[name] as THREE.BufferAttribute;
    const n = attr.itemSize;
    const arr = attr.array as Float32Array;
    for (let t = 0; t < attr.count; t += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (t + 1) * n + k;
        const i2 = (t + 2) * n + k;
        const tmp = arr[i1];
        arr[i1] = arr[i2];
        arr[i2] = tmp;
      }
    }
  }
  geo.computeVertexNormals();
  return geo;
}

const horizontalOutward = (p: THREE.Vector3) => new THREE.Vector3(p.x, 0, p.z).normalize();

// Ángulos de corte de zonas
const PHI_TOE = Math.acos(0.5);
const PHI_HEEL = Math.acos(-0.7);

function soleShape(scale: number): THREE.Shape {
  const shape = new THREE.Shape();
  const N = 96;
  for (let i = 0; i <= N; i++) {
    const phi = (i / N) * Math.PI * 2;
    const p = outline(phi, scale);
    // ExtrudeGeometry trabaja en XY; luego se rota -90° en X (y → -z)
    if (i === 0) shape.moveTo(p.x, -p.z);
    else shape.lineTo(p.x, -p.z);
  }
  return shape;
}

function extrudeSole(scale: number, depth: number, y: number, bevel: number) {
  const geo = new THREE.ExtrudeGeometry(soleShape(scale), {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    curveSegments: 4,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y + bevel, 0);
  geo.deleteAttribute("uv");
  // UV plano simple (vista superior) para materiales futuros
  const pos = geo.attributes.position;
  const uv: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    uv.push(pos.getX(i) / L + 0.5, pos.getZ(i) / W + 0.5);
  }
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

function buildTongue(zSign: number) {
  const x0n = 0.52;
  const x1n = -0.5;
  return buildPanel(
    (a, v) => {
      // a: 0 → hacia la punta, 1 → hacia el tobillo ; v: 0 → lado -Z, 1 → lado +Z
      const xn = x0n + (x1n - x0n) * a;
      const x = xn * HALF_L - smoothstep(0.35, 1, xn) * 0.36;
      const hw = halfWidth(xn) * closure(xn) + 0.09;
      const zz = (v * 2 - 1) * hw;
      const rise = smoothstep(0.1, 1, a) * 0.16; // la lengüeta sobresale arriba
      const arch = 0.05 * (1 - (zz / hw) ** 2);
      const y = UPPER_BASE_Y + topHeight(xn) - 0.045 + arch + rise;
      return new THREE.Vector3(x, y, zz * zSign);
    },
    32,
    12,
    () => new THREE.Vector3(0.25, 1, 0).normalize(),
  );
}

function buildLaces(zSign: number) {
  const parts: THREE.BufferGeometry[] = [];
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    const xn = 0.3 - (r / (rows - 1)) * 0.66;
    const x = xn * HALF_L;
    const hw = halfWidth(xn) * closure(xn) + 0.015;
    const y = UPPER_BASE_Y + topHeight(xn) + 0.035;
    const pts = [
      new THREE.Vector3(x + 0.03, y - 0.02, -hw * zSign),
      new THREE.Vector3(x, y + 0.04, 0),
      new THREE.Vector3(x - 0.03, y - 0.02, hw * zSign),
    ];
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.022, 8, false);
    parts.push(tube);
    // cruce diagonal (detalle visual)
    if (r < rows - 1) {
      const xn2 = 0.3 - ((r + 1) / (rows - 1)) * 0.66;
      const x2 = xn2 * HALF_L;
      const hw2 = halfWidth(xn2) * closure(xn2) + 0.015;
      const y2 = UPPER_BASE_Y + topHeight(xn2) + 0.035;
      const diag = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, y - 0.02, hw * 0.98 * zSign),
          new THREE.Vector3((x + x2) / 2, (y + y2) / 2 + 0.03, 0),
          new THREE.Vector3(x2, y2 - 0.02, -hw2 * 0.98 * zSign),
        ]),
        16,
        0.018,
        6,
        false,
      );
      parts.push(diag);
    }
  }
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  merged.computeVertexNormals();
  return merged;
}

/** Ojales metálicos: anillos en cada punto de salida de los cordones. */
function buildEyelets(zSign: number) {
  const parts: THREE.BufferGeometry[] = [];
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    const xn = 0.3 - (r / (rows - 1)) * 0.66;
    const x = xn * HALF_L;
    const hw = halfWidth(xn) * closure(xn) + 0.012;
    const y = UPPER_BASE_Y + topHeight(xn) + 0.01;
    for (const side of [-1, 1]) {
      const ring = new THREE.TorusGeometry(0.034, 0.011, 8, 20);
      // orientar el anillo según la pendiente local del upper
      const n = new THREE.Vector3(0.25, 0.75, side * zSign * 0.6).normalize();
      ring.lookAt(n);
      ring.translate(x, y, side * hw * zSign);
      parts.push(ring.toNonIndexed());
    }
  }
  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  return merged;
}

function buildCollar(zSign: number) {
  const start = Math.acos(-0.42);
  const pts: THREE.Vector3[] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const phi = start + (i / N) * (2 * Math.PI - 2 * start);
    const p = upperPoint(phi, 1, zSign);
    p.y += 0.01;
    pts.push(p);
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.04, 10, false);
}

function buildInsole(zSign: number) {
  const geo = new THREE.ShapeGeometry(soleShape(0.94), 4);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, UPPER_BASE_Y + 0.012, 0);
  return zSign < 0 ? mirrorZ(geo) : geo;
}

export interface GeneratedMesh {
  name: string;
  geometry: THREE.BufferGeometry;
  color: [number, number, number];
}

export interface GeneratedShoe {
  nodeName: string;
  meshes: GeneratedMesh[];
}

/** Genera las piezas de un zapato. Los nombres coinciden con el JSON de metadatos. */
export function buildProvisionalShoe(side: Side): GeneratedShoe {
  const zSign = side === "right" ? 1 : -1;
  const P = side === "right" ? "R_" : "L_";

  const panel = (from: number, to: number, seg = 48) =>
    buildPanel((a, v) => upperPoint(from + (to - from) * a, v, zSign), seg, 24, horizontalOutward);

  // Exterior: phi>0 en el derecho (lado +Z). En el izquierdo, el espejo deja el exterior en -Z
  // con los mismos ángulos, porque zSign invierte Z.
  const outer = panel(PHI_TOE, PHI_HEEL);
  const inner = panel(-PHI_HEEL, -PHI_TOE);
  const toe = panel(-PHI_TOE, PHI_TOE, 40);
  const heel = panel(PHI_HEEL, 2 * Math.PI - PHI_HEEL, 32);

  const mid = extrudeSole(1.045, MIDSOLE_H, OUTSOLE_H, 0.035);
  const out = extrudeSole(1.06, OUTSOLE_H, 0, 0.02);

  const maybeMirror = (g: THREE.BufferGeometry) => (zSign < 0 ? mirrorZ(g) : g);

  return {
    nodeName: side === "right" ? "Right" : "Left",
    meshes: [
      { name: `${P}OuterPanel`, geometry: outer, color: [0.93, 0.93, 0.92] },
      { name: `${P}InnerPanel`, geometry: inner, color: [0.93, 0.93, 0.92] },
      { name: `${P}ToeCap`, geometry: toe, color: [0.9, 0.9, 0.89] },
      { name: `${P}HeelCounter`, geometry: heel, color: [0.9, 0.9, 0.89] },
      { name: `${P}Tongue`, geometry: buildTongue(zSign), color: [0.95, 0.95, 0.95] },
      { name: `${P}Laces`, geometry: buildLaces(zSign), color: [0.98, 0.98, 0.98] },
      { name: `${P}Eyelets`, geometry: buildEyelets(zSign), color: [0.6, 0.6, 0.6] },
      { name: `${P}Midsole`, geometry: maybeMirror(mid), color: [0.97, 0.97, 0.96] },
      { name: `${P}Outsole`, geometry: maybeMirror(out), color: [0.2, 0.2, 0.22] },
      { name: `${P}Collar`, geometry: buildCollar(zSign), color: [0.85, 0.85, 0.85] },
      { name: `${P}Insole`, geometry: buildInsole(zSign), color: [0.8, 0.8, 0.8] },
    ],
  };
}

/** Relación de aspecto física aproximada de un panel (ancho/alto) para dimensionar texturas. */
export function measurePanelAspect(geo: THREE.BufferGeometry): number {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  // filas: v constante. Medimos la fila central y la columna central.
  let uLen = 0;
  let vLen = 0;
  const pts: { u: number; v: number; p: THREE.Vector3 }[] = [];
  for (let i = 0; i < pos.count; i++) {
    pts.push({ u: uv.getX(i), v: uv.getY(i), p: new THREE.Vector3().fromBufferAttribute(pos, i) });
  }
  const rowV = pts.filter((q) => Math.abs(q.v - 0.5) < 0.03).sort((a, b) => a.u - b.u);
  const colU = pts.filter((q) => Math.abs(q.u - 0.5) < 0.02).sort((a, b) => a.v - b.v);
  for (let i = 1; i < rowV.length; i++) uLen += rowV[i].p.distanceTo(rowV[i - 1].p);
  for (let i = 1; i < colU.length; i++) vLen += colU[i].p.distanceTo(colU[i - 1].p);
  return vLen > 0 ? uLen / vLen : 1;
}

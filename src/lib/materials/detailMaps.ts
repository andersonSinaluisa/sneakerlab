/**
 * Mapas de detalle procedurales y tileables (normal + roughness) por patrón de material.
 * Se generan una vez por sesión en un canvas pequeño y se comparten entre zonas (caché).
 * Cuando el modelo profesional traiga sus propios mapas en el GLB, estos solo se usan como fallback.
 */
import * as THREE from "three";
import type { DetailPattern } from "./presets";

const SIZE = 256;

/** Ruido de valor periódico (tileable) en [0,1]. */
function tileableNoise(size: number, cells: number, seed: number): Float32Array {
  const grid = new Float32Array(cells * cells);
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const out = new Float32Array(size * size);
  const fade = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const gy = (y / size) * cells;
    const y0 = Math.floor(gy);
    const ty = fade(gy - y0);
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * cells;
      const x0 = Math.floor(gx);
      const tx = fade(gx - x0);
      const g = (ix: number, iy: number) => grid[((iy % cells) + cells) % cells * cells + (((ix % cells) + cells) % cells)];
      const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1);
      out[y * size + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
  }
  return out;
}

function fbm(size: number, octaves: number, baseCells: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0, cells = baseCells;
  for (let o = 0; o < octaves; o++) {
    const n = tileableNoise(size, cells, seed + o * 97);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp;
    amp *= 0.5;
    cells *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Mapa de altura por patrón, valores en [0,1], tileable. */
function heightField(pattern: DetailPattern, size: number): Float32Array {
  const h = new Float32Array(size * size);
  const at = (x: number, y: number) => ((y + size) % size) * size + ((x + size) % size);
  switch (pattern) {
    case "leatherGrain": {
      const a = fbm(size, 4, 6, 11);
      const b = fbm(size, 3, 24, 31);
      for (let i = 0; i < h.length; i++) h[i] = 0.5 + (a[i] - 0.5) * 0.9 + (b[i] - 0.5) * 0.5;
      break;
    }
    case "suedeNap": {
      const a = fbm(size, 5, 16, 7);
      for (let i = 0; i < h.length; i++) h[i] = a[i];
      break;
    }
    case "weave": {
      const n = fbm(size, 2, 32, 3);
      const period = size / 16;
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const u = (x % period) / period, v = (y % period) / period;
          const cell = (Math.floor(x / period) + Math.floor(y / period)) % 2;
          const warp = Math.sin(u * Math.PI); // hilo horizontal
          const weft = Math.sin(v * Math.PI); // hilo vertical
          const val = cell ? warp * 0.8 + weft * 0.2 : weft * 0.8 + warp * 0.2;
          h[at(x, y)] = 0.25 + val * 0.6 + (n[at(x, y)] - 0.5) * 0.15;
        }
      break;
    }
    case "knitMesh": {
      const period = size / 12;
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const u = (x % period) / period - 0.5, v = (y % period) / period - 0.5;
          const r = Math.hypot(u, v);
          h[at(x, y)] = THREE.MathUtils.clamp(1 - Math.pow(r / 0.5, 1.5), 0, 1) * 0.9 + 0.05;
        }
      break;
    }
    case "rubberSpeckle": {
      const a = fbm(size, 3, 8, 23);
      const b = tileableNoise(size, 64, 5);
      for (let i = 0; i < h.length; i++) h[i] = 0.5 + (a[i] - 0.5) * 0.4 + (b[i] > 0.82 ? -0.35 : 0);
      break;
    }
    case "foamCells": {
      const a = fbm(size, 3, 12, 41);
      const b = tileableNoise(size, 40, 9);
      for (let i = 0; i < h.length; i++) h[i] = 0.5 + (a[i] - 0.5) * 0.5 + (b[i] > 0.9 ? -0.3 : 0);
      break;
    }
    default:
      h.fill(0.5);
  }
  return h;
}

function heightToNormal(h: Float32Array, size: number, strength: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  return data;
}

export interface DetailMaps {
  normal: THREE.DataTexture;
  /** Variación de rugosidad en canal G (convención glTF: R=AO, G=roughness, B=metalness). */
  roughness: THREE.DataTexture;
}

const cache = new Map<DetailPattern, DetailMaps>();

export function getDetailMaps(pattern: DetailPattern): DetailMaps | null {
  if (pattern === "none") return null;
  const hit = cache.get(pattern);
  if (hit) return hit;

  const h = heightField(pattern, SIZE);
  const normal = new THREE.DataTexture(heightToNormal(h, SIZE, 6), SIZE, SIZE, THREE.RGBAFormat);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.colorSpace = THREE.NoColorSpace;
  normal.generateMipmaps = true;
  normal.minFilter = THREE.LinearMipmapLinearFilter;
  normal.needsUpdate = true;

  const rough = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < h.length; i++) {
    // ligera variación ±10% alrededor del valor del material
    const v = 128 + (h[i] - 0.5) * 50;
    rough[i * 4] = 255;
    rough[i * 4 + 1] = v;
    rough[i * 4 + 2] = 0;
    rough[i * 4 + 3] = 255;
  }
  const roughness = new THREE.DataTexture(rough, SIZE, SIZE, THREE.RGBAFormat);
  roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
  roughness.generateMipmaps = true;
  roughness.minFilter = THREE.LinearMipmapLinearFilter;
  roughness.needsUpdate = true;

  const maps = { normal, roughness };
  cache.set(pattern, maps);
  return maps;
}

export function disposeDetailMaps() {
  for (const m of cache.values()) {
    m.normal.dispose();
    m.roughness.dispose();
  }
  cache.clear();
}

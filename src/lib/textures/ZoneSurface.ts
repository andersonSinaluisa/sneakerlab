/**
 * Superficie de una zona: material físico PBR + lienzo/CanvasTexture opcional + mapas de detalle.
 * Encapsula toda la mutación imperativa de Three.js fuera de los componentes React.
 *
 * Prioridad de mapas: si el GLB profesional trae normal/roughness en el material original del
 * mesh, se reutilizan (y se respeta su `normalScale`); si no, se usan los mapas procedurales del
 * preset. El color/impresión del usuario siempre va en `map` (CanvasTexture) o en `color`.
 */
import * as THREE from "three";
import type { MaterialPresetId, ShoeSide, ZoneConfig } from "@/lib/model/schema";
import type { Layer } from "@/lib/editor/types";
import { getMaterialPreset, type MaterialPreset } from "@/lib/materials/presets";
import { getDetailMaps } from "@/lib/materials/detailMaps";
import { composeZone, type ComposeInput } from "./compositor";

const HIGHLIGHT = new THREE.Color("#ffffff");

export interface SurfaceOptions {
  textured: boolean;
  maxAnisotropy: number;
  /** Nivel de calidad: en "low" se omiten clearcoat/sheen y los mapas de detalle. */
  quality: "low" | "medium" | "high";
}

interface InheritedMaps {
  normalMap?: THREE.Texture;
  normalScale?: THREE.Vector2;
  roughnessMap?: THREE.Texture;
  aoMap?: THREE.Texture;
}

export class ZoneSurface {
  readonly material: THREE.MeshPhysicalMaterial;
  readonly canvas: HTMLCanvasElement | null = null;
  readonly texture: THREE.CanvasTexture | null = null;
  private lining: THREE.Mesh | null = null;
  private attached: { mesh: THREE.Mesh; previous: THREE.Material | THREE.Material[] } | null = null;
  private inherited: InheritedMaps = {};
  private presetId: MaterialPresetId;
  private lastColor = "#ffffff";

  constructor(
    readonly zone: ZoneConfig,
    readonly shoe: ShoeSide,
    private readonly opts: SurfaceOptions,
  ) {
    this.presetId = zone.material;
    this.material = new THREE.MeshPhysicalMaterial({
      metalness: 0,
      side: zone.lining ? THREE.FrontSide : THREE.DoubleSide,
    });
    if (opts.textured && zone.texture) {
      const cv = document.createElement("canvas");
      cv.width = zone.texture.width;
      cv.height = zone.texture.height;
      const tex = new THREE.CanvasTexture(cv);
      tex.flipY = false; // UV en convención glTF
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(opts.quality === "low" ? 2 : 8, opts.maxAnisotropy);
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      this.material.map = tex;
      this.canvas = cv;
      this.texture = tex;
    }
    this.applyPreset(getMaterialPreset(this.presetId));
  }

  get textured() {
    return this.texture !== null;
  }

  attach(mesh: THREE.Mesh, liningColor: string) {
    this.detach();
    this.attached = { mesh, previous: mesh.material };

    // Hereda mapas de detalle del material original del GLB (modelo profesional).
    const prev = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (prev && (prev as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      const p = prev as THREE.MeshStandardMaterial;
      this.inherited = {
        normalMap: p.normalMap ?? undefined,
        normalScale: p.normalMap ? p.normalScale.clone() : undefined,
        roughnessMap: p.roughnessMap ?? undefined,
        aoMap: p.aoMap ?? undefined,
      };
      if (!this.textured && p.map) {
        // Conserva el albedo original (p. ej. relieve pintado de la suela) y lo tiñe con el color.
        this.material.map = p.map;
      }
    }
    this.applyPreset(getMaterialPreset(this.presetId));

    mesh.material = this.material;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (this.zone.customizable) {
      Object.assign(mesh.userData, {
        zoneId: this.zone.id,
        shoe: this.shoe,
        allowImages: this.textured && this.zone.allowImages,
        texture: this.zone.texture,
        uvIsland: this.zone.uvIsland,
      });
    }
    if (this.zone.lining) {
      const lining = new THREE.Mesh(
        mesh.geometry,
        new THREE.MeshStandardMaterial({ color: liningColor, roughness: 0.95, side: THREE.BackSide }),
      );
      lining.raycast = () => {};
      lining.name = `${mesh.name}__lining`;
      mesh.add(lining);
      this.lining = lining;
    }
  }

  detach() {
    if (!this.attached) return;
    const { mesh, previous } = this.attached;
    mesh.material = previous;
    if (this.lining) {
      mesh.remove(this.lining);
      (this.lining.material as THREE.Material).dispose();
      this.lining = null;
    }
    this.attached = null;
  }

  setPreset(id: MaterialPresetId) {
    if (id === this.presetId) return;
    this.presetId = id;
    this.applyPreset(getMaterialPreset(id));
  }

  private applyPreset(preset: MaterialPreset) {
    const m = this.material;
    const low = this.opts.quality === "low";
    m.roughness = this.zone.roughness ?? preset.roughness;
    m.metalness = preset.metalness;
    m.sheen = low ? 0 : (preset.sheen ?? 0);
    m.sheenRoughness = preset.sheenRoughness ?? 1;
    m.sheenColor.set("#ffffff");
    m.clearcoat = low ? 0 : (preset.clearcoat ?? 0);
    m.clearcoatRoughness = preset.clearcoatRoughness ?? 0.5;
    m.specularIntensity = preset.specularIntensity ?? 1;
    m.envMapIntensity = 1;

    const repeat = this.zone.detailRepeat ?? preset.detailRepeat;
    if (this.inherited.normalMap) {
      m.normalMap = this.inherited.normalMap;
      m.normalScale.copy(this.inherited.normalScale ?? new THREE.Vector2(1, 1));
      m.roughnessMap = this.inherited.roughnessMap ?? null;
    } else if (!low && preset.normalScale > 0) {
      const maps = getDetailMaps(preset.detail);
      if (maps) {
        // Clonamos para poder fijar un `repeat` distinto por zona sin tocar la caché compartida.
        const n = maps.normal.clone();
        n.repeat.set(repeat, repeat * (this.aspect()));
        n.needsUpdate = true;
        const r = maps.roughness.clone();
        r.repeat.copy(n.repeat);
        r.needsUpdate = true;
        this.disposeOwnedDetail();
        m.normalMap = n;
        m.roughnessMap = r;
        m.normalScale.set(preset.normalScale, preset.normalScale);
        this.ownedDetail = [n, r];
      }
    } else {
      this.disposeOwnedDetail();
      m.normalMap = null;
      m.roughnessMap = null;
    }
    m.aoMap = this.inherited.aoMap ?? null;
    m.needsUpdate = true;
    this.tint(this.lastColor, preset);
  }

  private ownedDetail: THREE.Texture[] = [];
  private disposeOwnedDetail() {
    for (const t of this.ownedDetail) t.dispose();
    this.ownedDetail = [];
  }

  /** Relación alto/ancho del lienzo para que el detalle no se estire. */
  private aspect() {
    const t = this.zone.texture;
    return t ? t.height / t.width : 1;
  }

  private tint(color: string, preset: MaterialPreset) {
    this.lastColor = color;
    if (this.texture) {
      // El color ya está pintado en el lienzo; el multiplicador modula absorción del material.
      const k = preset.albedoMultiplier ?? 1;
      this.material.color.setRGB(k, k, k);
    } else {
      this.material.color.set(color).multiplyScalar(preset.albedoMultiplier ?? 1);
    }
  }

  /** Redibuja la zona. Sin textura, solo aplica el color al material. */
  render(color: string, layers: Layer[], input: Omit<ComposeInput, "baseColor" | "layers">) {
    if (this.canvas && this.texture) {
      const ctx = this.canvas.getContext("2d");
      if (!ctx) return;
      composeZone(ctx, this.canvas, {
        ...input,
        baseColor: color,
        layers,
        uvIsland: this.zone.uvIsland,
        stitchInset: this.zone.stitchInset,
      });
      this.texture.needsUpdate = true;
    }
    this.tint(color, getMaterialPreset(this.presetId));
  }

  setHighlight(level: "none" | "hover" | "selected") {
    if (!this.zone.customizable) return;
    this.material.emissive.copy(HIGHLIGHT);
    this.material.emissiveIntensity = level === "selected" ? 0.07 : level === "hover" ? 0.04 : 0;
  }

  dispose() {
    this.detach();
    this.disposeOwnedDetail();
    this.material.dispose();
    this.texture?.dispose();
  }
}

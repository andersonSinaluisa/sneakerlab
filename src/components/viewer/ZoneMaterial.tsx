/**
 * Conecta el estado del editor con la ZoneSurface de un mesh.
 * Toda la lógica de Three.js vive en ZoneSurface / compositor.
 */
import { useEffect, useMemo } from "react";
import type * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useShallow } from "zustand/react/shallow";
import type { ShoeSide, ZoneConfig } from "@/lib/model/schema";
import { useEditor } from "@/lib/editor/store";
import { getReadyImage, useAssetRuntime } from "@/lib/assets/assetStore";
import { ZoneSurface } from "@/lib/textures/ZoneSurface";
import { resolveCanvasFont } from "@/components/editor/fonts";

interface Props {
  mesh: THREE.Mesh;
  zone: ZoneConfig;
  shoe: ShoeSide;
  liningColor: string;
}

export function ZoneMaterial({ mesh, zone, shoe, liningColor }: Props) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  const color = useEditor((s) => s.history.present.shoes[shoe].zones[zone.id]?.color ?? zone.defaultColor);
  const materialId = useEditor((s) => s.history.present.shoes[shoe].zones[zone.id]?.material ?? zone.material);
  const quality = useEditor((s) => s.resolvedQuality);
  const layers = useEditor(
    useShallow((s) => s.history.present.layers.filter((l) => l.shoe === shoe && l.zoneId === zone.id)),
  );
  const selectedLayerId = useEditor((s) => s.selectedLayerId);
  const highlight = useEditor((s) =>
    s.activeShoe !== shoe ? "none" : s.selectedZoneId === zone.id ? "selected" : s.hoveredZoneId === zone.id ? "hover" : "none",
  );
  // Cambia cuando termina de cargar cualquier imagen
  const assetsVersion = useAssetRuntime((s) => s.assets);

  const surface = useMemo(() => {
    const textured = Boolean(zone.texture && mesh.geometry.attributes.uv && (zone.allowImages || zone.allowText));
    return new ZoneSurface(zone, shoe, { textured, maxAnisotropy: gl.capabilities.getMaxAnisotropy(), quality });
  }, [zone, shoe, mesh, gl, quality]);

  useEffect(() => {
    surface.attach(mesh, liningColor);
    invalidate();
    return () => surface.detach();
  }, [surface, mesh, liningColor, invalidate]);

  useEffect(() => () => surface.dispose(), [surface]);

  useEffect(() => {
    surface.setPreset(materialId);
    invalidate();
  }, [surface, materialId, invalidate]);

  useEffect(() => {
    surface.render(color, layers, { getImage: getReadyImage, selectedLayerId, showSelection: true, resolveFont: resolveCanvasFont });
    invalidate();
  }, [surface, color, layers, selectedLayerId, assetsVersion, invalidate]);

  useEffect(() => {
    surface.setHighlight(highlight);
    invalidate();
  }, [surface, highlight, invalidate]);

  return null;
}

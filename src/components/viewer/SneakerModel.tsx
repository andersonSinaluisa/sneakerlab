import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { bindZones } from "@/lib/model/bindZones";
import type { ModelConfig, ShoeSide } from "@/lib/model/schema";
import { useModelGltf } from "@/lib/model/loader";
import { useEditor } from "@/lib/editor/store";
import { layersFor } from "@/lib/editor/document";
import { pickLayerAtUv } from "@/lib/textures/layerMath";
import { useAssetRuntime } from "@/lib/assets/assetStore";
import { ZoneMaterial } from "./ZoneMaterial";
import { dragState, sceneBridge, zoneData } from "./interaction";

const CLICK_TOLERANCE_PX = 5;

export function SneakerModel({ model }: { model: ModelConfig }) {
  const gltf = useModelGltf(model);
  // Clon propio: los materiales se reasignan por zona y no deben contaminar la caché de useGLTF.
  const bound = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const result = bindZones(scene, model);
    for (const side of ["right", "left"] as const) {
      const root = result.shoes[side].root;
      root.removeFromParent();
      root.position.set(0, 0, 0);
      root.updateMatrixWorld(true);
    }
    return result;
  }, [gltf.scene, model]);

  // Medidas del modelo para cámaras y separación de "ambos": se publican en el bridge.
  const frame = useMemo(() => {
    const box = new THREE.Box3().setFromObject(bound.shoes.right.root);
    const size = box.getSize(new THREE.Vector3());
    return { box, size };
  }, [bound]);

  useEffect(() => {
    sceneBridge.modelBox = frame.box;
    sceneBridge.modelVersion++;
    useEditor.getState().resetCamera();
    return () => {
      sceneBridge.modelBox = null;
    };
  }, [frame]);

  useEffect(() => {
    if (bound.warnings.length) console.warn("[Hecho a Pie] Modelo:", bound.warnings);
  }, [bound.warnings]);

  const cameraView = useEditor((s) => s.cameraView);
  const activeShoe = useEditor((s) => s.activeShoe);
  const both = cameraView === "both";
  const offset = (frame.size.z * (1 + model.layout.bothShoesGap)) / 2;

  return (
    <group>
      {(["right", "left"] as const).map((side) => (
        <ShoeGroup
          key={side}
          side={side}
          root={bound.shoes[side].root}
          visible={both || activeShoe === side}
          position={[0, 0, both ? (side === "right" ? offset : -offset) : 0]}
        >
          {bound.shoes[side].zones.map(({ zone, mesh }) => (
            <ZoneMaterial key={zone.id} mesh={mesh} zone={zone} shoe={side} liningColor={model.liningColor} />
          ))}
        </ShoeGroup>
      ))}
    </group>
  );
}

interface ShoeGroupProps {
  side: ShoeSide;
  root: THREE.Object3D;
  visible: boolean;
  position: [number, number, number];
  children: React.ReactNode;
}

function ShoeGroup({ side, root, visible, position, children }: ShoeGroupProps) {
  const setHovered = useEditor((s) => s.setHoveredZone);

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const data = zoneData(e.object);
    if (!data) return;
    e.stopPropagation();
    const s = useEditor.getState();
    if (s.activeShoe === side && s.hoveredZoneId !== data.zoneId) setHovered(data.zoneId);
    document.body.style.cursor = "pointer";
  };

  const onPointerOut = () => {
    setHovered(null);
    document.body.style.cursor = "";
  };

  /** Si el puntero cae sobre una capa de la zona seleccionada, inicia el arrastre. */
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    const data = zoneData(e.object);
    if (!data || !e.uv || !data.texture || e.button !== 0) return;
    const s = useEditor.getState();
    const layers = layersFor(s.doc(), side, data.zoneId);
    const runtime = useAssetRuntime.getState().assets;
    const hit = pickLayerAtUv(layers, e.uv, data.texture, (id) => {
      const a = runtime[id];
      return a?.width && a.height ? { width: a.width, height: a.height } : undefined;
    });
    if (!hit) return;
    e.stopPropagation();
    s.selectLayer(hit.id);
    sceneBridge.controls?.cancel();
    s.setDraggingLayer(true);
    s.beginGesture();
    dragState.current = {
      layerId: hit.id,
      mesh: e.object as THREE.Mesh,
      offsetX: hit.x - e.uv.x,
      offsetY: hit.y - e.uv.y,
      moved: false,
    };
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_TOLERANCE_PX) return;
    const data = zoneData(e.object);
    if (!data) return;
    e.stopPropagation();
    // Un clic sobre una capa ya la seleccionó en pointerdown (dragState sigue activo este tick)
    if (dragState.current) return;
    useEditor.getState().selectZone(data.zoneId, side);
  };

  return (
    <group position={position} visible={visible}>
      <primitive
        object={root}
        onPointerMove={visible ? onPointerMove : undefined}
        onPointerOut={visible ? onPointerOut : undefined}
        onPointerDown={visible ? onPointerDown : undefined}
        onClick={visible ? onClick : undefined}
      />
      {children}
    </group>
  );
}

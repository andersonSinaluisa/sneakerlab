/**
 * Componentes auxiliares dentro del Canvas:
 *  - PickBridge: raycast desde coordenadas de pantalla (drag & drop, arrastre de capas).
 *  - LayerDragController: mueve la capa seleccionada siguiendo la superficie del mesh.
 *  - CameraRig: cámara orbital con vistas predefinidas.
 *  - CaptureBridge: exportación PNG de la vista actual.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import { useEditor } from "@/lib/editor/store";
import { computePose, measure as measureBox } from "@/lib/render/framing";
import type { ModelConfig } from "@/lib/model/schema";
import { clamp } from "@/lib/textures/layerMath";
import { dragState, isWorldVisible, sceneBridge, zoneData, type ZoneHit } from "./interaction";

export function PickBridge() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const raycaster = useRef(new THREE.Raycaster());

  useEffect(() => {
    sceneBridge.pick = (clientX, clientY, only) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.current.setFromCamera(ndc, camera);
      const hits = raycaster.current.intersectObject(only ?? scene, true);
      for (const h of hits) {
        const data = zoneData(h.object);
        if (!data || !h.uv || !isWorldVisible(h.object)) continue;
        if (only && h.object !== only) continue;
        const result: ZoneHit = {
          shoe: data.shoe,
          zoneId: data.zoneId,
          uv: { x: h.uv.x, y: h.uv.y },
          mesh: h.object as THREE.Mesh,
        };
        return result;
      }
      return null;
    };
    return () => {
      sceneBridge.pick = null;
    };
  }, [camera, gl, scene]);
  return null;
}

export function LayerDragController() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragState.current;
      if (!drag || !sceneBridge.pick) return;
      const hit = sceneBridge.pick(e.clientX, e.clientY, drag.mesh);
      if (!hit) return;
      drag.moved = true;
      useEditor.getState().updateLayer(drag.layerId, {
        x: clamp(hit.uv.x + drag.offsetX, -0.25, 1.25),
        y: clamp(hit.uv.y + drag.offsetY, -0.25, 1.25),
      });
    };
    const onUp = () => {
      if (!dragState.current) return;
      const s = useEditor.getState();
      s.endGesture();
      s.setDraggingLayer(false);
      // Se limpia en el siguiente tick para que onClick sepa que hubo arrastre
      setTimeout(() => {
        dragState.current = null;
      }, 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);
  return null;
}

const VFOV = 30;

/**
 * Cámara orbital con vistas predefinidas calculadas desde el bounding box del modelo
 * (publicado por SneakerModel en sceneBridge). No usa coordenadas fijas.
 */
export function CameraRig({ model }: { model: ModelConfig }) {
  const ref = useRef<CameraControls>(null);
  const view = useEditor((s) => s.cameraView);
  const nonce = useEditor((s) => s.cameraNonce);
  const shoe = useEditor((s) => s.activeShoe);
  const dragging = useEditor((s) => s.draggingLayer);
  const size = useThree((s) => s.size);
  const [limits, setLimits] = useState({ min: 0.5, max: 20 });

  useEffect(() => {
    sceneBridge.controls = ref.current;
    return () => {
      sceneBridge.controls = null;
    };
  }, []);

  useEffect(() => {
    const c = ref.current;
    const box = sceneBridge.modelBox;
    if (!c || !box) return;
    const frame = measureBox(box, shoe);
    const aspect = size.width / Math.max(1, size.height);
    let bothBox: THREE.Box3 | undefined;
    if (view === "both") {
      const offset = (frame.size.z * (1 + model.layout.bothShoesGap)) / 2;
      bothBox = box.clone();
      bothBox.min.z -= offset;
      bothBox.max.z += offset;
    }
    const pose = computePose(view, frame, { vfov: VFOV, aspect, focusHeight: model.layout.focusHeight, bothBox });
    const diag = frame.size.length();
    setLimits({ min: diag * 0.45, max: diag * 4 });
    void c.setLookAt(pose.position.x, pose.position.y, pose.position.z, pose.target.x, pose.target.y, pose.target.z, true);
  }, [view, nonce, shoe, size.width, size.height, model.layout]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      enabled={!dragging}
      minDistance={limits.min}
      maxDistance={limits.max}
      maxPolarAngle={Math.PI * 0.52}
      dollySpeed={0.6}
      smoothTime={0.4}
    />
  );
}

export function CaptureBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    sceneBridge.capture = async () => {
      // Oculta el contorno de selección antes de capturar
      const s = useEditor.getState();
      const prevLayer = s.selectedLayerId;
      const prevZone = s.selectedZoneId;
      useEditor.setState({ selectedLayerId: null, selectedZoneId: null, hoveredZoneId: null });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      gl.render(scene, camera);
      const url = gl.domElement.toDataURL("image/png");
      useEditor.setState({ selectedLayerId: prevLayer, selectedZoneId: prevZone });
      return url;
    };
    return () => {
      sceneBridge.capture = null;
    };
  }, [gl, scene, camera]);
  return null;
}

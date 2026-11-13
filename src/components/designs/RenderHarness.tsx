/**
 * Arnés de render: carga el modelo, aplica un preset y expone `window.__sneakerlabRender(view)`
 * que devuelve la captura PNG del Canvas. Lo controla tools/designs/render-thumbs.mjs.
 */
import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { useEditor, type CameraView } from "@/lib/editor/store";
import { getModel } from "@/lib/model/registry";
import { useDesignStudio } from "@/lib/designs/store";
import { documentFromPreset } from "@/lib/designs/apply";
import { ensureUrlAsset, assetRefFromDesignAsset } from "@/lib/designs/harness-utils";
import { SneakerModel } from "@/components/viewer/SneakerModel";
import { Studio } from "@/components/viewer/Studio";
import { CameraRig, CaptureBridge, PickBridge } from "@/components/viewer/SceneHelpers";
import { QUALITY } from "@/lib/render/quality";
import { sceneBridge } from "@/components/viewer/interaction";

declare global {
  interface Window {
    __sneakerlabRender?: (presetId: string, view: CameraView) => Promise<string>;
    __sneakerlabReady?: boolean;
  }
}

const VIEW_MAP: Record<string, CameraView> = { hero: "threeQuarter", outer: "outer", inner: "inner", back: "back", both: "both", top: "top", front: "front" };

export default function RenderHarness() {
  const model = useEditor((s) => getModel(s.history.present.modelId));
  const quality = QUALITY.medium;
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    useEditor.getState().setQuality("medium");
    useEditor.getState().setResolvedQuality("medium");
    useEditor.setState({ background: "studio", selectedZoneId: null, selectedLayerId: null });
    window.__sneakerlabRender = async (presetId, view) => {
      const studio = useDesignStudio.getState();
      await studio.hydrate();
      const preset = studio.byId(presetId);
      if (!preset) throw new Error(`Preset no encontrado: ${presetId}`);
      const target = getModel(preset.compatibleModels[0]);
      await Promise.all(preset.assets.map((a) => ensureUrlAsset(assetRefFromDesignAsset(a))));
      const doc = documentFromPreset(preset, target);
      useEditor.getState().loadDocument(doc);
      useEditor.setState({ selectedZoneId: null, selectedLayerId: null, activeShoe: "right" });
      useEditor.getState().setCameraView(VIEW_MAP[view] ?? view);
      // Espera a que la cámara llegue (smoothTime 0.4 s) y a que el modelo esté medido
      await new Promise((r) => setTimeout(r, 900));
      if (!sceneBridge.capture) throw new Error("Escena no lista");
      return sceneBridge.capture();
    };
    window.__sneakerlabReady = true;
  }, []);

  return (
    <div style={{ width: 1000, height: 750 }}>
      <Canvas shadows dpr={1} gl={{ preserveDrawingBuffer: true, antialias: false }} camera={{ fov: 30, position: [0.3, 1.4, 6], near: 0.02, far: 200 }} frameloop="always">
        <SneakerModel model={model} />
        <Studio model={model} quality={quality} background="studio" />
        <CameraRig model={model} />
        <PickBridge />
        <CaptureBridge />
      </Canvas>
    </div>
  );
}

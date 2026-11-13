import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { toast } from "sonner";
import { useEditor, useModel } from "@/lib/editor/store";
import { getZone } from "@/lib/model/registry";
import { importImageFile } from "@/lib/assets/assetStore";
import { AssetValidationError } from "@/lib/assets/validation";
import { SneakerModel } from "./SneakerModel";
import { useWebGLSupport } from "./WebGLGuard";
import { CameraRig, CaptureBridge, LayerDragController, PickBridge } from "./SceneHelpers";
import { Studio } from "./Studio";
import { QualityResolver } from "./QualityResolver";
import { QUALITY } from "@/lib/render/quality";
import { ASSET_DRAG_MIME, sceneBridge } from "./interaction";

export function Viewer() {
  const model = useModel();
  const background = useEditor((s) => s.background);
  const quality = QUALITY[useEditor((s) => s.resolvedQuality)];
  const [dragOver, setDragOver] = useState(false);
  const webgl = useWebGLSupport();

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const hit = sceneBridge.pick?.(e.clientX, e.clientY) ?? null;
    const zone = hit ? getZone(model, hit.zoneId) : undefined;
    if (!hit || !zone?.allowImages) {
      toast.error("Suelta la imagen sobre una zona del zapato que admita imágenes.");
      return;
    }
    const s = useEditor.getState();
    let assetId = e.dataTransfer.getData(ASSET_DRAG_MIME);
    if (!assetId) {
      const file = Array.from(e.dataTransfer.files)[0];
      if (!file) return;
      try {
        const asset = await importImageFile(file);
        s.registerAsset(asset);
        assetId = asset.id;
      } catch (err) {
        toast.error(err instanceof AssetValidationError ? err.message : "No se pudo importar la imagen.");
        return;
      }
    }
    s.addImageLayer(assetId, { shoe: hit.shoe, zoneId: hit.zoneId, x: hit.uv.x, y: hit.uv.y });
    toast.success(`Imagen aplicada en ${zone.label.toLowerCase()} (${model.shoes[hit.shoe].label.toLowerCase()})`);
  };

  if (!webgl) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-neutral-500">
        Tu navegador o dispositivo no es compatible con WebGL, necesario para el visor 3D.
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full touch-none select-none"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      data-testid="viewer"
    >
      <Canvas
        shadows
        dpr={quality.dpr}
        gl={{ preserveDrawingBuffer: true, antialias: quality.antialias === "msaa", powerPreference: "high-performance" }}
        camera={{ fov: 30, position: [0.3, 1.4, 6], near: 0.02, far: 200 }}
        onPointerMissed={(e) => {
          if (e.type === "click") useEditor.getState().selectLayer(null);
        }}
      >
        <QualityResolver />
        <Suspense fallback={null}>
          <SneakerModel model={model} />
          <Studio model={model} quality={quality} background={background} />
        </Suspense>
        <CameraRig model={model} />
        <PickBridge />
        <LayerDragController />
        <CaptureBridge />
      </Canvas>
      <LoadingOverlay />
      {dragOver && (
        <div className="pointer-events-none absolute inset-4 rounded-2xl border-2 border-dashed border-blue-500/60 bg-blue-500/5" />
      )}
    </div>
  );
}

function LoadingOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-medium text-neutral-600 shadow-sm backdrop-blur">
        Cargando modelo 3D… {Math.round(progress)}%
      </div>
    </div>
  );
}

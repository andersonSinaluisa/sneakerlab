import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useEditor } from "@/lib/editor/store";
import { detectDeviceHints, pickQualityTier } from "@/lib/render/quality";

/** Resuelve el tier "auto" con información real del contexto WebGL. */
export function QualityResolver() {
  const gl = useThree((s) => s.gl);
  const quality = useEditor((s) => s.quality);
  useEffect(() => {
    const tier = quality === "auto" ? pickQualityTier(detectDeviceHints(gl.getContext())) : quality;
    if (useEditor.getState().resolvedQuality !== tier) useEditor.getState().setResolvedQuality(tier);
  }, [gl, quality]);
  return null;
}

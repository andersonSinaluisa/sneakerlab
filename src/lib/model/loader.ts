/**
 * Carga de modelos GLB profesionales.
 *  - Draco / meshopt para geometría comprimida, KTX2 (Basis) para texturas GPU.
 *  - Los decoders se sirven desde /public/decoders (copiados de three en `npm run decoders:copy`).
 *  - `useGLTF` ya cachea por URL; `preloadModel` permite adelantar la descarga.
 */
import { useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { KTX2Loader } from "three-stdlib";
import { MeshoptDecoder } from "three-stdlib";
import type { ModelConfig } from "./schema";

export const DRACO_PATH = "/decoders/draco/";
export const KTX2_PATH = "/decoders/basis/";

let ktx2: KTX2Loader | null = null;

type ExtendLoader = NonNullable<Parameters<typeof useGLTF>[3]>;
type LoaderArg = Parameters<ExtendLoader>[0];

function extensions(cfg: ModelConfig, renderer?: import("three").WebGLRenderer): ExtendLoader {
  return (loader: LoaderArg) => {
    const c = cfg.source.compression;
    if (c.includes("meshopt")) loader.setMeshoptDecoder(MeshoptDecoder);
    if (c.includes("ktx2") && renderer) {
      ktx2 ??= new KTX2Loader().setTranscoderPath(KTX2_PATH);
      ktx2.detectSupport(renderer);
      loader.setKTX2Loader(ktx2);
    }
  };
}

/** Hook: carga el GLB del modelo con los decoders que declare su manifiesto. */
export function useModelGltf(cfg: ModelConfig) {
  const gl = useThree((s) => s.gl);
  const draco = cfg.source.compression.includes("draco") ? DRACO_PATH : false;
  return useGLTF(cfg.source.url, draco, undefined, extensions(cfg, gl));
}

/** Precarga fuera del Canvas (p. ej. en el catálogo) para que el cambio de modelo sea inmediato. */
export function preloadModel(cfg: ModelConfig) {
  const draco = cfg.source.compression.includes("draco") ? DRACO_PATH : false;
  useGLTF.preload(cfg.source.url, draco, undefined, extensions(cfg));
}

/** Libera la caché del loader cuando el modelo deja de usarse (cambio de modelo). */
export function usePurgeModelOnUnmount(cfg: ModelConfig) {
  useEffect(() => () => useGLTF.clear(cfg.source.url), [cfg.source.url]);
}

/**
 * Iluminación de estudio de producto y post-proceso.
 *  - Entorno: HDRI del manifiesto (archivo local) o, si no existe, un estudio procedural de
 *    lightformers (softboxes) que produce reflejos y degradados creíbles sin depender de red.
 *  - Luz principal direccional con sombras suaves (PCF soft), relleno frío, contraluz.
 *  - ContactShadows acumuladas para "asentar" el zapato en el suelo.
 *  - AO (N8AO) y SMAA solo en el tier alto.
 *  - Exposición moderada para no quemar blancos (cuero blanco debe conservar detalle).
 */
import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, SoftShadows } from "@react-three/drei";
import { EffectComposer, N8AO, SMAA } from "@react-three/postprocessing";
import type { ModelConfig } from "@/lib/model/schema";
import type { QualitySettings } from "@/lib/render/quality";
import { sceneBridge } from "./interaction";

/** Tone mapping ACES, sRGB de salida y sombras suaves. Se aplica fuera del árbol React. */
function configureRenderer(renderer: THREE.WebGLRenderer, exposure: number) {
  Object.assign(renderer, {
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: exposure,
    outputColorSpace: THREE.SRGBColorSpace,
  });
  Object.assign(renderer.shadowMap, { enabled: true, type: THREE.PCFShadowMap });
}

export const BACKGROUNDS = {
  studio: "#e9e7e2",
  white: "#f7f7f5",
  dark: "#1a1a1d",
} as const;

export function Studio({
  model,
  quality,
  background,
}: {
  model: ModelConfig;
  quality: QualitySettings;
  background: keyof typeof BACKGROUNDS;
}) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    configureRenderer(gl, background === "dark" ? 1.0 : 0.92);
  }, [gl, background]);

  // Escala de la escena: el modelo define las distancias de luces/sombras.
  const box = sceneBridge.modelBox;
  const diag = box ? box.getSize(new THREE.Vector3()).length() : 3;
  const floorY = box ? box.min.y : 0;
  const shadowScale = diag * 2.6;
  const envIntensity = (model.environment?.intensity ?? 1) * (background === "dark" ? 0.9 : 1);

  return (
    <>
      <color attach="background" args={[BACKGROUNDS[background]]} />

      {model.environment ? (
        <Environment files={model.environment.url} environmentIntensity={envIntensity} resolution={quality.envResolution} />
      ) : (
        <Environment resolution={quality.envResolution} frames={1} environmentIntensity={envIntensity}>
          {/* Softbox cenital grande: brillo principal en los paneles superiores */}
          <Lightformer form="rect" intensity={3} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[9, 9, 1]} color="#fff8f0" />
          {/* Key lateral frontal */}
          <Lightformer form="rect" intensity={2.2} position={[-6, 3, 5]} rotation-y={Math.PI / 3.2} scale={[7, 4, 1]} color="#ffffff" />
          {/* Fill frío opuesto */}
          <Lightformer form="rect" intensity={1.1} position={[6, 2, -4]} rotation-y={-Math.PI / 2.4} scale={[7, 3, 1]} color="#dfe8ff" />
          {/* Tira de contraluz para perfilar el cuello y los cordones */}
          <Lightformer form="rect" intensity={1.6} position={[0, 4, -7]} rotation-x={0.2} scale={[12, 1.2, 1]} color="#ffffff" />
          {/* Suelo gris para reflejos inferiores suaves */}
          <Lightformer form="rect" intensity={0.5} position={[0, -3, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} color="#8a8a8a" />
        </Environment>
      )}

      <ambientLight intensity={0.15} />
      <directionalLight
        position={[diag * 1.2, diag * 2.2, diag * 1.6]}
        intensity={1.6}
        color="#fff6ea"
        castShadow
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-camera-near={0.1}
        shadow-camera-far={diag * 8}
        shadow-camera-left={-diag}
        shadow-camera-right={diag}
        shadow-camera-top={diag}
        shadow-camera-bottom={-diag}
      />
      <directionalLight position={[-diag * 1.5, diag, -diag]} intensity={0.45} color="#dfe8ff" />
      {quality.tier !== "low" && <SoftShadows size={18} samples={quality.tier === "high" ? 16 : 8} focus={0.6} />}

      <ContactShadows
        position={[0, floorY + 0.001, 0]}
        opacity={background === "dark" ? 0.7 : 0.5}
        scale={shadowScale}
        blur={2.2}
        far={diag * 0.8}
        resolution={quality.contactShadowResolution}
        frames={1}
      />

      {(quality.ambientOcclusion || quality.antialias === "smaa") && (
        <EffectComposer multisampling={quality.antialias === "smaa" ? 0 : 4}>
          <>
            {quality.ambientOcclusion && (
              <N8AO aoRadius={diag * 0.08} intensity={1.6} distanceFalloff={diag * 0.3} quality="medium" halfRes />
            )}
            {quality.antialias === "smaa" && <SMAA />}
          </>
        </EffectComposer>
      )}
    </>
  );
}

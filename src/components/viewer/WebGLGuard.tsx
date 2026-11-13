import { useState } from "react";

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** El editor se renderiza solo en cliente (ssr: false), así que la detección es síncrona. */
export function useWebGLSupport() {
  const [ok] = useState(detectWebGL);
  return ok;
}

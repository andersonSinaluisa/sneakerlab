/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL absoluta del API si no está en el mismo dominio (por defecto, mismo origen). */
  readonly VITE_API_URL?: string;
}

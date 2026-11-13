/** Validación de archivos de imagen subidos (tipo declarado + firma binaria + tamaño). */

export const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export type AcceptedMime = (typeof ACCEPTED_MIME)[number];
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_IMAGE_DIMENSION = 8000; // px antes de reducir
export const MIN_IMAGE_DIMENSION = 16;

export class AssetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetValidationError";
  }
}

/** Detecta el formato real a partir de los primeros bytes. */
export function sniffImageType(bytes: Uint8Array): AcceptedMime | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  )
    return "image/webp";
  return null;
}

export function validateFileMeta(file: { name: string; size: number; type: string }) {
  if (file.size === 0) throw new AssetValidationError("El archivo está vacío.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AssetValidationError(
      `"${file.name}" supera el máximo de ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    );
  }
  if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) {
    throw new AssetValidationError(`"${file.name}" no es PNG, JPG ni WebP.`);
  }
}

export function validateSignature(bytes: Uint8Array, declared: string, name: string): AcceptedMime {
  const real = sniffImageType(bytes);
  if (!real) throw new AssetValidationError(`"${name}" no parece una imagen válida.`);
  if (real !== declared) {
    throw new AssetValidationError(`"${name}" dice ser ${declared} pero su contenido es ${real}.`);
  }
  return real;
}

export function validateDimensions(width: number, height: number, name: string) {
  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    throw new AssetValidationError(`"${name}" es demasiado pequeña (mínimo ${MIN_IMAGE_DIMENSION}px).`);
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new AssetValidationError(`"${name}" supera ${MAX_IMAGE_DIMENSION}px por lado.`);
  }
}

/** Nombre visible seguro (sin rutas ni caracteres de control). */
export function sanitizeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "imagen";
  const clean = base.replace(/[\u0000-\u001f<>"'`]/g, "").replace(/\.[a-z0-9]+$/i, "").trim();
  return (clean || "imagen").slice(0, 60);
}

import { describe, expect, it } from "vitest";
import {
  AssetValidationError, MAX_UPLOAD_BYTES, sanitizeName, sniffImageType,
  validateDimensions, validateFileMeta, validateSignature,
} from "./validation";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

describe("validación de imágenes", () => {
  it("detecta el tipo real por firma", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPG)).toBe("image/jpeg");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(GIF)).toBeNull();
  });

  it("rechaza tipos, tamaños y firmas inválidas", () => {
    expect(() => validateFileMeta({ name: "a.gif", size: 10, type: "image/gif" })).toThrow(AssetValidationError);
    expect(() => validateFileMeta({ name: "a.png", size: MAX_UPLOAD_BYTES + 1, type: "image/png" })).toThrow();
    expect(() => validateFileMeta({ name: "a.png", size: 0, type: "image/png" })).toThrow();
    expect(() => validateSignature(JPG, "image/png", "x.png")).toThrow(/contenido/);
    expect(validateSignature(PNG, "image/png", "x.png")).toBe("image/png");
  });

  it("limita dimensiones", () => {
    expect(() => validateDimensions(8, 100, "x")).toThrow();
    expect(() => validateDimensions(9000, 100, "x")).toThrow();
    expect(() => validateDimensions(800, 600, "x")).not.toThrow();
  });

  it("sanitiza nombres", () => {
    expect(sanitizeName("C:\\fakepath\\<script>héroe.png")).toBe("scripthéroe");
    expect(sanitizeName("../../")).toBe("imagen");
  });
});

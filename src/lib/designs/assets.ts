/**
 * Biblioteca de recursos gráficos del Design Studio.
 * Todas son ilustraciones vectoriales originales generadas por tools/designs/build-assets.py.
 * Las de proporción 2:1 se rasterizan a 2048 px de ancho (lienzos de 2048) y las cuadradas a 1024.
 */
import type { DesignAsset } from "./schema";

const WIDE = new Set([
  "dragon-jade", "dragon-gold", "dragon-ink", "sakura-branch", "sakura-branch-night",
  "waves-indigo", "waves-sunset", "waves-mono", "anime-eye-crimson", "anime-eye-cyan", "anime-eye-gold",
  "anime-eye-violet", "manga-panels-bw", "manga-panels-red", "bolts-yellow", "bolts-cyan", "slash-white",
  "slash-black", "graffiti-arrow-orange", "graffiti-arrow-lime", "geometric-tri-red", "geometric-tri-blue",
  "retro-90s-sparkle", "streetwear-stripes", "streetwear-stripes-blue", "acid-runner", "acid-runner-magenta",
]);

const NAMES: Record<string, string> = {
  "oni-mask-crimson": "Máscara oni carmesí", "oni-mask-ink": "Máscara oni tinta", "oni-mask-jade": "Máscara oni jade",
  "dragon-jade": "Dragón jade", "dragon-gold": "Dragón dorado", "dragon-ink": "Dragón tinta",
  "sakura-branch": "Rama de sakura", "sakura-branch-night": "Rama de sakura nocturna", "sakura-petals": "Pétalos de sakura",
  "waves-indigo": "Olas índigo", "waves-sunset": "Olas atardecer", "waves-mono": "Olas monocromo",
  "kanji-chikara": "Caligrafía 力 (fuerza)", "kanji-kokoro": "Caligrafía 心 (corazón)", "enso-brush": "Ensō",
  "anime-eye-crimson": "Ojo carmesí", "anime-eye-cyan": "Ojo cian", "anime-eye-gold": "Ojo dorado", "anime-eye-violet": "Ojo violeta",
  "ronin-shadow": "Rōnin sombra", "ronin-moon": "Rōnin luna",
  "speed-lines-black": "Líneas de velocidad (negro)", "speed-lines-white": "Líneas de velocidad (blanco)",
  "halftone-black": "Trama de puntos (negro)", "halftone-white": "Trama de puntos (blanco)",
  "manga-panels-bw": "Viñetas manga B/N", "manga-panels-red": "Viñetas manga rojo",
  "comic-burst-yellow": "Explosión cómic amarilla", "comic-burst-cyan": "Explosión cómic cian",
  "chibi-neko-violet": "Chibi neko violeta", "chibi-neko-mint": "Chibi neko menta", "chibi-neko-rose": "Chibi neko rosa",
  "mecha-head-steel": "Mecha acero", "mecha-head-crimson": "Mecha carmesí", "mecha-head-night": "Mecha nocturno",
  "neon-warrior-blue": "Guerrero neón azul", "neon-warrior-pink": "Guerrero neón rosa",
  "aura-dark-red": "Aura oscura roja", "aura-dark-violet": "Aura oscura violeta",
  "aura-celestial-gold": "Aura celestial dorada", "aura-celestial-ice": "Aura celestial hielo",
  "bolts-yellow": "Rayos amarillos", "bolts-cyan": "Rayos cian", "slash-white": "Cortes de katana (blanco)", "slash-black": "Cortes de katana (negro)",
  "graffiti-arrow-orange": "Flecha graffiti naranja", "graffiti-arrow-lime": "Flecha graffiti lima",
  "gothic-rose-cross": "Cruz y rosa gótica", "geometric-tri-red": "Geometría roja", "geometric-tri-blue": "Geometría azul",
  "pixel-bitling": "Bitling (píxel)", "pixel-heart": "Corazón píxel", "retro-90s-sparkle": "Destellos retro 90s",
  "streetwear-stripes": "Franjas streetwear", "streetwear-stripes-blue": "Franjas streetwear azul",
  "void-sorcerer-violet": "Hechicero del vacío (violeta)", "void-sorcerer-crimson": "Hechicero del vacío (carmesí)",
  "acid-runner": "Netrunner ácido", "acid-runner-magenta": "Netrunner magenta",
};

export const DESIGN_ASSETS: Record<string, DesignAsset> = Object.fromEntries(
  Object.entries(NAMES).map(([id, name]) => [
    id,
    { id, name, type: "svg", url: `/designs/assets/${id}.svg`, rasterSize: WIDE.has(id) ? 2048 : 1024, license: "original", author: "Hecho a Pie Studio" },
  ]),
);

export function getDesignAsset(id: string): DesignAsset {
  const a = DESIGN_ASSETS[id];
  if (!a) throw new Error(`Recurso de diseño desconocido: ${id}`);
  return a;
}

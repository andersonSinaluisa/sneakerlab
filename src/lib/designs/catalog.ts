/**
 * Biblioteca inicial de 30 diseños originales del Design Studio.
 * Coordenadas en el espacio UV de cada zona del modelo `court-low-01`:
 *   outer/inner 2048×656 · toe 2048×880 · heel 2048×1008 · tongue 2048×2048.
 * `width` es fracción del ancho del lienzo; una ilustración 2:1 con width 0.64 cabe en alto en los laterales.
 */
import { getDesignAsset } from "./assets";
import { designPresetSchema, type DesignLayer, type DesignZone, type SneakerDesignPreset } from "./schema";

const MODEL = "court-low-01";

type L = Partial<DesignLayer> & { assetId: string; zoneId: string };
const layer = (id: string, l: L): DesignLayer => ({
  id, kind: "image", name: getDesignAsset(l.assetId).name, assetId: l.assetId, shoe: l.shoe ?? "both", zoneId: l.zoneId,
  x: l.x ?? 0.5, y: l.y ?? 0.5, width: l.width ?? 0.4, rotation: l.rotation ?? 0, opacity: l.opacity ?? 1,
  flipX: l.flipX ?? false, mirrorOnLeft: l.mirrorOnLeft ?? false,
});

/** Colores por zona (ambos zapatos) + materiales opcionales. */
type Palette = Partial<Record<"toe" | "outer" | "inner" | "heel" | "upper" | "tongue" | "laces" | "eyelets" | "midsole" | "outsole" | "lining", string>>;
type Materials = Partial<Record<"toe" | "outer" | "inner" | "heel" | "upper" | "tongue" | "midsole", "leather" | "suede" | "canvas" | "mesh" | "rubber" | "foam">>;
const zones = (colors: Palette, materials: Materials = {}): DesignZone[] => {
  const ids = new Set([...Object.keys(colors), ...Object.keys(materials)]);
  return [...ids].map((zoneId) => ({ zoneId, color: colors[zoneId as keyof Palette], material: materials[zoneId as keyof Materials] }));
};

interface Def {
  id: string; name: string; category: SneakerDesignPreset["category"]; tags: string[]; description: string;
  palette: string[]; colors: Palette; materials?: Materials; layers: DesignLayer[]; badge?: "new" | "popular";
}

const base = (upper: string, sole = "#f5f3ee", out = "#d9d4c7", laces = "#fafafa"): Palette => ({
  toe: upper, outer: upper, inner: upper, heel: upper, upper, tongue: upper, laces, eyelets: "#b8b8b8", midsole: sole, outsole: out, lining: "#3a3f45",
});

const DEFS: Def[] = [
  // ───────────────────────────── Anime y manga (20) ─────────────────────────────
  {
    id: "crimson-eye", name: "Crimson Eye", category: "anime-eyes", badge: "popular",
    tags: ["ojo", "tinta", "rojo", "negro"], description: "Primer plano de un ojo anime carmesí con trazos de tinta y líneas de velocidad.",
    palette: ["#111114", "#c81d2e", "#f5f5f5"],
    colors: { ...base("#f5f5f5", "#111114", "#0b0b0d", "#c81d2e"), upper: "#111114", heel: "#111114", tongue: "#111114" },
    materials: { outer: "leather", inner: "leather" },
    layers: [
      layer("eye", { assetId: "anime-eye-crimson", zoneId: "outer", width: 0.62, mirrorOnLeft: true }),
      layer("eye-in", { assetId: "anime-eye-crimson", zoneId: "inner", width: 0.5, opacity: 0.9, mirrorOnLeft: true }),
      layer("tone", { assetId: "halftone-white", zoneId: "heel", width: 0.5, opacity: 0.6 }),
    ],
  },
  {
    id: "violet-gaze", name: "Violet Gaze", category: "anime-eyes",
    tags: ["ojo", "violeta", "aura"], description: "Mirada violeta con aura oscura en el interior y acentos púrpura.",
    palette: ["#1e1535", "#7c3aed", "#e9e4ff"],
    colors: { ...base("#1e1535", "#e9e4ff", "#1e1535", "#7c3aed"), toe: "#2a1d4d" },
    layers: [
      layer("eye", { assetId: "anime-eye-violet", zoneId: "outer", width: 0.62, mirrorOnLeft: true }),
      layer("aura", { assetId: "aura-dark-violet", zoneId: "inner", x: 0.55, y: 0.55, width: 0.3 }),
      layer("tone", { assetId: "halftone-white", zoneId: "heel", width: 0.45, opacity: 0.35 }),
    ],
  },
  {
    id: "retro-gaze", name: "Retro Gaze", category: "anime-retro-90s",
    tags: ["90s", "destellos", "cian"], description: "Destellos y franjas retro con un ojo cian estilo OVA noventero.",
    palette: ["#fff5e1", "#5ad1ff", "#ff5fa2", "#ffd166"],
    colors: { ...base("#fff5e1", "#ffd166", "#2a1b3d", "#ff5fa2"), heel: "#5ad1ff" },
    layers: [
      layer("sparkle", { assetId: "retro-90s-sparkle", zoneId: "outer", width: 0.9, opacity: 0.9 }),
      layer("eye", { assetId: "anime-eye-cyan", zoneId: "inner", width: 0.55, mirrorOnLeft: true }),
      layer("heart", { assetId: "pixel-heart", zoneId: "toe", x: 0.5, y: 0.55, width: 0.2 }),
    ],
  },
  {
    id: "shadow-ronin", name: "Shadow Ronin", category: "samurai-anime", badge: "popular",
    tags: ["samurái", "katana", "monocromo", "rojo"], description: "Rōnin con katana bajo un sol rojo; cortes de tinta en el lateral interior.",
    palette: ["#f3f0e8", "#0b0b0d", "#b3121b"],
    colors: { ...base("#f3f0e8", "#f3f0e8", "#0b0b0d", "#0b0b0d"), heel: "#0b0b0d", upper: "#0b0b0d" },
    layers: [
      layer("ronin", { assetId: "ronin-shadow", zoneId: "outer", x: 0.42, y: 0.52, width: 0.3, mirrorOnLeft: true }),
      layer("slash", { assetId: "slash-black", zoneId: "inner", width: 0.64, opacity: 0.9, mirrorOnLeft: true }),
      layer("sun", { assetId: "enso-brush", zoneId: "heel", width: 0.34, opacity: 0.85 }),
    ],
  },
  {
    id: "sakura-blade", name: "Sakura Blade", category: "samurai-anime",
    tags: ["sakura", "espadachina", "rosa"], description: "Espadachina bajo la luna y lluvia de pétalos de cerezo.",
    palette: ["#fff0f5", "#f7b6c9", "#101014"],
    colors: { ...base("#fff0f5", "#fff0f5", "#101014", "#101014"), heel: "#f7b6c9", tongue: "#f7b6c9" },
    materials: { outer: "suede", inner: "suede" },
    layers: [
      layer("ronin", { assetId: "ronin-moon", zoneId: "outer", x: 0.4, y: 0.5, width: 0.3, mirrorOnLeft: true }),
      layer("petals-out", { assetId: "sakura-petals", zoneId: "outer", x: 0.72, width: 0.3, opacity: 0.9 }),
      layer("petals-in", { assetId: "sakura-petals", zoneId: "inner", width: 0.34 }),
      layer("petals-toe", { assetId: "sakura-petals", zoneId: "toe", width: 0.36, opacity: 0.85 }),
    ],
  },
  {
    id: "dark-awakening", name: "Dark Awakening", category: "dark-anime", badge: "popular",
    tags: ["aura", "oscuro", "rojo", "energía"], description: "Aura oscura con energía roja, velocidad blanca y suela negra.",
    palette: ["#0b0b0d", "#dc2626", "#f5f5f5"],
    colors: { ...base("#0b0b0d", "#0b0b0d", "#0b0b0d", "#dc2626"), midsole: "#1a1a1e" },
    materials: { outer: "leather", inner: "leather", toe: "suede", heel: "suede" },
    layers: [
      layer("aura", { assetId: "aura-dark-red", zoneId: "outer", x: 0.5, y: 0.55, width: 0.32 }),
      layer("speed", { assetId: "speed-lines-white", zoneId: "inner", width: 0.4, opacity: 0.8 }),
      layer("speed2", { assetId: "speed-lines-white", zoneId: "heel", width: 0.55, opacity: 0.5 }),
    ],
  },
  {
    id: "celestial-fighter", name: "Celestial Fighter", category: "anime-fantasy",
    tags: ["dorado", "aura", "rayos", "luz"], description: "Aura luminosa dorada con mechones estilizados y rayos en el interior.",
    palette: ["#fffaf0", "#f59e0b", "#3b2a06"],
    colors: { ...base("#fffaf0", "#fffaf0", "#3b2a06", "#f59e0b"), heel: "#f59e0b" },
    layers: [
      layer("aura", { assetId: "aura-celestial-gold", zoneId: "outer", width: 0.32 }),
      layer("bolts", { assetId: "bolts-yellow", zoneId: "inner", width: 0.64 }),
      layer("burst", { assetId: "speed-lines-black", zoneId: "toe", width: 0.4, opacity: 0.25 }),
    ],
  },
  {
    id: "mecha-pulse", name: "Mecha Pulse", category: "mecha-anime", badge: "popular",
    tags: ["robot", "mecha", "azul", "acero"], description: "Cabeza mecha de acero con visor azul y rayos cian.",
    palette: ["#e5e7eb", "#1f2937", "#38bdf8"],
    colors: { ...base("#e5e7eb", "#1f2937", "#111827", "#38bdf8"), toe: "#1f2937", heel: "#1f2937" },
    materials: { toe: "rubber", heel: "rubber" },
    layers: [
      layer("mecha", { assetId: "mecha-head-steel", zoneId: "outer", width: 0.3 }),
      layer("bolts", { assetId: "bolts-cyan", zoneId: "inner", width: 0.64 }),
      layer("geo", { assetId: "geometric-tri-blue", zoneId: "tongue", width: 0.9, opacity: 0.5 }),
    ],
  },
  {
    id: "night-mecha", name: "Night Mecha", category: "mecha-anime",
    tags: ["robot", "violeta", "noche"], description: "Mecha nocturno con visor violeta y guerrero neón rosa en el interior.",
    palette: ["#111318", "#a855f7", "#22d3ee"],
    colors: { ...base("#111318", "#1f2933", "#05070a", "#a855f7") },
    layers: [
      layer("mecha", { assetId: "mecha-head-night", zoneId: "outer", width: 0.3 }),
      layer("neon", { assetId: "neon-warrior-pink", zoneId: "inner", width: 0.3 }),
    ],
  },
  {
    id: "crimson-mecha", name: "Crimson Mecha", category: "anime-full-color",
    tags: ["robot", "rojo", "cómic"], description: "Mecha carmesí a todo color con explosión cian en el interior.",
    palette: ["#f3f4f6", "#b91c1c", "#38bdf8"],
    colors: { ...base("#f3f4f6", "#f3f4f6", "#1a0a0a", "#b91c1c"), toe: "#b91c1c", heel: "#b91c1c" },
    layers: [
      layer("mecha", { assetId: "mecha-head-crimson", zoneId: "outer", width: 0.3 }),
      layer("burst", { assetId: "comic-burst-cyan", zoneId: "inner", x: 0.5, width: 0.3 }),
      layer("tone", { assetId: "halftone-black", zoneId: "tongue", width: 0.9, opacity: 0.35 }),
    ],
  },
  {
    id: "shonen-impact", name: "Shonen Impact", category: "shonen-battle", badge: "new",
    tags: ["explosión", "rayos", "amarillo"], description: "Explosión de impacto, rayos amarillos y líneas de velocidad.",
    palette: ["#fff8e1", "#ffd400", "#ff3b3b", "#111111"],
    colors: { ...base("#fff8e1", "#111111", "#111111", "#ff3b3b"), heel: "#ffd400", toe: "#111111" },
    layers: [
      layer("burst", { assetId: "comic-burst-yellow", zoneId: "outer", x: 0.45, width: 0.32 }),
      layer("speed", { assetId: "speed-lines-black", zoneId: "outer", x: 0.45, width: 0.5, opacity: 0.35 }),
      layer("bolts", { assetId: "bolts-yellow", zoneId: "inner", width: 0.64 }),
    ],
  },
  {
    id: "thunder-clash", name: "Thunder Clash", category: "shonen-battle",
    tags: ["rayos", "cortes", "cian"], description: "Cortes de katana y rayos cian sobre base negra mate.",
    palette: ["#0b0b0d", "#22d3ee", "#ffffff"],
    colors: { ...base("#0b0b0d", "#0b0b0d", "#0b0b0d", "#22d3ee"), midsole: "#f5f5f5" },
    materials: { outer: "suede", inner: "suede" },
    layers: [
      layer("slash", { assetId: "slash-white", zoneId: "outer", width: 0.64, mirrorOnLeft: true }),
      layer("bolts", { assetId: "bolts-cyan", zoneId: "inner", width: 0.64 }),
      layer("bolts2", { assetId: "bolts-cyan", zoneId: "heel", width: 0.6, opacity: 0.8 }),
    ],
  },
  {
    id: "manga-clash", name: "Manga Clash", category: "manga-panels", badge: "popular",
    tags: ["viñetas", "blanco y negro", "manga"], description: "Composición de viñetas manga con tramas, expresiones y líneas de velocidad.",
    palette: ["#ffffff", "#0b0b0d", "#e11d48"],
    colors: { ...base("#ffffff", "#ffffff", "#0b0b0d", "#0b0b0d"), heel: "#0b0b0d" },
    layers: [
      layer("panels", { assetId: "manga-panels-bw", zoneId: "outer", width: 0.64, mirrorOnLeft: true }),
      layer("panels-in", { assetId: "manga-panels-bw", zoneId: "inner", width: 0.64, mirrorOnLeft: true }),
      layer("tone", { assetId: "halftone-white", zoneId: "heel", width: 0.5, opacity: 0.7 }),
      layer("speed", { assetId: "speed-lines-black", zoneId: "toe", width: 0.42, opacity: 0.5 }),
    ],
  },
  {
    id: "speed-ink", name: "Speed Ink", category: "manga-bw",
    tags: ["velocidad", "tinta", "blanco y negro"], description: "Líneas de velocidad en tinta negra que recorren todo el zapato.",
    palette: ["#ffffff", "#0b0b0d"],
    colors: { ...base("#ffffff", "#ffffff", "#0b0b0d", "#0b0b0d"), tongue: "#0b0b0d" },
    layers: [
      layer("speed", { assetId: "speed-lines-black", zoneId: "outer", x: 0.3, width: 0.5 }),
      layer("speed2", { assetId: "speed-lines-black", zoneId: "inner", x: 0.7, width: 0.5 }),
      layer("tone", { assetId: "halftone-black", zoneId: "heel", width: 0.6, opacity: 0.8 }),
      layer("tone2", { assetId: "halftone-black", zoneId: "toe", width: 0.5, opacity: 0.5 }),
    ],
  },
  {
    id: "ink-panels", name: "Ink Panels", category: "manga-bw",
    tags: ["viñetas", "rojo", "tinta"], description: "Viñetas con un único acento rojo sobre cuero blanco y suela negra.",
    palette: ["#fff7f7", "#0b0b0d", "#b3121b"],
    colors: { ...base("#fff7f7", "#fff7f7", "#0b0b0d", "#b3121b") },
    layers: [
      layer("panels", { assetId: "manga-panels-red", zoneId: "outer", width: 0.64, mirrorOnLeft: true }),
      layer("speed", { assetId: "speed-lines-black", zoneId: "inner", width: 0.45, opacity: 0.6 }),
    ],
  },
  {
    id: "kawaii-neko", name: "Kawaii Neko", category: "chibi-kawaii", badge: "popular",
    tags: ["chibi", "gato", "kawaii", "pastel"], description: "Chibi neko violeta con pétalos pastel y cordones rosa.",
    palette: ["#efe7ff", "#6d4aff", "#ff79b0"],
    colors: { ...base("#efe7ff", "#ffffff", "#6d4aff", "#ff79b0"), toe: "#ffffff", heel: "#ff79b0" },
    materials: { outer: "canvas", inner: "canvas" },
    layers: [
      layer("chibi", { assetId: "chibi-neko-violet", zoneId: "outer", x: 0.4, width: 0.3, mirrorOnLeft: true }),
      layer("petals", { assetId: "sakura-petals", zoneId: "outer", x: 0.75, width: 0.3, opacity: 0.8 }),
      layer("chibi-in", { assetId: "chibi-neko-rose", zoneId: "inner", x: 0.55, width: 0.3, mirrorOnLeft: true }),
      layer("heart", { assetId: "pixel-heart", zoneId: "tongue", width: 0.45 }),
    ],
  },
  {
    id: "mint-neko", name: "Mint Neko", category: "chibi-kawaii",
    tags: ["chibi", "menta", "amarillo"], description: "Chibi neko menta con destellos y acentos amarillos.",
    palette: ["#f0fdfa", "#2dd4bf", "#fde047"],
    colors: { ...base("#f0fdfa", "#fde047", "#1a2e2e", "#2dd4bf"), heel: "#2dd4bf" },
    layers: [
      layer("chibi", { assetId: "chibi-neko-mint", zoneId: "outer", x: 0.45, width: 0.3, mirrorOnLeft: true }),
      layer("sparkle", { assetId: "retro-90s-sparkle", zoneId: "inner", width: 0.9, opacity: 0.6 }),
    ],
  },
  {
    id: "neon-warrior", name: "Neon Warrior", category: "cyberpunk-anime", badge: "popular",
    tags: ["neón", "cyberpunk", "azul", "violeta"], description: "Guerrero futurista con iluminación azul y violeta sobre base negra.",
    palette: ["#0b0614", "#3b82f6", "#a855f7"],
    colors: { ...base("#0b0614", "#0b0614", "#05070a", "#a855f7"), midsole: "#1b1030" },
    layers: [
      layer("neon", { assetId: "neon-warrior-blue", zoneId: "outer", width: 0.3 }),
      layer("geo", { assetId: "geometric-tri-blue", zoneId: "inner", width: 0.9, opacity: 0.55 }),
      layer("neon-heel", { assetId: "neon-warrior-blue", zoneId: "heel", width: 0.36, opacity: 0.8 }),
    ],
  },
  {
    id: "minimal-enso", name: "Minimal Ensō", category: "anime-minimalist",
    tags: ["minimal", "caligrafía", "zen"], description: "Un ensō y la caligrafía 心 sobre cuero crudo. Nada más.",
    palette: ["#f3f0e8", "#111111", "#b3121b"],
    colors: { ...base("#f3f0e8", "#f3f0e8", "#2b2b2b", "#111111") },
    layers: [
      layer("enso", { assetId: "enso-brush", zoneId: "outer", x: 0.3, width: 0.26 }),
      layer("kokoro", { assetId: "kanji-kokoro", zoneId: "inner", x: 0.68, width: 0.26 }),
    ],
  },
  {
    id: "street-neko", name: "Street Neko", category: "anime-streetwear",
    tags: ["streetwear", "franjas", "chibi"], description: "Franjas streetwear con parche de estrella y chibi rosa en el interior.",
    palette: ["#f5f5f5", "#111111", "#e11d48"],
    colors: { ...base("#f5f5f5", "#f5f5f5", "#111111", "#e11d48"), toe: "#111111" },
    layers: [
      layer("stripes", { assetId: "streetwear-stripes", zoneId: "outer", width: 0.64, mirrorOnLeft: true }),
      layer("chibi", { assetId: "chibi-neko-rose", zoneId: "inner", x: 0.5, width: 0.3, mirrorOnLeft: true }),
    ],
  },
  {
    id: "graffiti-oni", name: "Graffiti Oni", category: "anime-graffiti", badge: "new",
    tags: ["graffiti", "oni", "naranja"], description: "Flecha graffiti naranja y máscara oni jade con salpicaduras.",
    palette: ["#fafafa", "#f97316", "#0ea5e9", "#1f7a5a"],
    colors: { ...base("#fafafa", "#fafafa", "#111111", "#f97316"), heel: "#0ea5e9" },
    layers: [
      layer("arrow", { assetId: "graffiti-arrow-orange", zoneId: "outer", width: 0.64, mirrorOnLeft: true }),
      layer("oni", { assetId: "oni-mask-jade", zoneId: "inner", x: 0.5, width: 0.3 }),
    ],
  },
  {
    id: "void-sorcerer", name: "Void Sorcerer", category: "anime-fantasy", badge: "new",
    tags: ["hechicero", "vacío", "violeta", "arcano", "energía"], description: "Hechicero encapuchado concentrando una esfera de energía del vacío sobre un círculo arcano; cortes de luz en el interior.",
    palette: ["#0f1020", "#a855f7", "#7dd3fc", "#f5d0fe"],
    colors: { ...base("#0f1020", "#1b1d3a", "#0a0a12", "#a855f7"), toe: "#1b1d3a", heel: "#7dd3fc", midsole: "#e9e4ff" },
    materials: { toe: "suede", heel: "leather" },
    layers: [
      layer("sorcerer", { assetId: "void-sorcerer-violet", zoneId: "outer", x: 0.5, y: 0.52, width: 0.32 }),
      layer("slash", { assetId: "slash-white", zoneId: "inner", width: 0.64, opacity: 0.85, mirrorOnLeft: true }),
      layer("aura", { assetId: "aura-dark-violet", zoneId: "heel", width: 0.34, opacity: 0.9 }),
      layer("glyph", { assetId: "speed-lines-white", zoneId: "tongue", width: 0.8, opacity: 0.25 }),
    ],
  },
  {
    id: "acid-runner", name: "Acid Runner", category: "cyberpunk-anime", badge: "new",
    tags: ["netrunner", "neón", "amarillo ácido", "glitch", "ciudad"], description: "Netrunner con visor cian e implantes sobre un skyline neón con barras glitch; amarillo ácido y negro.",
    palette: ["#0a0a12", "#e6ff2b", "#19e6ff"],
    colors: { ...base("#0a0a12", "#e6ff2b", "#0a0a12", "#19e6ff"), toe: "#1a1a2a", heel: "#e6ff2b", lining: "#19e6ff" },
    materials: { outer: "leather", inner: "leather", toe: "mesh" },
    layers: [
      layer("runner", { assetId: "acid-runner", zoneId: "outer", width: 0.66, mirrorOnLeft: true }),
      layer("runner-in", { assetId: "acid-runner-magenta", zoneId: "inner", width: 0.66, mirrorOnLeft: true }),
      layer("geo", { assetId: "geometric-tri-blue", zoneId: "tongue", width: 0.9, opacity: 0.5 }),
    ],
  },
  // ───────────────────────────── Cultura japonesa (5) ─────────────────────────────
  {
    id: "dragon-spirit", name: "Dragon Spirit", category: "japanese-dragons", badge: "popular",
    tags: ["dragón", "nubes", "verde"], description: "Dragón oriental jade envolviendo el lateral exterior entre nubes japonesas; olas en el interior.",
    palette: ["#f3f0e8", "#2e8b57", "#1d4e89", "#0d1b14"],
    colors: { ...base("#f3f0e8", "#f3f0e8", "#0d1b14", "#2e8b57"), heel: "#2e8b57" },
    layers: [
      layer("dragon", { assetId: "dragon-jade", zoneId: "outer", width: 0.66, mirrorOnLeft: true }),
      layer("waves", { assetId: "waves-indigo", zoneId: "inner", width: 0.64, opacity: 0.9 }),
    ],
  },
  {
    id: "ink-demon", name: "Ink Demon", category: "oni-masks", badge: "popular",
    tags: ["oni", "máscara", "humo", "carmesí"], description: "Máscara oni carmesí entre humo negro; acentos carmesí en cordones y entresuela.",
    palette: ["#0b0b0d", "#b3121b", "#f3e9d2"],
    colors: { ...base("#0b0b0d", "#b3121b", "#0b0b0d", "#b3121b"), toe: "#1a1a1f" },
    materials: { outer: "leather", inner: "leather", toe: "suede" },
    layers: [
      layer("oni", { assetId: "oni-mask-crimson", zoneId: "outer", width: 0.32 }),
      layer("oni-in", { assetId: "oni-mask-ink", zoneId: "inner", width: 0.3, opacity: 0.95 }),
      layer("kanji", { assetId: "kanji-chikara", zoneId: "heel", width: 0.3, opacity: 0.9 }),
    ],
  },
  {
    id: "sakura-dream", name: "Sakura Dream", category: "sakura",
    tags: ["sakura", "rama", "rosa", "primavera"], description: "Rama de cerezo en flor recorriendo ambos laterales, pétalos en punta y lengüeta.",
    palette: ["#fffafc", "#f7b6c9", "#3a2a24"],
    colors: { ...base("#fffafc", "#fffafc", "#3a2a24", "#f7b6c9") },
    materials: { outer: "canvas", inner: "canvas", tongue: "canvas" },
    layers: [
      layer("branch", { assetId: "sakura-branch", zoneId: "outer", width: 0.9, mirrorOnLeft: true }),
      layer("branch-in", { assetId: "sakura-branch", zoneId: "inner", width: 0.9, flipX: true, mirrorOnLeft: true }),
      layer("petals-toe", { assetId: "sakura-petals", zoneId: "toe", width: 0.4, opacity: 0.9 }),
      layer("petals-tongue", { assetId: "sakura-petals", zoneId: "tongue", width: 0.8, opacity: 0.8 }),
    ],
  },
  {
    id: "great-wave", name: "Great Wave", category: "japanese-waves",
    tags: ["olas", "índigo", "espuma"], description: "Olas japonesas índigo con espuma en ambos laterales y punta.",
    palette: ["#f4f6f8", "#1d4e89", "#0d2238"],
    colors: { ...base("#f4f6f8", "#f4f6f8", "#0d2238", "#1d4e89"), heel: "#1d4e89" },
    layers: [
      layer("waves", { assetId: "waves-indigo", zoneId: "outer", width: 0.9, y: 0.55 }),
      layer("waves-in", { assetId: "waves-indigo", zoneId: "inner", width: 0.9, y: 0.55 }),
      layer("waves-toe", { assetId: "waves-indigo", zoneId: "toe", width: 0.7, y: 0.6, opacity: 0.9 }),
    ],
  },
  {
    id: "kanji-force", name: "Kanji Force", category: "kanji-typography",
    tags: ["kanji", "caligrafía", "fuerza"], description: "Caligrafía 力 (fuerza) en el exterior y 心 (corazón) en el interior, sello rojo.",
    palette: ["#f3f0e8", "#111111", "#b3121b"],
    colors: { ...base("#f3f0e8", "#111111", "#111111", "#b3121b") },
    layers: [
      layer("chikara", { assetId: "kanji-chikara", zoneId: "outer", x: 0.42, width: 0.3 }),
      layer("kokoro", { assetId: "kanji-kokoro", zoneId: "inner", x: 0.58, width: 0.3 }),
      layer("enso", { assetId: "enso-brush", zoneId: "heel", width: 0.34, opacity: 0.9 }),
    ],
  },
  // ───────────────────────────── Urbanos (5) ─────────────────────────────
  {
    id: "street-tag", name: "Street Tag", category: "graffiti",
    tags: ["graffiti", "lima", "rosa"], description: "Flechas graffiti lima y rosa con goteos sobre lona blanca.",
    palette: ["#fafafa", "#a3e635", "#f472b6", "#111111"],
    colors: { ...base("#fafafa", "#fafafa", "#111111", "#a3e635"), heel: "#111111" },
    materials: { outer: "canvas", inner: "canvas", toe: "canvas" },
    layers: [
      layer("arrow", { assetId: "graffiti-arrow-lime", zoneId: "outer", width: 0.64, mirrorOnLeft: true }),
      layer("arrow-in", { assetId: "graffiti-arrow-lime", zoneId: "inner", width: 0.64, flipX: true, mirrorOnLeft: true }),
    ],
  },
  {
    id: "pop-burst", name: "Pop Burst", category: "comic-book",
    tags: ["cómic", "pop", "amarillo", "trama"], description: "Explosión de cómic amarilla con tramas de puntos y suela roja.",
    palette: ["#ffffff", "#ffd400", "#ff3b3b", "#111111"],
    colors: { ...base("#ffffff", "#ffd400", "#111111", "#111111"), midsole: "#ff3b3b", heel: "#ffd400" },
    layers: [
      layer("burst", { assetId: "comic-burst-yellow", zoneId: "outer", width: 0.3 }),
      layer("tone", { assetId: "halftone-black", zoneId: "outer", x: 0.85, width: 0.3, opacity: 0.5 }),
      layer("burst-in", { assetId: "comic-burst-cyan", zoneId: "inner", width: 0.3 }),
      layer("tone-toe", { assetId: "halftone-black", zoneId: "toe", width: 0.45, opacity: 0.6 }),
    ],
  },
  {
    id: "gothic-rose", name: "Gothic Rose", category: "gothic",
    tags: ["gótico", "rosa", "negro"], description: "Cruz con rosa y espinas en gamuza negra; cordones burdeos.",
    palette: ["#0b0b0d", "#8b0000", "#1f3d2b"],
    colors: { ...base("#0b0b0d", "#0b0b0d", "#0b0b0d", "#8b0000"), midsole: "#1a1a1e" },
    materials: { outer: "suede", inner: "suede", toe: "suede", heel: "suede" },
    layers: [
      layer("rose", { assetId: "gothic-rose-cross", zoneId: "outer", width: 0.28 }),
      layer("rose-in", { assetId: "gothic-rose-cross", zoneId: "inner", width: 0.28, opacity: 0.9 }),
    ],
  },
  {
    id: "pixel-quest", name: "Pixel Quest", category: "gaming", badge: "new",
    tags: ["píxel", "gaming", "retro"], description: "Criatura píxel original y corazones de vida sobre lona azul noche.",
    palette: ["#1e1b4b", "#22d3ee", "#ef4464"],
    colors: { ...base("#1e1b4b", "#f8fafc", "#1e1b4b", "#22d3ee") },
    materials: { outer: "canvas", inner: "canvas", toe: "canvas", heel: "canvas" },
    layers: [
      layer("bitling", { assetId: "pixel-bitling", zoneId: "outer", x: 0.45, width: 0.3, mirrorOnLeft: true }),
      layer("heart1", { assetId: "pixel-heart", zoneId: "inner", x: 0.35, width: 0.14 }),
      layer("heart2", { assetId: "pixel-heart", zoneId: "inner", x: 0.5, width: 0.14 }),
      layer("heart3", { assetId: "pixel-heart", zoneId: "inner", x: 0.65, width: 0.14, opacity: 0.4 }),
      layer("heart-toe", { assetId: "pixel-heart", zoneId: "toe", width: 0.22 }),
    ],
  },
  {
    id: "neon-grid", name: "Neon Grid", category: "neon",
    tags: ["neón", "rosa", "cian", "geometría"], description: "Casco neón rosa y geometría azul sobre negro con entresuela cian.",
    palette: ["#120616", "#f472b6", "#22d3ee"],
    colors: { ...base("#120616", "#22d3ee", "#120616", "#f472b6") },
    layers: [
      layer("neon", { assetId: "neon-warrior-pink", zoneId: "outer", width: 0.3 }),
      layer("geo", { assetId: "geometric-tri-blue", zoneId: "inner", width: 0.9, opacity: 0.6 }),
      layer("geo-heel", { assetId: "geometric-tri-blue", zoneId: "heel", width: 0.7, opacity: 0.5 }),
    ],
  },
];

const createdAt = "2026-11-09T00:00:00.000Z";

/** Las zonas con ilustración usan cuero liso por defecto: la gamuza apaga los colores impresos. */
function withPrintMaterials(d: Def): Materials {
  const m: Materials = { ...d.materials };
  for (const l of d.layers) {
    const z = l.zoneId as keyof Materials;
    if ((z === "outer" || z === "inner" || z === "toe" || z === "heel") && !m[z]) m[z] = "leather";
  }
  return m;
}

export const BUILTIN_PRESETS: SneakerDesignPreset[] = DEFS.map((d) => {
  const assetIds = [...new Set(d.layers.map((l) => l.assetId))];
  return designPresetSchema.parse({
    id: d.id, name: d.name, category: d.category, tags: d.tags, description: d.description,
    thumbnailUrl: `/designs/thumbs/${d.id}/hero.jpg`,
    previewImages: ["hero", "outer", "inner", "back", "both"].map((v) => `/designs/thumbs/${d.id}/${v}.jpg`),
    compatibleModels: [MODEL],
    colorPalette: d.palette,
    zones: zones(d.colors, withPrintMaterials(d)),
    layers: d.layers,
    assets: assetIds.map(getDesignAsset),
    status: "published",
    badge: d.badge,
    version: 1, createdAt, updatedAt: createdAt, source: "builtin",
  });
});

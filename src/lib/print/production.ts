/**
 * Paquete de producción DTF de un pedido (se genera en el navegador del admin).
 *
 * Por cada zona con capas y cada pie:
 *  - imprimir/…png    arte a 300 ppp y tamaño real de la talla del pedido, fondo transparente,
 *                     recortado a la silueta del panel + sangrado (lo que va a la película DTF)
 *  - plantillas/…png  silueta del panel 1:1 con el arte en tenue, para comprobar escala y colocar
 *  - hoja-dtf.png     todas las piezas juntas en una hoja del ancho del rollo (lista para enviar)
 *  - originales/      imágenes del cliente sin reducir
 *  - hoja-produccion.html  resumen: talla, colores y materiales por zona, textos, piezas, calidad
 *
 * El color base de cada zona no se imprime: se pinta. Solo las capas (imágenes, textos, patrones)
 * van a DTF.
 */
import { GLTFLoader, MeshoptDecoder } from "three-stdlib";
import type { Mesh, Object3D } from "three";
import { zipSync, strToU8 } from "fflate";
import type { DesignDocument, ImageLayer, Layer, TextLayer } from "@/lib/editor/types";
import type { ModelConfig, ShoeSide } from "@/lib/model/schema";
import { composeZone } from "@/lib/textures/compositor";
import { croppedSize, layerBox, type Size } from "@/lib/textures/layerMath";
import { rasterizeFromUrl } from "@/lib/assets/assetStore";
import { resolveCanvasFont } from "@/components/editor/fonts";
import { sizeScale } from "./measure";
import { packShelves } from "./pack";
import { withPngDpi } from "./png";

export interface ProductionOptions {
  dpi?: number;
  bleedMm?: number;
  /** Ancho útil del rollo/hoja DTF en mm (58 cm de rollo ≈ 560 mm útiles). */
  sheetWidthMm?: number;
  onProgress?: (msg: string) => void;
}

export interface OrderInfo {
  number: number;
  size: string | null;
  customer?: string;
  notes?: string | null;
  extras: string[];
}

export interface PieceReport {
  file: string;
  side: ShoeSide;
  zoneId: string;
  zoneLabel: string;
  widthMm: number;
  heightMm: number;
  /** Posición del arte respecto a la esquina sup. izq. de la silueta del panel. */
  offsetMm: { x: number; y: number };
  panelMm: { width: number; height: number };
}

export interface QualityNote {
  level: "ok" | "warn" | "bad";
  text: string;
}

const SIDES: ShoeSide[] = ["right", "left"];
const SIDE_LABEL: Record<ShoeSide, string> = { right: "derecho", left: "izquierdo" };
const mm2px = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);
const px2mm = (px: number, dpi: number) => +((px / dpi) * 25.4).toFixed(1);
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  return { c, ctx };
}

async function toPng(c: HTMLCanvasElement, dpi: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo codificar el PNG (¿lienzo demasiado grande?)"))), "image/png"));
  return withPngDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
}

/* ---------- Geometría: triángulos UV de cada panel ---------- */

type UvTriangles = Float32Array; // u0,v0,u1,v1,u2,v2 por triángulo

async function loadUvTriangles(model: ModelConfig): Promise<Map<string, UvTriangles>> {
  const loader = new GLTFLoader();
  if (model.source.compression.includes("meshopt")) loader.setMeshoptDecoder(MeshoptDecoder() as never);
  const gltf = await loader.loadAsync(model.source.url);
  const out = new Map<string, UvTriangles>();
  for (const zone of model.zones) {
    if (!zone.texture) continue;
    for (const side of SIDES) {
      const root = gltf.scene.getObjectByName(zone.meshNames[side]);
      if (!root) continue;
      const tris: number[] = [];
      root.traverse((o: Object3D) => {
        const g = (o as Mesh).isMesh ? (o as Mesh).geometry : null;
        const uv = g?.getAttribute("uv");
        if (!g || !uv) return;
        const idx = g.getIndex();
        const n = idx ? idx.count : uv.count;
        for (let i = 0; i < n; i++) {
          const k = idx ? idx.getX(i) : i;
          tris.push(uv.getX(k), uv.getY(k));
        }
      });
      out.set(`${side}:${zone.id}`, new Float32Array(tris));
    }
  }
  return out;
}

/** Silueta del panel en un lienzo W×H, dilatada `growPx` (sangrado). */
function silhouette(tris: UvTriangles, w: number, h: number, growPx: number, color = "#000") {
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.5, growPx * 2);
  ctx.beginPath();
  for (let i = 0; i < tris.length; i += 6) {
    ctx.moveTo(tris[i] * w, tris[i + 1] * h);
    ctx.lineTo(tris[i + 2] * w, tris[i + 3] * h);
    ctx.lineTo(tris[i + 4] * w, tris[i + 5] * h);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  return c;
}

/** Caja de los píxeles no transparentes. */
function alphaBounds(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d")!;
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function crop(src: HTMLCanvasElement, r: { x: number; y: number; w: number; h: number }) {
  const { c, ctx } = canvas(r.w, r.h);
  ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  return c;
}

/* ---------- Imágenes a resolución de impresión ---------- */

const isVector = (a: DesignDocument["assets"][string]) => a.mime === "image/svg+xml" || /\.svg($|\?)/i.test(a.url ?? "");

type PrintImage = CanvasImageSource & Size;

async function loadPrintImages(doc: DesignDocument, neededPx: Map<string, number>): Promise<Map<string, PrintImage>> {
  const out = new Map<string, PrintImage>();
  for (const [id, need] of neededPx) {
    const a = doc.assets[id];
    if (!a) continue;
    const url = a.original?.url ?? a.url;
    if (!url || url.startsWith("blob:")) continue;
    if (isVector(a)) {
      out.set(id, await rasterizeFromUrl(url, Math.min(6000, Math.max(1024, Math.ceil(need)))));
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo descargar la imagen "${a.name}" (${res.status})`);
    out.set(id, await createImageBitmap(await res.blob()));
  }
  return out;
}

async function loadFonts(layers: Layer[]) {
  const texts = layers.filter((l): l is TextLayer => l.kind === "text");
  await Promise.all(
    texts.map((t) => document.fonts.load(`${t.italic ? "italic " : ""}${t.weight} 100px ${resolveCanvasFont(t.font)}`, t.text).catch(() => [])),
  );
}

/* ---------- Paquete ---------- */

export async function buildProductionPack(doc: DesignDocument, model: ModelConfig, order: OrderInfo, opts: ProductionOptions = {}) {
  const dpi = opts.dpi ?? 300;
  const bleedMm = opts.bleedMm ?? 3;
  const sheetWidthMm = opts.sheetWidthMm ?? 560;
  const say = opts.onProgress ?? (() => {});
  const notes: QualityNote[] = [];

  const sizeEU = order.size ? parseFloat(order.size.replace(",", ".")) : NaN;
  const ref = model.print.referenceSizeEU;
  const scale = Number.isFinite(sizeEU) ? sizeScale(sizeEU, ref) : 1;
  if (!Number.isFinite(sizeEU)) notes.push({ level: "warn", text: `El pedido no tiene talla: piezas a la talla de referencia del modelo (EU ${ref}).` });

  const zones = model.zones.filter((z) => z.texture?.printMm);
  const missing = model.zones.filter((z) => z.texture && !z.texture.printMm);
  if (missing.length) notes.push({ level: "bad", text: `Zonas sin medida física (${missing.map((z) => z.id).join(", ")}): ejecuta npm run model:print-sizes.` });

  const layersOf = (side: ShoeSide, zoneId: string) => doc.layers.filter((l) => l.visible && l.shoe === side && l.zoneId === zoneId);
  const work = SIDES.flatMap((side) => zones.map((zone) => ({ side, zone, layers: layersOf(side, zone.id) }))).filter((w) => w.layers.length);

  // Píxeles necesarios por imagen (para rasterizar SVG al tamaño justo) y calidad efectiva.
  const needed = new Map<string, number>();
  for (const { zone, layers } of work) {
    const W = mm2px(zone.texture!.printMm!.width * scale, dpi), H = mm2px(zone.texture!.printMm!.height * scale, dpi);
    for (const l of layers) {
      if (l.kind !== "image") continue;
      const a = doc.assets[l.assetId];
      if (!a) continue;
      const box = layerBox(l, { width: W, height: H }, croppedSize(a, l));
      needed.set(l.assetId, Math.max(needed.get(l.assetId) ?? 0, box.w / (l.crop?.w ?? 1), box.h / (l.crop?.h ?? 1)));
    }
  }

  say("Cargando geometría del modelo…");
  const uv = await loadUvTriangles(model);
  say("Descargando imágenes a resolución completa…");
  const images = await loadPrintImages(doc, needed);
  await loadFonts(doc.layers);

  const files: Record<string, Uint8Array> = {};
  const pieces: (PieceReport & { canvas: HTMLCanvasElement })[] = [];

  for (const { side, zone, layers } of work) {
    say(`Componiendo ${zone.label} (${SIDE_LABEL[side]})…`);
    const mm = { width: zone.texture!.printMm!.width * scale, height: zone.texture!.printMm!.height * scale };
    const bleedPx = mm2px(bleedMm, dpi);
    // Margen alrededor del lienzo de la zona para que el sangrado no se corte en los bordes.
    const W = mm2px(mm.width, dpi), H = mm2px(mm.height, dpi);
    const tris = uv.get(`${side}:${zone.id}`);
    if (!tris) { notes.push({ level: "bad", text: `No se encontró la malla de ${zone.label} (${SIDE_LABEL[side]}).` }); continue; }

    // Calidad de cada imagen en esta pieza
    for (const l of layers) {
      if (l.opacity < 1) notes.push({ level: "warn", text: `${zone.label} (${SIDE_LABEL[side]}): capa "${l.name}" con opacidad ${Math.round(l.opacity * 100)}%; DTF imprime con base blanca y las transparencias pueden no reproducirse igual.` });
      if (l.kind !== "image") continue;
      const img = images.get(l.assetId);
      const a = doc.assets[l.assetId];
      if (!img || !a) { notes.push({ level: "bad", text: `Imagen "${a?.name ?? l.assetId}" no disponible en el servidor.` }); continue; }
      const src = croppedSize(img, l as ImageLayer);
      const box = layerBox(l, { width: W, height: H }, src);
      const eff = Math.round((src.width / box.w) * dpi);
      const level = eff >= 240 ? "ok" : eff >= 150 ? "warn" : "bad";
      // Subidas del cliente sin original en el servidor (pedidos anteriores a este cambio): avisarlo.
      const reduced = !a.original?.url && !isVector(a) && !a.url?.startsWith("/designs/");
      notes.push({ level, text: `${zone.label} (${SIDE_LABEL[side]}): "${a.name}" a ${px2mm(box.w, dpi)} mm de ancho → ${eff} ppp efectivos${reduced ? " (sin original: versión reducida)" : ""}.` });
    }

    const art = canvas(W + 2 * bleedPx, H + 2 * bleedPx);
    art.ctx.translate(bleedPx, bleedPx);
    // El compositor recorta las capas al área útil; se amplía con el sangrado para que el arte
    // que sale del borde del panel llegue a la película.
    const isl = zone.uvIsland ?? { u0: 0, v0: 0, u1: 1, v1: 1 };
    const bu = bleedPx / W, bv = bleedPx / H;
    composeZone(art.ctx, { width: W, height: H }, {
      baseColor: "rgba(0,0,0,0)",
      layers,
      getImage: (id) => images.get(id),
      resolveFont: resolveCanvasFont,
      uvIsland: { u0: isl.u0 - bu, v0: isl.v0 - bv, u1: isl.u1 + bu, v1: isl.v1 + bv },
    });
    art.ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Recorta el arte a la silueta del panel + sangrado
    const mask = canvas(W + 2 * bleedPx, H + 2 * bleedPx);
    mask.ctx.drawImage(silhouette(tris, W, H, bleedPx), bleedPx, bleedPx);
    art.ctx.globalCompositeOperation = "destination-in";
    art.ctx.drawImage(mask.c, 0, 0);
    art.ctx.globalCompositeOperation = "source-over";

    const box = alphaBounds(art.c);
    if (!box) continue; // capas fuera del panel: nada que imprimir
    const panel = alphaBounds(silhouette(tris, W, H, 0))!;
    const piece = crop(art.c, box);
    const name = `${String(pieces.length + 1).padStart(2, "0")}-${SIDE_LABEL[side]}-${slug(zone.label)}_${px2mm(box.w, dpi)}x${px2mm(box.h, dpi)}mm`;
    const report: PieceReport = {
      file: `imprimir/${name}.png`, side, zoneId: zone.id, zoneLabel: zone.label,
      widthMm: px2mm(box.w, dpi), heightMm: px2mm(box.h, dpi),
      offsetMm: { x: px2mm(box.x - bleedPx - panel.x, dpi), y: px2mm(box.y - bleedPx - panel.y, dpi) },
      panelMm: { width: px2mm(panel.w, dpi), height: px2mm(panel.h, dpi) },
    };
    files[report.file] = await toPng(piece, dpi);

    // Plantilla 1:1 en papel: silueta, sangrado, arte en tenue, regla de 50 mm.
    const margin = mm2px(12, dpi);
    const tpl = canvas(W + 2 * margin, H + 2 * margin + mm2px(14, dpi));
    tpl.ctx.fillStyle = "#fff";
    tpl.ctx.fillRect(0, 0, tpl.c.width, tpl.c.height);
    tpl.ctx.globalAlpha = 0.18;
    tpl.ctx.drawImage(silhouette(tris, W, H, bleedPx, "#2563eb"), margin, margin);
    tpl.ctx.globalAlpha = 1;
    tpl.ctx.drawImage(silhouette(tris, W, H, 0, "#d4d4d4"), margin, margin);
    tpl.ctx.globalAlpha = 0.55;
    tpl.ctx.drawImage(art.c, margin - bleedPx, margin - bleedPx);
    tpl.ctx.globalAlpha = 1;
    tpl.ctx.setLineDash([mm2px(1.5, dpi), mm2px(1, dpi)]);
    tpl.ctx.strokeStyle = "#dc2626";
    tpl.ctx.lineWidth = Math.max(2, dpi / 150);
    tpl.ctx.strokeRect(margin - bleedPx + box.x, margin - bleedPx + box.y, box.w, box.h);
    tpl.ctx.setLineDash([]);
    const y = H + margin * 1.6;
    tpl.ctx.fillStyle = "#171717";
    tpl.ctx.fillRect(margin, y, mm2px(50, dpi), mm2px(1, dpi));
    tpl.ctx.font = `${mm2px(3.2, dpi)}px system-ui, sans-serif`;
    tpl.ctx.textBaseline = "top";
    tpl.ctx.fillText(`50 mm · imprimir al 100 % · Pedido #${order.number} · ${zone.label} pie ${SIDE_LABEL[side]} · EU ${order.size ?? ref}`, margin, y + mm2px(2.5, dpi));
    files[`plantillas/${name}_plantilla.png`] = await toPng(tpl.c, dpi);

    pieces.push({ ...report, canvas: piece });
  }

  // Hoja DTF con todas las piezas
  let sheetFile: string | null = null;
  let sheetMm: { width: number; height: number } | null = null;
  if (pieces.length) {
    say("Montando la hoja DTF…");
    const gap = mm2px(8, dpi);
    const W = mm2px(sheetWidthMm, dpi);
    const { placed, height } = packShelves(pieces.map((p, i) => ({ id: String(i), w: p.canvas.width, h: p.canvas.height })), W, gap);
    const sheet = canvas(W, height);
    for (const p of placed) {
      const src = pieces[+p.id].canvas;
      sheet.ctx.save();
      if (p.rotated) {
        sheet.ctx.translate(p.x + p.h, p.y);
        sheet.ctx.rotate(Math.PI / 2);
      } else sheet.ctx.translate(p.x, p.y);
      sheet.ctx.drawImage(src, 0, 0);
      sheet.ctx.restore();
    }
    sheetMm = { width: sheetWidthMm, height: px2mm(height, dpi) };
    sheetFile = `hoja-dtf_${sheetWidthMm}x${Math.ceil(sheetMm.height)}mm_${dpi}ppp.png`;
    files[sheetFile] = await toPng(sheet.c, dpi);
  } else {
    notes.push({ level: "warn", text: "El diseño no tiene capas impresas: solo colores. No hay nada que enviar a DTF." });
  }

  // Originales
  for (const [id] of needed) {
    const a = doc.assets[id];
    const url = a?.original?.url ?? a?.url;
    if (!a || !url || url.startsWith("blob:")) continue;
    const res = await fetch(url);
    if (!res.ok) continue;
    const ext = (a.original?.mime ?? a.mime).split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") ?? "bin";
    files[`originales/${slug(a.name.replace(/\.[a-z0-9]+$/i, "")) || id}-${id.slice(-6)}.${ext}`] = new Uint8Array(await res.arrayBuffer());
  }

  files["hoja-produccion.html"] = strToU8(productionSheet(doc, model, order, { pieces, notes, sheetFile, sheetMm, scale, dpi, bleedMm, ref }));

  say("Comprimiendo…");
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { level: k.endsWith(".html") ? 6 : 0 }]])));
  return { zip, fileName: `pedido-${order.number}-EU${order.size ?? ref}.zip`, pieces: pieces.length, notes };
}

/* ---------- Hoja de producción (HTML autocontenido) ---------- */

function colorDistance(a: string, b: string): number {
  const rgb = (h: string) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h); return m ? [1, 2, 3].map((i) => parseInt(m[i], 16)) : [0, 0, 0]; };
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function productionSheet(
  doc: DesignDocument, model: ModelConfig, order: OrderInfo,
  r: { pieces: PieceReport[]; notes: QualityNote[]; sheetFile: string | null; sheetMm: { width: number; height: number } | null; scale: number; dpi: number; bleedMm: number; ref: number },
) {
  const zoneRows = model.zones.map((z) => {
    const cell = (side: ShoeSide) => {
      const st = doc.shoes[side].zones[z.id];
      if (!st) return "<td>—</td>";
      // Solo se pinta si el cambio se nota (los blancos casi iguales al de fábrica no cuentan).
      const changed = colorDistance(st.color, z.defaultColor) > 24;
      const mat = st.material ?? z.material;
      const nLayers = doc.layers.filter((l) => l.visible && l.shoe === side && l.zoneId === z.id).length;
      return `<td><span class="sw" style="background:${esc(st.color)}"></span><code>${esc(st.color)}</code>${changed ? ' <b class="tag">pintar</b>' : ""}<br><small>${esc(mat)}${mat !== z.material ? " (cambiado)" : ""}${nLayers ? ` · ${nLayers} capa(s) DTF` : ""}</small></td>`;
    };
    return `<tr><th>${esc(z.label)}</th>${cell("right")}${cell("left")}</tr>`;
  }).join("");

  const texts = doc.layers.filter((l): l is TextLayer => l.kind === "text" && l.visible);
  const textRows = texts.map((t) => `<tr><td>${esc(SIDE_LABEL[t.shoe])}</td><td>${esc(model.zones.find((z) => z.id === t.zoneId)?.label ?? t.zoneId)}</td><td><b>${esc(t.text)}</b></td><td>${esc(t.font)} ${t.weight}${t.italic ? " itálica" : ""}</td><td><span class="sw" style="background:${esc(t.fill)}"></span><code>${esc(t.fill)}</code></td></tr>`).join("");

  const pieceRows = r.pieces.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.zoneLabel)}</td><td>${esc(SIDE_LABEL[p.side])}</td><td>${p.widthMm} × ${p.heightMm} mm</td><td>${p.offsetMm.x}, ${p.offsetMm.y} mm</td><td><img src="${esc(p.file)}" alt=""></td></tr>`).join("");

  const noteItems = r.notes.map((n) => `<li class="${n.level}">${esc(n.text)}</li>`).join("") || '<li class="ok">Sin observaciones.</li>';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Pedido #${order.number} — producción</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;color:#171717;max-width:960px;margin:32px auto;padding:0 16px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid #e5e5e5;padding-bottom:4px}
table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:6px 8px;border-bottom:1px solid #f0f0f0}
.sw{display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid #0002;vertical-align:-2px;margin-right:6px}
.tag{font-size:11px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:9px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.grid div{background:#f5f5f4;border-radius:8px;padding:8px}.grid b{display:block;font-size:18px}
td img{max-width:140px;max-height:70px;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/12px 12px}
li.ok{color:#166534}li.warn{color:#92400e}li.bad{color:#b91c1c;font-weight:600}
.sheet{max-width:100%;border:1px solid #e5e5e5;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px}
ol li{margin:4px 0}small{color:#737373}
@media print{body{margin:0}h2{break-after:avoid}}
</style></head><body>
<h1>Pedido #${order.number}</h1>
<div>${esc(model.name)} · ${esc(doc.name)}${order.customer ? ` · ${esc(order.customer)}` : ""}</div>
<div class="grid" style="margin-top:16px">
<div><small>Talla</small><b>EU ${esc(order.size ?? "—")}</b></div>
<div><small>Escala piezas</small><b>${(r.scale * 100).toFixed(1)} %</b><small>ref. EU ${r.ref}</small></div>
<div><small>Piezas DTF</small><b>${r.pieces.length}</b></div>
<div><small>Hoja DTF</small><b>${r.sheetMm ? `${r.sheetMm.width} × ${Math.ceil(r.sheetMm.height)} mm` : "—"}</b></div>
</div>
${order.extras.length ? `<p><b>Extras:</b> ${order.extras.map(esc).join(" · ")}</p>` : ""}
${order.notes ? `<p><b>Notas del cliente:</b> ${esc(order.notes)}</p>` : ""}

<h2>Revisión de calidad</h2><ul>${noteItems}</ul>

<h2>Colores y materiales por zona</h2>
<p><small>Las zonas marcadas «pintar» cambian de color respecto al zapato base: se pintan antes de aplicar el DTF.</small></p>
<table><tr><th>Zona</th><th>Pie derecho</th><th>Pie izquierdo</th></tr>${zoneRows}</table>

${texts.length ? `<h2>Textos</h2><table><tr><th>Pie</th><th>Zona</th><th>Texto</th><th>Fuente</th><th>Color</th></tr>${textRows}</table>` : ""}

<h2>Piezas a imprimir (${r.dpi} ppp, sangrado ${r.bleedMm} mm)</h2>
<p><small>Posición = esquina del arte respecto a la esquina superior izquierda del panel (ver la plantilla de cada pieza en <code>plantillas/</code>).</small></p>
<table><tr><th>#</th><th>Zona</th><th>Pie</th><th>Tamaño</th><th>Posición</th><th>Arte</th></tr>${pieceRows || '<tr><td colspan="6">—</td></tr>'}</table>
${r.sheetFile ? `<h2>Hoja DTF</h2><p><code>${esc(r.sheetFile)}</code>: envíala tal cual al proveedor DTF (PNG transparente, ${r.dpi} ppp, sin espejar; el proveedor la espeja si su proceso lo requiere).</p><img class="sheet" src="${esc(r.sheetFile)}" alt="Hoja DTF">` : ""}

<h2>Proceso</h2>
<ol>
<li>Imprime las plantillas al 100 % y comprueba la escala con la regla de 50 mm y contra el zapato real.</li>
<li>Limpia y desengrasa las zonas (deglazer / acetona en cuero; no en sintéticos sensibles).</li>
<li>Pinta las zonas marcadas «pintar» y deja curar.</li>
<li>Recorta cada pieza de la película DTF con 1–2 mm de margen y colócala guiándote por la plantilla.</li>
<li>Prensa con almohadilla para calzado a la temperatura, tiempo y presión que indique el proveedor de la película; retira en frío o caliente según su ficha.</li>
<li>Aplica el acabado (${esc(order.extras.find((e) => /acabado/i.test(e)) ?? "si se pidió")}) y deja curar 24 h.</li>
</ol>
<p><small>Generado ${esc(new Date().toLocaleString("es"))}. Medidas desde el modelo 3D escalado a la talla; valida con la plantilla antes de prensar.</small></p>
</body></html>`;
}

/**
 * Exportación de vistas múltiples: recorre las vistas de cámara, captura cada una con el motor
 * real y compone una hoja de producto (PNG) además de las capturas individuales.
 */
import { useEditor, type CameraView } from "@/lib/editor/store";
import { sceneBridge } from "@/components/viewer/interaction";

export const EXPORT_VIEWS: { id: CameraView; label: string }[] = [
  { id: "threeQuarter", label: "Perspectiva 3/4" },
  { id: "outer", label: "Lateral exterior" },
  { id: "inner", label: "Lateral interior" },
  { id: "top", label: "Superior" },
  { id: "back", label: "Posterior" },
  { id: "both", label: "Ambos zapatos" },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function load(url: string) {
  return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
}

export interface ExportedView { id: CameraView; label: string; dataUrl: string }

/** Captura las vistas indicadas y restaura la cámara original. */
export async function captureViews(views: CameraView[] = EXPORT_VIEWS.map((v) => v.id), onProgress?: (i: number, total: number) => void): Promise<ExportedView[]> {
  if (!sceneBridge.capture) throw new Error("Visor no listo");
  const editor = useEditor.getState();
  const prev = { view: editor.cameraView, shoe: editor.activeShoe, hidden: editor.controlsHidden };
  const out: ExportedView[] = [];
  try {
    for (let i = 0; i < views.length; i++) {
      const id = views[i];
      onProgress?.(i, views.length);
      useEditor.getState().setCameraView(id);
      await wait(700); // transición de cámara (smoothTime 0.4 s)
      const dataUrl = await sceneBridge.capture();
      out.push({ id, label: EXPORT_VIEWS.find((v) => v.id === id)?.label ?? id, dataUrl });
    }
  } finally {
    useEditor.getState().setCameraView(prev.view);
  }
  return out;
}

/** Compone una hoja: vista principal grande + miniaturas, con nombre del diseño. */
export async function composeSheet(views: ExportedView[], title: string): Promise<string> {
  const imgs = await Promise.all(views.map((v) => load(v.dataUrl)));
  const W = 2400, pad = 48, heroH = 1200;
  const thumbW = (W - pad * (views.length)) / Math.max(1, views.length - 1);
  const thumbH = Math.round(thumbW * 0.75);
  const H = pad + 90 + heroH + pad + thumbH + pad;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f4f3f0"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#171717"; ctx.font = "600 44px system-ui, sans-serif"; ctx.fillText(title, pad, pad + 48);
  ctx.fillStyle = "#8a8a8a"; ctx.font = "400 24px system-ui, sans-serif"; ctx.fillText(`Hecho a Pie · ${new Date().toLocaleDateString("es-EC")}`, pad, pad + 84);
  const drawCover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const k = Math.max(w / img.width, h / img.height);
    const sw = w / k, sh = h / k;
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.clip();
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
    ctx.restore();
  };
  drawCover(imgs[0], pad, pad + 100, W - pad * 2, heroH);
  let x = pad;
  const y = pad + 100 + heroH + pad;
  for (let i = 1; i < imgs.length; i++) {
    drawCover(imgs[i], x, y, thumbW, thumbH);
    ctx.fillStyle = "#555"; ctx.font = "500 22px system-ui, sans-serif"; ctx.fillText(views[i].label, x + 12, y + thumbH - 14);
    x += thumbW + pad;
  }
  return c.toDataURL("image/png");
}

export function download(dataUrl: string, name: string) {
  const a = document.createElement("a");
  a.href = dataUrl; a.download = name; a.click();
}

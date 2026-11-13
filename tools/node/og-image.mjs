/**
 * Genera public/og.jpg (1200×630), la imagen al compartir en redes y en el JSON-LD.
 *   node tools/node/og-image.mjs [--design great-wave]
 */
import sharp from "sharp";

const id = process.argv.includes("--design") ? process.argv[process.argv.indexOf("--design") + 1] : "great-wave";
const W = 1200, H = 630, BG = "#f4f3f0";

// Panel derecho redondeado del color de fondo de las miniaturas; la zapatilla entera dentro.
const PANEL = { x: 600, y: 32, w: 568, h: 566 };
const src = sharp(`public/designs/thumbs/${id}/hero.jpg`);
// Color de fondo del render (esquina): el panel lo usa para que el recorte no se note.
const { data: px } = await src.clone().extract({ left: 4, top: 4, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
const bg = `rgb(${px[0]},${px[1]},${px[2]})`;
const panel = Buffer.from(`<svg width="${PANEL.w}" height="${PANEL.h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="32" fill="${bg}"/></svg>`);
const shoe = await src.clone()
  .extract({ left: 160, top: 110, width: 720, height: 540 }) // encuadre del zapato en el render 1000×750
  .resize({ width: 540 })
  .toBuffer();

const text = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .t { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; fill: #171717; }
  </style>
  <rect x="64" y="64" width="52" height="52" rx="12" fill="#171717"/>
  <text x="90" y="98" text-anchor="middle" class="t" style="fill:#fff;font-size:19px;font-weight:700">HP</text>
  <text x="132" y="100" class="t" style="font-size:28px;font-weight:600">Hecho a Pie</text>
  <text x="64" y="300" class="t" style="font-size:66px;font-weight:700;letter-spacing:-2px">Tus zapatillas,</text>
  <text x="64" y="374" class="t" style="font-size:66px;font-weight:700;letter-spacing:-2px;fill:#a3a3a3">hechas a tu pie.</text>
  <text x="64" y="452" class="t" style="font-size:25px;fill:#525252">Zapatillas personalizadas, diseñadas en 3D</text>
  <rect x="64" y="510" width="246" height="56" rx="28" fill="#171717"/>
  <text x="187" y="546" text-anchor="middle" class="t" style="fill:#fff;font-size:21px;font-weight:600">Diseña las tuyas →</text>
</svg>`);

await sharp({ create: { width: W, height: H, channels: 3, background: BG } })
  .composite([
    { input: panel, left: PANEL.x, top: PANEL.y },
    { input: shoe, left: PANEL.x + 14, top: PANEL.y + 80 },
    { input: text, left: 0, top: 0 },
  ])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile("public/og.jpg");
console.log("public/og.jpg");

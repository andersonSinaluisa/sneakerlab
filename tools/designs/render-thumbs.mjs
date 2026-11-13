/**
 * Genera las miniaturas y vistas previas del catálogo renderizando el modelo 3D real.
 *
 *   npm run build && npm run start -- -p 3100   (en otra terminal)
 *   node tools/designs/render-thumbs.mjs [--base http://localhost:3100] [--only id,id] [--views hero,outer,inner,back,both]
 *
 * Requiere Chrome/Chromium local. Escribe public/designs/thumbs/<preset>/<view>.jpg.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1] ?? "true"]] : acc), []));
const base = args.base ?? "http://localhost:3100";
const views = (args.views ?? "hero,outer,inner,back,both").split(",");
const only = args.only ? new Set(args.only.split(",")) : null;

let puppeteer;
try {
  puppeteer = (await import("puppeteer-core")).default;
} catch {
  console.error("Instala puppeteer-core: npm i -D puppeteer-core");
  process.exit(2);
}
const chrome = args.chrome ?? ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => existsSync(p));
if (!chrome) { console.error("No se encontró Chrome; pasa --chrome <ruta>"); process.exit(2); }

// Lista de presets desde el módulo TS compilado no es trivial en Node: la pedimos a la página.
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-proxy-server"] });
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 750 });
page.on("pageerror", (e) => console.error("[page]", e.message));
await page.goto(`${base}/studio/render`, { waitUntil: "load" });
await page.waitForFunction("window.__sneakerlabReady === true", { timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000)); // carga del modelo

const list = JSON.parse(execSync("node tools/designs/list-presets.mjs", { encoding: "utf8" }));
const targets = list.filter((p) => !only || only.has(p.id));
console.log(`${targets.length} presets × ${views.length} vistas`);

for (const p of targets) {
  const dir = resolve("public/designs/thumbs", p.id);
  mkdirSync(dir, { recursive: true });
  for (const v of views) {
    const t0 = Date.now();
    const dataUrl = await page.evaluate((id, view) => window.__sneakerlabRender(id, view), p.id, v);
    const png = Buffer.from(dataUrl.split(",")[1], "base64");
    // Recorte 4:3 centrado y conversión a JPEG con sharp si está disponible; si no, PNG.
    let out = png, ext = "png";
    try {
      const sharp = (await import("sharp")).default;
      out = await sharp(png).resize(1000, 750, { fit: "cover" }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
      ext = "jpg";
    } catch { /* sin sharp */ }
    writeFileSync(resolve(dir, `${v}.${ext}`), out);
    console.log(`  ${p.id}/${v}.${ext} (${Date.now() - t0} ms)`);
  }
}
await browser.close();

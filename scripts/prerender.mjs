/**
 * SEO de la SPA, tras `vite build`:
 *  - dist/index.html → landing (`/`) prerenderizada: el HTML llega con contenido, canonical,
 *    Open Graph absoluto y JSON-LD (Organization, WebSite, FAQPage). El navegador la hidrata.
 *  - dist/app.html   → shell vacío con noindex para el resto de rutas (editor, pedidos, admin);
 *    el .htaccess de Hostinger envía ahí el fallback de la SPA.
 *  - dist/robots.txt y dist/sitemap.xml.
 *
 * El dominio público sale de SITE_URL (variable de entorno o .env.production / .env).
 * Sin él se genera todo menos las URLs absolutas y el sitemap (con aviso).
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, loadEnv } from "vite";

const dist = resolve("dist");
const ssrOut = resolve("node_modules/.cache/prerender");
const site = (process.env.SITE_URL ?? loadEnv("production", process.cwd(), "").SITE_URL ?? "").replace(/\/+$/, "");
if (!site) console.warn("⚠ SITE_URL no definido (p. ej. SITE_URL=https://hechoapie.com en .env.production): sin canonical, og:url ni sitemap.");

await build({
  configFile: resolve("vite.config.ts"),
  logLevel: "warn",
  build: { ssr: "src/prerender.tsx", outDir: ssrOut, emptyOutDir: true, copyPublicDir: false, minify: false },
});
const { render, SEO, FAQ, BRAND } = await import(pathToFileURL(resolve(ssrOut, "prerender.mjs")).href);

const template = readFileSync(resolve(dist, "index.html"), "utf8");
if (!template.includes("<!--app-html-->") || !template.includes("<!--seo-head")) throw new Error("index.html sin los marcadores <!--app-html--> / <!--seo-head-->");

const abs = (p) => (site ? site + p : p);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\u003c")}</script>`;

// ── Shell para las demás rutas: mismo build, sin contenido, fuera del índice.
const shell = template
  .replace(/<!--seo-head[^>]*-->/, '<meta name="robots" content="noindex, nofollow" />')
  .replace("<!--app-html-->", "");
writeFileSync(resolve(dist, "app.html"), shell);

// ── Landing prerenderizada.
const appHtml = await render("/");
const head = [
  site && `<link rel="canonical" href="${site}/" />`,
  site && `<meta property="og:url" content="${site}/" />`,
  jsonLd({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": abs("/#org"), name: BRAND, ...(site && { url: `${site}/`, logo: `${site}/og.jpg` }) },
      { "@type": "WebSite", "@id": abs("/#web"), name: BRAND, inLanguage: "es", description: SEO.home.description, ...(site && { url: `${site}/` }), publisher: { "@id": abs("/#org") } },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  }),
].filter(Boolean).join("\n    ");

let page = template.replace(/<!--seo-head[^>]*-->/, head).replace("<!--app-html-->", appHtml);
if (site) page = page.replace('content="/og.jpg"', `content="${esc(abs("/og.jpg"))}"`);
writeFileSync(resolve(dist, "index.html"), page);

// ── robots.txt y sitemap.xml
writeFileSync(
  resolve(dist, "robots.txt"),
  ["User-agent: *", "Disallow: /admin/", "Disallow: /orders", "Disallow: /studio/", "Disallow: /api/", "Disallow: /uploads/", site && `\nSitemap: ${site}/sitemap.xml`, ""]
    .filter((l) => l !== false && l !== "").join("\n") + "\n",
);
if (site) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [{ loc: "/", priority: "1.0" }]; // el resto de rutas son app (noindex)
  writeFileSync(
    resolve(dist, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${site}${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`)
      .join("\n")}\n</urlset>\n`,
  );
}

rmSync(ssrOut, { recursive: true, force: true });
console.log(`Prerender: index.html (${(page.length / 1024).toFixed(1)} KB), app.html, robots.txt${site ? ", sitemap.xml" : ""}`);

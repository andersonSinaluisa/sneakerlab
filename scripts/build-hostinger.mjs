/**
 * Empaqueta el despliegue para hosting compartido (Hostinger):
 *   deploy/public_html/    → contenido de public_html (SPA + .htaccess + api/index.php)
 *   deploy/sneakerlab-api/ → API PHP (sube junto a public_html, NO dentro)
 *   deploy/sneakerlab-hostinger.zip (si el sistema tiene tar con soporte zip o `zip`)
 *
 *   npm run build:hostinger
 * Requiere api/vendor (composer install --no-dev); con Docker se instala solo.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const out = "deploy";

run("npm run build");

if (!existsSync("api/vendor/autoload.php")) {
  console.log("api/vendor no existe: instalando dependencias PHP con Docker (composer:2)…");
  run("node scripts/api-install.mjs --no-dev --optimize-autoloader");
}

rmSync(out, { recursive: true, force: true });
const pub = join(out, "public_html");
const api = join(out, "sneakerlab-api");
mkdirSync(pub, { recursive: true });
cpSync("dist", pub, { recursive: true });
cpSync("hosting/public_html", pub, { recursive: true });

for (const p of ["src", "public", "bin", "migrations", "contracts", "vendor", "composer.json", "composer.lock", ".env.example"]) {
  if (existsSync(join("api", p))) cpSync(join("api", p), join(api, p), { recursive: true });
}
mkdirSync(join(api, "storage", "uploads"), { recursive: true });
cpSync("hosting/deny.htaccess", join(api, ".htaccess"));

try {
  const zip = "sneakerlab-hostinger.zip";
  if (process.platform === "win32") run(`tar -a -c -f ${zip} public_html sneakerlab-api`, { cwd: out });
  else run(`zip -qr ${zip} public_html sneakerlab-api`, { cwd: out });
  console.log(`\nListo: ${out}/${zip}`);
} catch {
  console.log(`\nListo: ${out}/ (comprime public_html y sneakerlab-api para subirlos)`);
}
console.log("Siguiente paso: docs/DESPLIEGUE-HOSTINGER.md");

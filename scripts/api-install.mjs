/** Instala las dependencias PHP de api/ con Composer en Docker (no hace falta PHP local). */
import { execSync } from "node:child_process";

const args = process.argv.slice(2).join(" ");
execSync(`docker run --rm -v "${process.cwd()}/api:/app" -w /app composer:2 install --no-interaction --ignore-platform-req=ext-pdo ${args}`, {
  stdio: "inherit",
  env: { ...process.env, MSYS_NO_PATHCONV: "1" },
});

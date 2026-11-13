/**
 * Levanta el API PHP + MySQL efímeros en Docker (réplica del hosting), aplica migraciones y semilla,
 * ejecuta la prueba de paridad del motor de precios y las pruebas de contrato HTTP, y lo destruye.
 *   npm run test:api
 */
import { execSync } from "node:child_process";

const compose = "docker compose -p sneakerlab-test -f docker-compose.yml -f hosting/docker-compose.test.yml";
const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
let code = 0;
try {
  run(`${compose} up -d --build --wait`);
  run(`${compose} exec -T web php /srv/site/sneakerlab-api/bin/migrate.php`);
  run(`${compose} exec -T web php /srv/site/sneakerlab-api/tests/pricing_test.php`);
  run("npx vitest run tests/api", { env: { ...process.env, API_TEST_URL: "http://localhost:8090" } });
} catch {
  code = 1;
} finally {
  if (!process.argv.includes("--keep")) run(`${compose} down -v`);
}
process.exit(code);

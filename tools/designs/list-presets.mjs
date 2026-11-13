/** Imprime en JSON los presets integrados (id, name, status) para herramientas externas. */
import { execFileSync } from "node:child_process";
const out = execFileSync("npx", ["tsx", "-e", `import { BUILTIN_PRESETS } from "./src/lib/designs/catalog"; console.log(JSON.stringify(BUILTIN_PRESETS.map((p) => ({ id: p.id, name: p.name, status: p.status, category: p.category }))));`], { encoding: "utf8" });
process.stdout.write(out);

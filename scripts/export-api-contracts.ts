/**
 * Exporta al API PHP los contratos que define el frontend, para que ambos validen igual:
 *  - document.schema.json  → DesignDocument (zod documentSchema)
 *  - preset-body.schema.json → cuerpo de POST/PUT /api/admin/presets
 *  - catalog.json          → modelos (zonas), materiales y categorías
 * Ejecutar tras cambiar esquemas, manifiestos de modelos o materiales: `npm run api:contracts`.
 */
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { documentSchema } from "@/lib/editor/documentSchema";
import { designPresetSchema, DESIGN_CATEGORIES, CATEGORY_GROUPS } from "@/lib/designs/schema";
import { listModels } from "@/lib/model/registry";
import { MATERIAL_PRESETS_LIST } from "@/lib/materials/presets";

const out = "api/contracts";
const write = (file: string, data: unknown) => writeFileSync(`${out}/${file}`, JSON.stringify(data, null, 2) + "\n");
const toSchema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input", target: "draft-2020-12" });

const presetBody = designPresetSchema
  .omit({ id: true, source: true, createdAt: true, updatedAt: true })
  .extend({ id: z.string().regex(/^[a-z0-9-]+$/).optional() });

write("document.schema.json", toSchema(documentSchema));
write("preset-body.schema.json", toSchema(presetBody));
write("catalog.json", {
  models: listModels().map((m) => ({
    modelId: m.modelId, name: m.name, version: m.version, provisional: m.provisional,
    zones: m.zones.map((z) => ({ id: z.id, label: z.label, material: z.material, materialOptions: z.materialOptions, allowImages: z.allowImages, allowText: z.allowText, defaultColor: z.defaultColor })),
  })),
  materials: MATERIAL_PRESETS_LIST.map((m) => ({ id: m.id, label: m.label, priceFactor: m.priceFactor })),
  categories: DESIGN_CATEGORIES,
  groups: CATEGORY_GROUPS,
});
console.log(`Contratos escritos en ${out}/`);

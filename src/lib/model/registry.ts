/**
 * Catálogo de modelos. En la Fase 3 este módulo pedirá la lista al backend
 * (GET /api/catalog/models); la interfaz pública no cambia.
 */
import { parseModelConfig, type ModelConfig, type ZoneConfig } from "./schema";
import courtLow01 from "@/config/models/court-low-01.json";
import courtClassic01 from "@/config/models/court-classic-01.json";
import sneakerLow01 from "@/config/models/sneaker-low-01.json";

// El primero es el modelo por defecto. El provisional se conserva como referencia de desarrollo.
const MODELS: ModelConfig[] = [parseModelConfig(courtLow01), parseModelConfig(courtClassic01), parseModelConfig(sneakerLow01)];

export const DEFAULT_MODEL_ID = MODELS[0].modelId;

export function listModels(): ModelConfig[] {
  return MODELS;
}

export function getModel(modelId: string): ModelConfig {
  const model = MODELS.find((m) => m.modelId === modelId);
  if (!model) throw new Error(`Modelo no encontrado: ${modelId}`);
  return model;
}

export function getZone(model: ModelConfig, zoneId: string): ZoneConfig | undefined {
  return model.zones.find((z) => z.id === zoneId);
}

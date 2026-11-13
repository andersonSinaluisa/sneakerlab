import { Badge, PanelSection } from "@/components/ui/field";
import type { ToolDef } from "../tools";

const DESCRIPTIONS: Record<string, string> = {
  ai: "Generación de ilustraciones originales a partir de una descripción, con variantes listas para aplicar o para crear nuevos presets del Design Studio. No hay proveedor de IA configurado: los diseños actuales usan ilustraciones vectoriales originales.",
};

export function ComingSoonPanel({ tool }: { tool: ToolDef }) {
  return (
    <PanelSection title={tool.label}>
      <Badge tone="blue">Fase {tool.phase}</Badge>
      <p className="text-xs leading-relaxed text-neutral-500">{DESCRIPTIONS[tool.id]}</p>
      <p className="text-[11px] text-neutral-400">
        La arquitectura ya contempla esta herramienta; se habilitará en la fase indicada del roadmap.
      </p>
    </PanelSection>
  );
}

import { useEditor } from "@/lib/editor/store";
import { TOOLS } from "./tools";
import { ColorsPanel } from "./panels/ColorsPanel";
import { ImagesPanel } from "./panels/ImagesPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { ModelsPanel } from "./panels/ModelsPanel";
import { MaterialsPanel } from "./panels/MaterialsPanel";
import { ComingSoonPanel } from "./panels/ComingSoonPanel";
import { DesignsPanel } from "./panels/DesignsPanel";
import { TextPanel } from "./panels/TextPanel";
import { PatternsPanel } from "./panels/PatternsPanel";

export function ToolPanelContent() {
  const active = useEditor((s) => s.activeTool);
  const tool = TOOLS.find((t) => t.id === active)!;
  if (tool.phase) return <ComingSoonPanel tool={tool} />;
  switch (active) {
    case "designs":
      return <DesignsPanel />;
    case "models":
      return <ModelsPanel />;
    case "colors":
      return <ColorsPanel />;
    case "materials":
      return <MaterialsPanel />;
    case "images":
      return <ImagesPanel />;
    case "text":
      return <TextPanel />;
    case "patterns":
      return <PatternsPanel />;
    case "layers":
      return <LayersPanel />;
    default:
      return null;
  }
}

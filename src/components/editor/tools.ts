import {
  Box,
  LayoutGrid,
  Droplet,
  Image as ImageIcon,
  Layers,
  Palette,
  Shapes,
  Sparkles,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { ToolCategory } from "@/lib/editor/store";

export interface ToolDef {
  id: ToolCategory;
  label: string;
  icon: LucideIcon;
  /** Fase del roadmap en la que se habilita; undefined = disponible. */
  phase?: number;
}

export const TOOLS: ToolDef[] = [
  { id: "designs", label: "Diseños", icon: LayoutGrid },
  { id: "models", label: "Modelos", icon: Box },
  { id: "colors", label: "Colores", icon: Palette },
  { id: "materials", label: "Materiales", icon: Droplet },
  { id: "images", label: "Imágenes", icon: ImageIcon },
  { id: "text", label: "Textos", icon: Type },
  { id: "patterns", label: "Patrones", icon: Shapes },
  { id: "layers", label: "Capas", icon: Layers },
  { id: "ai", label: "IA", icon: Sparkles, phase: 4 },
];

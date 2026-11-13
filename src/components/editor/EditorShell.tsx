import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SlidersHorizontal, X } from "lucide-react";
import { Toaster } from "sonner";
import { useEditor } from "@/lib/editor/store";
import { TooltipProvider, Tip } from "@/components/ui/tooltip";
import { Viewer } from "@/components/viewer/Viewer";
import { DesignStudio } from "@/components/designs/DesignStudio";
import { cn } from "@/lib/utils/cn";
import { TopBar } from "./TopBar";
import { ToolPanelContent } from "./ToolPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { ViewControls } from "./ViewControls";
import { PricePanel } from "@/components/pricing/PricePanel";
import { TOOLS } from "./tools";
import { useAutosave, useShortcuts } from "./hooks";

type MobileSheet = "tools" | "properties" | null;

declare global {
  interface Window { __sneakerlab?: { editor: typeof useEditor } }
}

export default function EditorShell() {
  useAutosave();
  useShortcuts();
  // Gancho para pruebas E2E y depuración (no expone nada que la UI no permita hacer).
  useEffect(() => { window.__sneakerlab = { editor: useEditor }; }, []);
  const active = useEditor((s) => s.activeTool);
  const zoneId = useEditor((s) => s.selectedZoneId);
  const [sheet, setSheet] = useState<MobileSheet>(null);
  const s = useEditor.getState;

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col bg-[#f4f3f0] text-neutral-900">
        <TopBar />
        <div className="relative flex min-h-0 flex-1">
          <DesignStudio />
          {/* Riel de herramientas (escritorio) */}
          <nav className="hidden w-[72px] shrink-0 flex-col items-center gap-1 border-r border-neutral-200/80 bg-white py-3 lg:flex">
            {TOOLS.map((t) => (
              <Tip key={t.id} label={t.phase ? `${t.label} · Fase ${t.phase}` : t.label} side="right">
                <button
                  type="button"
                  onClick={() => s().setActiveTool(t.id)}
                  className={cn(
                    "flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-colors",
                    active === t.id ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                    t.phase && active !== t.id && "opacity-50",
                  )}
                >
                  <t.icon className="size-[18px]" strokeWidth={1.75} />
                  {t.label}
                </button>
              </Tip>
            ))}
          </nav>

          {/* Panel de herramienta (escritorio) */}
          <aside className="hidden w-[288px] shrink-0 overflow-y-auto border-r border-neutral-200/80 bg-white lg:block">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="divide-y divide-neutral-100"
              >
                <ToolPanelContent />
              </motion.div>
            </AnimatePresence>
          </aside>

          {/* Columna central: visor + (móvil) hoja y barra inferior */}
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="relative min-h-0 flex-1">
              <Viewer />
              <div className="pointer-events-none absolute inset-0">
                <ViewControls />
                <PricePanel className="absolute bottom-3 right-3 hidden lg:block" />
              </div>
            </main>

            {/* Móvil: hoja inferior (reduce el visor para que el zapato siga visible) */}
            <AnimatePresence initial={false}>
              {sheet && (
                <motion.div
                  key="sheet"
                  initial={{ height: 0 }}
                  animate={{ height: "46dvh" }}
                  exit={{ height: 0 }}
                  transition={{ type: "spring", damping: 34, stiffness: 300 }}
                  className="shrink-0 overflow-hidden rounded-t-2xl border-t border-neutral-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.06)] lg:hidden"
                >
                  <div className="h-full overflow-y-auto">
                    <div className="sticky top-0 z-10 flex items-center bg-white/95 px-4 pb-1 pt-3 backdrop-blur">
                      <div className="mx-auto h-1 w-10 rounded-full bg-neutral-200" />
                      <button type="button" onClick={() => setSheet(null)} className="absolute right-3 top-2 rounded-full p-1 text-neutral-500" aria-label="Cerrar panel">
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="divide-y divide-neutral-100 pb-2">
                      {sheet === "tools" ? <ToolPanelContent /> : (<><div className="px-4 pt-2"><PricePanel className="w-full shadow-none" /></div><PropertiesPanel /></>)}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Móvil: barra inferior de herramientas */}
            <nav className="flex h-16 shrink-0 items-center gap-1 overflow-x-auto border-t border-neutral-200 bg-white px-2 lg:hidden">
              <button
                type="button"
                disabled={!zoneId}
                onClick={() => setSheet(sheet === "properties" ? null : "properties")}
                className={cn(
                  "flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium",
                  sheet === "properties" ? "bg-neutral-900 text-white" : "text-neutral-600",
                  !zoneId && "opacity-40",
                )}
              >
                <SlidersHorizontal className="size-[18px]" strokeWidth={1.75} />
                Ajustar
              </button>
              <div className="h-8 w-px shrink-0 bg-neutral-200" />
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    s().setActiveTool(t.id);
                    setSheet(sheet === "tools" && active === t.id ? null : "tools");
                  }}
                  className={cn(
                    "flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium",
                    sheet === "tools" && active === t.id ? "bg-neutral-900 text-white" : "text-neutral-600",
                    t.phase && "opacity-50",
                  )}
                >
                  <t.icon className="size-[18px]" strokeWidth={1.75} />
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Propiedades (escritorio) */}
          <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-neutral-200/80 bg-white lg:block">
            <div className="divide-y divide-neutral-100">
              <PropertiesPanel />
            </div>
          </aside>

        </div>
      </div>
      <Toaster position="top-center" richColors closeButton />
    </TooltipProvider>
  );
}

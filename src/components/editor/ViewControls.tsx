import { Eye, EyeOff, Gauge, RotateCcw, SunMoon } from "lucide-react";
import { useEditor, useModel, type CameraView } from "@/lib/editor/store";
import { getZone } from "@/lib/model/registry";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

const VIEWS: { id: CameraView; label: string; short: string }[] = [
  { id: "outer", label: "Lateral exterior", short: "Ext." },
  { id: "inner", label: "Lateral interior", short: "Int." },
  { id: "top", label: "Superior", short: "Sup." },
  { id: "back", label: "Posterior", short: "Post." },
  { id: "front", label: "Frontal", short: "Front." },
  { id: "threeQuarter", label: "Perspectiva 3/4", short: "3/4" },
  { id: "both", label: "Ambos zapatos", short: "Ambos" },
];

export function ViewControls() {
  const view = useEditor((s) => s.cameraView);
  const hidden = useEditor((s) => s.controlsHidden);
  const shoe = useEditor((s) => s.activeShoe);
  const bg = useEditor((s) => s.background);
  const quality = useEditor((s) => s.quality);
  const resolved = useEditor((s) => s.resolvedQuality);
  const QUALITY_LABEL = { low: "Baja", medium: "Media", high: "Alta" } as const;
  const zoneId = useEditor((s) => s.selectedZoneId);
  const model = useModel();
  const zone = zoneId ? getZone(model, zoneId) : undefined;
  const s = useEditor.getState;

  return (
    <>
      {/* Superior izquierda: zapato activo + zona */}
      {!hidden && (
        <div className="pointer-events-auto absolute left-3 top-3 flex items-center gap-2">
          <div className="flex rounded-full border border-neutral-200 bg-white/90 p-0.5 shadow-sm backdrop-blur">
            {(["left", "right"] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => {
                  s().setActiveShoe(side);
                  if (view === "both") s().setCameraView("outer");
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  shoe === side ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900",
                )}
              >
                {model.shoes[side].label}
              </button>
            ))}
          </div>
          {zone && (
            <div className="hidden rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-xs text-neutral-600 shadow-sm backdrop-blur sm:block">
              {zone.label}
            </div>
          )}
        </div>
      )}

      {/* Superior derecha: utilidades de cámara */}
      <div className="pointer-events-auto absolute right-3 top-3 flex gap-1">
        {!hidden && (
          <>
            <Tip label="Restaurar cámara" side="left">
              <Button variant="outline" size="icon-sm" className="rounded-full bg-white/90 backdrop-blur" onClick={() => s().resetCamera()} aria-label="Restaurar cámara">
                <RotateCcw />
              </Button>
            </Tip>
            <Tip label={`Calidad: ${quality === "auto" ? `Auto (${QUALITY_LABEL[resolved]})` : QUALITY_LABEL[resolved]}`} side="left">
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full bg-white/90 backdrop-blur"
                onClick={() => s().setQuality(quality === "auto" ? "low" : quality === "low" ? "medium" : quality === "medium" ? "high" : "auto")}
                aria-label="Calidad de renderizado"
              >
                <Gauge />
              </Button>
            </Tip>
            <Tip label="Cambiar fondo" side="left">
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full bg-white/90 backdrop-blur"
                onClick={() => s().setBackground(bg === "studio" ? "white" : bg === "white" ? "dark" : "studio")}
                aria-label="Cambiar fondo"
              >
                <SunMoon />
              </Button>
            </Tip>
          </>
        )}
        <Tip label={hidden ? "Mostrar controles" : "Ocultar controles"} side="left">
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full bg-white/90 backdrop-blur"
            onClick={() => s().setControlsHidden(!hidden)}
            aria-label={hidden ? "Mostrar controles" : "Ocultar controles"}
          >
            {hidden ? <Eye /> : <EyeOff />}
          </Button>
        </Tip>
      </div>

      {/* Inferior: vistas predefinidas */}
      {!hidden && (
        <div className="pointer-events-auto absolute bottom-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-0.5 overflow-x-auto rounded-full border border-neutral-200 bg-white/90 p-1 shadow-sm backdrop-blur">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => s().setCameraView(v.id)}
              title={v.label}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                view === v.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100",
              )}
            >
              <span className="hidden 2xl:inline">{v.label}</span>
              <span className="2xl:hidden">{v.short}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

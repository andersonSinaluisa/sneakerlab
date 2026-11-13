import { useState } from "react";
import { Type } from "lucide-react";
import { useEditor, useModel } from "@/lib/editor/store";
import { getZone } from "@/lib/model/registry";
import { PanelSection } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { FONT_OPTIONS, resolveCanvasFont } from "../fonts";
import { cn } from "@/lib/utils/cn";

const SUGGESTIONS = ["SNKR LAB", "夢", "RONIN", "No. 01", "NEÓN", "力"];

export function TextPanel() {
  const model = useModel();
  const zoneId = useEditor((s) => s.selectedZoneId);
  const shoe = useEditor((s) => s.activeShoe);
  const zone = zoneId ? getZone(model, zoneId) : undefined;
  const can = Boolean(zone?.allowText);
  const [text, setText] = useState("");
  const textZones = model.zones.filter((z) => z.allowText);
  const s = useEditor.getState;

  return (
    <>
      <PanelSection title="Zona">
        <div className="flex flex-wrap gap-1.5">
          {textZones.map((z) => (
            <button key={z.id} type="button" onClick={() => s().selectZone(z.id)} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", z.id === zoneId ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400")}>
              {z.label}
            </button>
          ))}
        </div>
      </PanelSection>
      <PanelSection title="Nuevo texto">
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); if (can) { s().addTextLayer(text.trim() || "TU TEXTO"); setText(""); } }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="Escribe aquí…" className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-neutral-400" />
          <Button type="submit" size="icon" disabled={!can} aria-label="Añadir texto"><Type /></Button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((t) => (
            <button key={t} type="button" disabled={!can} onClick={() => s().addTextLayer(t)} className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:border-neutral-400 disabled:opacity-40">
              {t}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-neutral-400">
          {can ? <>Se añade en <b className="font-medium text-neutral-600">{zone?.label.toLowerCase()}</b> del zapato {model.shoes[shoe].label.toLowerCase()}. Luego ajusta fuente, tamaño, color, contorno y curvatura en Propiedades.</> : "Selecciona una zona que admita texto."}
        </p>
      </PanelSection>
      <PanelSection title="Fuentes">
        <div className="grid grid-cols-3 gap-1.5">
          {FONT_OPTIONS.map((f) => (
            <div key={f.id} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-center">
              <div className="text-lg leading-none text-neutral-900" style={{ fontFamily: resolveCanvasFont(f.id) }}>{f.sample}</div>
              <div className="mt-1 text-[10px] text-neutral-400">{f.label}</div>
            </div>
          ))}
        </div>
      </PanelSection>
    </>
  );
}

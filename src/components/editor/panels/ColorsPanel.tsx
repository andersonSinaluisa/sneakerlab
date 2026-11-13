import { useState } from "react";
import { Link2 } from "lucide-react";
import { useEditor, useModel } from "@/lib/editor/store";
import { getZone } from "@/lib/model/registry";
import { PanelSection } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";

const SWATCHES = [
  "#f7f6f2", "#e9e8e4", "#c9c5bd", "#8a857c", "#3f3d3a", "#141414",
  "#b91c1c", "#ea580c", "#f59e0b", "#facc15", "#65a30d", "#15803d",
  "#0d9488", "#0284c7", "#1d4ed8", "#4338ca", "#7c3aed", "#db2777",
];

export function ColorsPanel() {
  const model = useModel();
  const zoneId = useEditor((s) => s.selectedZoneId);
  const shoe = useEditor((s) => s.activeShoe);
  const link = useEditor((s) => s.linkShoes);
  const zones = model.zones.filter((z) => z.customizable && z.allowColors);
  const zone = zoneId ? getZone(model, zoneId) : undefined;
  const color = useEditor((s) => (zoneId ? s.history.present.shoes[shoe].zones[zoneId]?.color : undefined));

  return (
    <>
      <PanelSection title="Zona">
        <div className="flex flex-wrap gap-1.5">
          {zones.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => useEditor.getState().selectZone(z.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                z.id === zoneId
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 text-neutral-600 hover:border-neutral-400",
              )}
            >
              {z.label}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={link}
            onChange={(e) => useEditor.getState().setLinkShoes(e.target.checked)}
            className="size-3.5 accent-neutral-900"
          />
          <Link2 className="size-3.5" /> Aplicar a ambos zapatos
        </label>
      </PanelSection>

      {zone?.allowColors && color ? (
        <PanelSection title={`Color · ${zone.label}`}>
          <div className="grid grid-cols-6 gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => useEditor.getState().setZoneColor(zone.id, c)}
                className={cn(
                  "aspect-square rounded-full border border-black/10 transition-transform hover:scale-110",
                  c.toLowerCase() === color.toLowerCase() && "ring-2 ring-neutral-900 ring-offset-2",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
          <ColorInput zoneId={zone.id} value={color} />
        </PanelSection>
      ) : (
        <PanelSection>
          <p className="text-xs text-neutral-400">Selecciona una zona personalizable para cambiar su color.</p>
        </PanelSection>
      )}
    </>
  );
}

export function ColorInput({ zoneId, value }: { zoneId: string; value: string }) {
  const s = useEditor.getState;

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        aria-label="Selector de color"
        onFocus={() => s().beginGesture()}
        onBlur={() => s().endGesture()}
        onChange={(e) => s().setZoneColor(zoneId, e.target.value)}
        className="size-9 cursor-pointer rounded-lg border border-neutral-200 bg-white p-0.5"
      />
      <HexInput key={value} zoneId={zoneId} initial={value} />
    </div>
  );
}

function HexInput({ zoneId, initial }: { zoneId: string; initial: string }) {
  const [text, setText] = useState(initial);
  return (
    <input
      value={text}
      maxLength={7}
      spellCheck={false}
      aria-label="Color hexadecimal"
      onChange={(e) => setText(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
      onBlur={() => {
        if (/^#[0-9a-fA-F]{6}$/.test(text)) useEditor.getState().setZoneColor(zoneId, text.toLowerCase());
        else setText(initial);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="h-9 w-full rounded-lg border border-neutral-200 px-3 font-mono text-xs uppercase text-neutral-800 outline-none focus:border-neutral-400"
    />
  );
}

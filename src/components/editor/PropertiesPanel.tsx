import { ArrowDown, ArrowUp, Copy, FlipHorizontal2, ImagePlus, Repeat, Trash2 } from "lucide-react";
import { useRef } from "react";
import { useEditor, useModel } from "@/lib/editor/store";
import { getZone } from "@/lib/model/registry";
import type { ImageLayer, Layer, MaskShape, PatternLayer, TextLayer } from "@/lib/editor/types";
import { Badge, PanelSection, SliderField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { ACCEPTED_MIME } from "@/lib/assets/validation";
import { getMaterialPreset } from "@/lib/materials/presets";
import { ColorInput } from "./panels/ColorsPanel";
import { PATTERNS } from "./panels/PatternsPanel";
import { FONT_OPTIONS, resolveCanvasFont } from "./fonts";
import { ZoneEditor2DAuto } from "./ZoneEditor2D";
import { useImageUpload } from "./useImageUpload";
import { cn } from "@/lib/utils/cn";
import { imagePrintQuality } from "@/lib/print/quality";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const MASKS: { id: MaskShape; label: string }[] = [
  { id: "none", label: "Sin máscara" }, { id: "circle", label: "Círculo" }, { id: "rounded", label: "Redondeada" },
  { id: "diamond", label: "Rombo" }, { id: "hexagon", label: "Hexágono" }, { id: "star", label: "Estrella" },
];

export function PropertiesPanel() {
  const layerId = useEditor((s) => s.selectedLayerId);
  const layer = useEditor((s) => s.history.present.layers.find((l) => l.id === s.selectedLayerId));
  const zoneId = useEditor((s) => s.selectedZoneId);
  const shoe = useEditor((s) => s.activeShoe);
  const model = useModel();
  const zone = zoneId ? getZone(model, zoneId) : undefined;

  if (!zone) {
    return (
      <PanelSection title="Propiedades">
        <p className="text-xs leading-relaxed text-neutral-400">Toca una zona del zapato para ver sus propiedades.</p>
      </PanelSection>
    );
  }

  return (
    <>
      <PanelSection title="Selección">
        <div>
          <div className="text-sm font-semibold text-neutral-900">{layer ? layer.name : zone.label}</div>
          <div className="mt-0.5 text-xs text-neutral-500">
            {layer ? `${layer.kind === "text" ? "Texto" : layer.kind === "pattern" ? "Patrón" : "Imagen"} · ${zone.label} · ` : ""}Zapato {model.shoes[shoe].label.toLowerCase()}
          </div>
        </div>
        {!layer && (
          <div className="flex flex-wrap gap-1">
            {zone.allowColors && <Badge>Color</Badge>}
            {zone.allowImages && <Badge>Imágenes</Badge>}
            {zone.allowText && <Badge>Texto</Badge>}
            {zone.allowMaterials && <Badge>Materiales</Badge>}
            {!zone.customizable && <Badge tone="amber">No personalizable</Badge>}
          </div>
        )}
      </PanelSection>

      {zone.texture && zone.allowImages && (
        <PanelSection title="Lienzo de la zona" className="pt-0">
          <ZoneEditor2DAuto />
          <p className="text-[11px] leading-relaxed text-neutral-400">Arrastra y rota aquí o sobre el zapato; escala con los deslizadores o Alt + rueda.</p>
        </PanelSection>
      )}

      {layer && layerId ? <LayerProperties layer={layer} /> : <ZoneProperties zoneId={zone.id} />}
    </>
  );
}

function ZoneProperties({ zoneId }: { zoneId: string }) {
  const model = useModel();
  const zone = getZone(model, zoneId)!;
  const shoe = useEditor((s) => s.activeShoe);
  const color = useEditor((s) => s.history.present.shoes[shoe].zones[zoneId]?.color);
  const materialId = useEditor((s) => s.history.present.shoes[shoe].zones[zoneId]?.material) ?? zone.material;
  const count = useEditor((s) => s.history.present.layers.filter((l) => l.shoe === shoe && l.zoneId === zoneId).length);
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, busy } = useImageUpload();
  const s = useEditor.getState;

  return (
    <>
      {zone.allowColors && color && (
        <PanelSection title="Color base"><ColorInput zoneId={zoneId} value={color} /></PanelSection>
      )}
      <PanelSection title="Material">
        <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
          <span className="text-[13px] text-neutral-800">{getMaterialPreset(materialId).label}</span>
          {zone.allowMaterials && <button type="button" className="text-xs font-medium text-blue-600 hover:underline" onClick={() => s().setActiveTool("materials")}>Cambiar</button>}
        </div>
      </PanelSection>
      {zone.allowImages && (
        <PanelSection title={`Capas (${count})`}>
          <div className="grid grid-cols-1 gap-2">
            <Button variant="outline" className="w-full" disabled={busy} onClick={() => inputRef.current?.click()}><ImagePlus /> {busy ? "Procesando…" : "Subir imagen"}</Button>
            <div className="grid grid-cols-2 gap-2">
              {zone.allowText && <Button variant="outline" onClick={() => s().addTextLayer()}>Añadir texto</Button>}
              <Button variant="outline" onClick={() => s().addPatternLayer()}>Añadir patrón</Button>
            </div>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPTED_MIME.join(",")} hidden onChange={(e) => { if (e.target.files) void upload(e.target.files, true); e.target.value = ""; }} />
        </PanelSection>
      )}
    </>
  );
}

function LayerProperties({ layer }: { layer: Layer }) {
  const s = useEditor.getState;
  const set = (patch: Record<string, unknown>) => s().updateLayer(layer.id, patch);
  const g = { onGestureStart: () => s().beginGesture(), onGestureEnd: () => s().endGesture() };

  return (
    <>
      {layer.kind === "text" && <TextProperties layer={layer} set={set} g={g} />}
      {layer.kind === "pattern" && <PatternProperties layer={layer} set={set} g={g} />}

      <PanelSection title="Transformación">
        <SliderField label="Posición X" value={layer.x} min={-0.2} max={1.2} step={0.005} format={pct} onChange={(x) => set({ x })} {...g} />
        <SliderField label="Posición Y" value={layer.y} min={-0.2} max={1.2} step={0.005} format={pct} onChange={(y) => set({ y })} {...g} />
        {layer.kind === "text" ? (
          <SliderField label="Tamaño" value={layer.size} min={0.05} max={1.2} step={0.005} format={pct} onChange={(size) => set({ size })} {...g} />
        ) : (
          <SliderField label={layer.kind === "pattern" ? "Ancho" : "Escala"} value={layer.width} min={0.03} max={1.5} step={0.005} format={pct} onChange={(width) => set({ width })} {...g} />
        )}
        {layer.kind === "pattern" && <SliderField label="Alto" value={layer.height} min={0.05} max={1.5} step={0.005} format={pct} onChange={(height) => set({ height })} {...g} />}
        <SliderField label="Rotación" value={layer.rotation} min={-180} max={180} step={1} format={(v) => `${Math.round(v)}°`} onChange={(rotation) => set({ rotation })} {...g} />
        <SliderField label="Opacidad" value={layer.opacity} min={0} max={1} step={0.01} format={pct} onChange={(opacity) => set({ opacity })} {...g} />
      </PanelSection>

      {layer.kind === "image" && <ImageProperties layer={layer} set={set} g={g} />}

      <PanelSection title="Máscara">
        <div className="grid grid-cols-3 gap-1.5">
          {MASKS.map((m) => (
            <button key={m.id} type="button" onClick={() => set({ mask: m.id })} className={cn("flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px]", (layer.mask ?? "none") === m.id ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400")}>
              <MaskIcon shape={m.id} />
              {m.label}
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Repetición y simetría">
        <SliderField label="Repeticiones" value={layer.repeat?.count ?? 1} min={1} max={8} step={1} onChange={(count) => set({ repeat: { count, gap: layer.repeat?.gap ?? 0.25, direction: layer.repeat?.direction ?? "horizontal" } })} {...g} />
        {(layer.repeat?.count ?? 1) > 1 && (
          <>
            <SliderField label="Separación" value={layer.repeat?.gap ?? 0.25} min={0.02} max={1} step={0.01} format={pct} onChange={(gap) => set({ repeat: { ...layer.repeat!, gap } })} {...g} />
            <div className="grid grid-cols-2 gap-1.5">
              {(["horizontal", "vertical"] as const).map((d) => (
                <Button key={d} size="sm" variant={layer.repeat?.direction === d ? "default" : "outline"} onClick={() => set({ repeat: { ...layer.repeat!, direction: d } })}>{d === "horizontal" ? "Horizontal" : "Vertical"}</Button>
              ))}
            </div>
          </>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-700">
          <input type="checkbox" checked={!!layer.mirror} onChange={(e) => set({ mirror: e.target.checked })} className="size-3.5 accent-neutral-900" />
          Simetría: duplicar espejado respecto al centro del lienzo
        </label>
      </PanelSection>

      <PanelSection title="Acciones">
        <div className="grid grid-cols-4 gap-1.5">
          <Tip label="Voltear horizontal"><Button variant={layer.flipX ? "default" : "outline"} size="icon" onClick={() => set({ flipX: !layer.flipX })} aria-label="Voltear horizontal"><FlipHorizontal2 /></Button></Tip>
          <Tip label="Traer adelante"><Button variant="outline" size="icon" onClick={() => s().reorderLayer(layer.id, "up")} aria-label="Traer adelante"><ArrowUp /></Button></Tip>
          <Tip label="Enviar atrás"><Button variant="outline" size="icon" onClick={() => s().reorderLayer(layer.id, "down")} aria-label="Enviar atrás"><ArrowDown /></Button></Tip>
          <Tip label="Duplicar (Ctrl+D)"><Button variant="outline" size="icon" onClick={() => s().duplicateLayer(layer.id)} aria-label="Duplicar"><Copy /></Button></Tip>
        </div>
        <Button variant="outline" className="w-full" onClick={() => s().copyLayerToOtherShoe(layer.id)}><Repeat /> Copiar al zapato {layer.shoe === "right" ? "izquierdo" : "derecho"}</Button>
        <Button variant="destructive" className="w-full" onClick={() => s().removeLayer(layer.id)}><Trash2 /> Eliminar capa</Button>
      </PanelSection>
    </>
  );
}

type Setter = (patch: Record<string, unknown>) => void;
type Gesture = { onGestureStart: () => void; onGestureEnd: () => void };

function TextProperties({ layer, set, g }: { layer: TextLayer; set: Setter; g: Gesture }) {
  return (
    <PanelSection title="Texto">
      <input value={layer.text} maxLength={80} onChange={(e) => set({ text: e.target.value, name: e.target.value.slice(0, 24) || "Texto" })} className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-neutral-400" aria-label="Contenido del texto" />
      <div className="grid grid-cols-3 gap-1.5">
        {FONT_OPTIONS.map((f) => (
          <button key={f.id} type="button" onClick={() => set({ font: f.id })} className={cn("rounded-lg border px-1 py-1.5 text-center", layer.font === f.id ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400")}>
            <div className="text-base leading-none" style={{ fontFamily: resolveCanvasFont(f.id) }}>{f.sample}</div>
            <div className="mt-0.5 text-[9px] text-neutral-400">{f.label}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {([400, 600, 800] as const).map((w) => (
          <Button key={w} size="sm" variant={layer.weight === w ? "default" : "outline"} onClick={() => set({ weight: w })}>{w === 400 ? "Normal" : w === 600 ? "Semi" : "Bold"}</Button>
        ))}
        <Button size="sm" variant={layer.italic ? "default" : "outline"} onClick={() => set({ italic: !layer.italic })}><i>It</i></Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Relleno" value={layer.fill} onChange={(fill) => set({ fill })} />
        <ColorField label="Contorno" value={layer.stroke ?? "#000000"} onChange={(stroke) => set({ stroke, strokeWidth: layer.strokeWidth || 0.08 })} />
      </div>
      <SliderField label="Grosor del contorno" value={layer.strokeWidth} min={0} max={0.3} step={0.005} format={pct} onChange={(strokeWidth) => set({ strokeWidth, stroke: layer.stroke ?? "#000000" })} {...g} />
      <SliderField label="Espaciado" value={layer.letterSpacing} min={-0.1} max={0.6} step={0.01} format={(v) => `${Math.round(v * 100)}`} onChange={(letterSpacing) => set({ letterSpacing })} {...g} />
      <SliderField label="Curvatura" value={layer.curve} min={-1} max={1} step={0.02} format={(v) => (Math.abs(v) < 0.02 ? "recto" : `${Math.round(v * 100)}`)} onChange={(curve) => set({ curve })} {...g} />
    </PanelSection>
  );
}

function PatternProperties({ layer, set, g }: { layer: PatternLayer; set: Setter; g: Gesture }) {
  return (
    <PanelSection title="Patrón">
      <div className="grid grid-cols-4 gap-1.5">
        {PATTERNS.map((p) => (
          <button key={p.id} type="button" title={p.label} onClick={() => set({ pattern: p.id, name: `Patrón · ${p.label}` })} className={cn("h-10 overflow-hidden rounded-lg border", layer.pattern === p.id ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200")} style={{ background: p.css(layer.colorA, layer.colorB) }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Fondo" value={layer.colorA} onChange={(colorA) => set({ colorA })} />
        <ColorField label="Figura" value={layer.colorB} onChange={(colorB) => set({ colorB })} />
      </div>
      <SliderField label="Tamaño del motivo" value={layer.scale} min={0.02} max={0.6} step={0.005} format={pct} onChange={(scale) => set({ scale })} {...g} />
    </PanelSection>
  );
}

function ImageProperties({ layer, set, g }: { layer: ImageLayer; set: Setter; g: Gesture }) {
  const c = layer.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const update = (p: Partial<typeof c>) => {
    const n = { ...c, ...p };
    n.w = Math.min(n.w, 1 - n.x);
    n.h = Math.min(n.h, 1 - n.y);
    set({ crop: n.x === 0 && n.y === 0 && n.w === 1 && n.h === 1 ? undefined : n });
  };
  return (
    <>
    <PrintQualityNote layer={layer} />
    <PanelSection title="Recorte" action={layer.crop && <button type="button" className="text-[11px] text-blue-600 hover:underline" onClick={() => set({ crop: undefined })}>Restablecer</button>}>
      <SliderField label="Desde la izquierda" value={c.x} min={0} max={0.9} step={0.01} format={pct} onChange={(x) => update({ x })} {...g} />
      <SliderField label="Desde arriba" value={c.y} min={0} max={0.9} step={0.01} format={pct} onChange={(y) => update({ y })} {...g} />
      <SliderField label="Ancho visible" value={c.w} min={0.1} max={1} step={0.01} format={pct} onChange={(w) => update({ w })} {...g} />
      <SliderField label="Alto visible" value={c.h} min={0.1} max={1} step={0.01} format={pct} onChange={(h) => update({ h })} {...g} />
    </PanelSection>
    </>
  );
}

/** Aviso de calidad de impresión (DTF a 300 ppp): cuanto más grande se coloca, más resolución hace falta. */
function PrintQualityNote({ layer }: { layer: ImageLayer }) {
  const asset = useEditor((s) => s.history.present.assets[layer.assetId]);
  const model = useModel();
  const q = imagePrintQuality(layer, asset, getZone(model, layer.zoneId));
  if (!q) return null;
  const text = {
    good: "Calidad de impresión: buena",
    fair: "Calidad de impresión: aceptable. Puede notarse algo suave de cerca.",
    poor: "Calidad de impresión: baja. Se verá pixelada; usa una imagen más grande o redúcela.",
  }[q.level];
  return (
    <div
      className={cn(
        "mx-4 mt-3 rounded-lg px-3 py-2 text-[11px] leading-snug",
        q.level === "good" ? "bg-emerald-50 text-emerald-700" : q.level === "fair" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700",
      )}
    >
      {text}
      {Number.isFinite(q.dpi) && <span className="opacity-70"> ({q.dpi} ppp)</span>}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const s = useEditor.getState;
  return (
    <label className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1.5">
      <input type="color" value={value} onFocus={() => s().beginGesture()} onBlur={() => s().endGesture()} onChange={(e) => onChange(e.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={label} />
      <span className="text-xs text-neutral-600">{label}</span>
    </label>
  );
}

function MaskIcon({ shape }: { shape: MaskShape }) {
  const d: Record<MaskShape, string> = {
    none: "M3 3h18v18H3z", circle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", rounded: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z",
    diamond: "M12 2l10 10-10 10L2 12z", hexagon: "M12 2l8.7 5v10L12 22l-8.7-5V7z", star: "M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z",
  };
  return <svg viewBox="0 0 24 24" className="size-5 fill-neutral-700"><path d={d[shape]} /></svg>;
}

/**
 * Editor 2D de la zona (Konva). Muestra el lienzo plano de la zona —el mismo que se proyecta por UV
 * en el modelo— con manijas para mover, escalar y rotar. Cada cambio se refleja en vivo en el 3D.
 *
 * Para no duplicar la lógica de dibujo (máscaras, recorte, patrones, texto en arco), cada capa se
 * representa con una imagen renderizada por el mismo compositor sobre un lienzo propio; Konva solo
 * aporta la interacción (arrastre, transformador).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Image as KImage, Layer as KLayer, Rect, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import { useShallow } from "zustand/react/shallow";
import { useEditor, useModel } from "@/lib/editor/store";
import { getZone } from "@/lib/model/registry";
import { getReadyImage, useAssetRuntime } from "@/lib/assets/assetStore";
import type { Layer } from "@/lib/editor/types";
import { layerBox } from "@/lib/textures/layerMath";
import { composeZone } from "@/lib/textures/compositor";
import { resolveCanvasFont } from "./fonts";

/** Renderiza una sola capa (sin color base) en un canvas del tamaño del lienzo de la zona. */
function renderLayerSprite(layer: Layer, canvas: { width: number; height: number }, scale: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(canvas.width * scale));
  cv.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = cv.getContext("2d")!;
  ctx.scale(scale, scale);
  composeZone(ctx, canvas, {
    baseColor: "rgba(0,0,0,0)",
    layers: [{ ...layer, visible: true, opacity: 1 }],
    getImage: getReadyImage,
    resolveFont: resolveCanvasFont,
  });
  return cv;
}

/** Sprites por capa, con caché por contenido (module-level para no tocar refs durante el render). */
const spriteCache = new Map<string, { key: string; sprite: HTMLCanvasElement }>();
function useSprites(layers: Layer[], tex: { width: number; height: number } | undefined, width: number, readyKey: string) {
  return useMemo(() => {
    const out: Record<string, HTMLCanvasElement> = {};
    if (!tex) return out;
    for (const l of layers) {
      if (l.kind === "image" && !getReadyImage(l.assetId)) continue;
      const key = JSON.stringify(l) + `|${width}`;
      const hit = spriteCache.get(l.id);
      if (hit && hit.key === key) out[l.id] = hit.sprite;
      else {
        const sprite = renderLayerSprite(l, tex, Math.min(1, (width * 1.5) / tex.width));
        spriteCache.set(l.id, { key, sprite });
        out[l.id] = sprite;
      }
    }
    void readyKey;
    return out;
  }, [layers, tex, width, readyKey]);
}

export function ZoneEditor2D({ width }: { width: number }) {
  const model = useModel();
  const shoe = useEditor((s) => s.activeShoe);
  const zoneId = useEditor((s) => s.selectedZoneId);
  const selectedId = useEditor((s) => s.selectedLayerId);
  const zone = zoneId ? getZone(model, zoneId) : undefined;
  const color = useEditor((s) => (zoneId ? s.history.present.shoes[shoe].zones[zoneId]?.color : "#fff"));
  const layers = useEditor(
    useShallow((s) => s.history.present.layers.filter((l) => l.shoe === shoe && l.zoneId === zoneId)),
  );
  const runtime = useAssetRuntime((s) => s.assets);
  const trRef = useRef<Konva.Transformer>(null);
  const nodes = useRef<Record<string, Konva.Image>>({});

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodes.current[selectedId] : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, layers]);

  const tex = zone?.texture;
  const k = tex ? width / tex.width : 1;
  const height = tex ? Math.round(tex.height * k) : 0;

  // Sprites por capa (se recalculan cuando cambia la capa, el tamaño o se carga su imagen)
  const readyKey = layers.map((l) => (l.kind === "image" ? runtime[l.assetId]?.status ?? "x" : "-")).join(",");
  const sprites = useSprites(layers, tex, width, readyKey);

  if (!zone?.texture) return null;
  const s = useEditor.getState;

  /** Lee la transformación del nodo y la vuelca en la capa; el sprite ocupa todo el lienzo, así que
   *  la posición de la capa se deriva del desplazamiento del nodo y la escala del transformador. */
  const commitNode = (layer: Layer, node: Konva.Image, end: boolean) => {
    const box = layerBox(layer, zone.texture!, layer.kind === "image" ? assetSize(layer.assetId) : undefined);
    const sx = Math.abs(node.scaleX());
    const patch: Record<string, unknown> = {
      x: node.x() / width,
      y: node.y() / height,
      rotation: Math.round(node.rotation() * 10) / 10,
    };
    if (layer.kind === "image") patch.width = (box.w * sx) / zone.texture!.width;
    else if (layer.kind === "text") patch.size = layer.size * sx;
    else {
      patch.width = (box.w * sx) / zone.texture!.width;
      patch.height = (box.h * Math.abs(node.scaleY())) / zone.texture!.height;
    }
    node.scale({ x: 1, y: 1 });
    s().updateLayer(layer.id, patch);
    if (end) s().endGesture();
  };
  const assetSize = (id: string) => {
    const a = runtime[id];
    return a?.width && a.height ? { width: a.width, height: a.height } : undefined;
  };

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200" style={{ width, height }}>
      <Stage
        width={width}
        height={height}
        onMouseDown={(e) => { if (e.target === e.target.getStage() || e.target.name() === "bg") s().selectLayer(null); }}
        onTouchStart={(e) => { if (e.target === e.target.getStage() || e.target.name() === "bg") s().selectLayer(null); }}
      >
        <KLayer>
          <Rect name="bg" width={width} height={height} fill={color} />
          {layers.map((l) => {
            const sprite = sprites[l.id];
            if (!sprite) return null;
            const box = layerBox(l, zone.texture!, l.kind === "image" ? assetSize(l.assetId) : undefined);
            // El sprite es el lienzo completo: lo centramos en la caja de la capa para que el
            // transformador rodee solo la capa. Recortamos el sprite a la caja (con margen para arcos).
            const bw = (box.w * k), bh = (box.h * k);
            return (
              <KImage
                key={l.id}
                ref={(n) => { if (n) nodes.current[l.id] = n; else delete nodes.current[l.id]; }}
                image={sprite}
                x={l.x * width}
                y={l.y * height}
                width={width}
                height={height}
                offsetX={l.x * width}
                offsetY={l.y * height}
                rotation={0}
                opacity={l.opacity}
                visible={l.visible}
                draggable
                hitFunc={(ctx, shape) => {
                  // zona de impacto = caja de la capa (rotada), no todo el lienzo
                  ctx.save();
                  ctx.translate(l.x * width, l.y * height);
                  ctx.rotate((l.rotation * Math.PI) / 180);
                  ctx.beginPath();
                  ctx.rect(-bw / 2, -bh / 2, bw, bh);
                  ctx.closePath();
                  ctx.restore();
                  ctx.fillStrokeShape(shape);
                }}
                onMouseDown={() => s().selectLayer(l.id)}
                onTap={() => s().selectLayer(l.id)}
                onDragStart={() => { s().selectLayer(l.id); s().beginGesture(); }}
                onDragMove={(e) => s().updateLayer(l.id, { x: e.target.x() / width, y: e.target.y() / height })}
                onDragEnd={() => s().endGesture()}
                onTransformStart={() => s().beginGesture()}
                onTransform={(e) => commitNode(l, e.target as Konva.Image, false)}
                onTransformEnd={(e) => commitNode(l, e.target as Konva.Image, true)}
              />
            );
          })}
          <SelectionFrame layers={layers} selectedId={selectedId} k={k} zoneTexture={zone.texture} assetSize={assetSize} />
          <Transformer
            ref={trRef}
            keepRatio
            rotateEnabled
            flipEnabled={false}
            resizeEnabled={false}
            borderEnabled={false}
            anchorSize={9}
            anchorCornerRadius={5}
            rotateAnchorOffset={28}
            anchorStroke="#2563eb"
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          />
        </KLayer>
      </Stage>
      <ScaleHandles layers={layers} selectedId={selectedId} />
    </div>
  );
}

/** Marco azul alrededor de la capa seleccionada (el transformador rodearía el lienzo entero). */
function SelectionFrame({ layers, selectedId, k, zoneTexture, assetSize }: {
  layers: Layer[]; selectedId: string | null; k: number; zoneTexture: { width: number; height: number };
  assetSize: (id: string) => { width: number; height: number } | undefined;
}) {
  const l = layers.find((x) => x.id === selectedId);
  if (!l) return null;
  const box = layerBox(l, zoneTexture, l.kind === "image" ? assetSize(l.assetId) : undefined);
  return (
    <Rect
      x={box.cx * k} y={box.cy * k} width={box.w * k} height={box.h * k} offsetX={(box.w * k) / 2} offsetY={(box.h * k) / 2}
      rotation={l.rotation} stroke="#2563eb" strokeWidth={1.5} dash={[6, 4]} listening={false}
    />
  );
}

/** Escala por rueda/pinza sobre el lienzo: la rotación la da el transformador; la escala, los sliders o Alt+rueda. */
function ScaleHandles({ layers, selectedId }: { layers: Layer[]; selectedId: string | null }) {
  useEffect(() => {
    if (!selectedId) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.altKey) return;
      const l = layers.find((x) => x.id === selectedId);
      if (!l) return;
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.05 : 0.95;
      const st = useEditor.getState();
      if (l.kind === "text") st.updateLayer(l.id, { size: l.size * f });
      else if (l.kind === "pattern") st.updateLayer(l.id, { width: l.width * f, height: l.height * f });
      else st.updateLayer(l.id, { width: l.width * f });
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [layers, selectedId]);
  return null;
}

/** Contenedor que mide el ancho disponible. */
export function ZoneEditor2DAuto() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.floor(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref}>{w > 0 && <ZoneEditor2D width={w} />}</div>;
}

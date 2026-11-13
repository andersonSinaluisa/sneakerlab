import { useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type Order } from "@/lib/api/client";
import { getModel } from "@/lib/model/registry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/** Anchos habituales de película DTF (útiles): rollo de 58 cm y hoja A3+. */
const SHEETS = [
  { mm: 560, label: "Rollo 58 cm" },
  { mm: 300, label: "Hoja 30 cm (A3+)" },
];

/** Genera y descarga el paquete de producción DTF del pedido (ver src/lib/print/production.ts). */
export function ProductionPack({ order }: { order: Order }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState(560);
  const [notes, setNotes] = useState<{ level: string; text: string }[] | null>(null);

  const run = async () => {
    setBusy("Preparando…");
    setNotes(null);
    try {
      const [{ order: full }, { buildProductionPack }] = await Promise.all([adminApi.order(order.id), import("@/lib/print/production")]);
      const doc = full.documentSnapshot;
      const res = await buildProductionPack(doc, getModel(doc.modelId), {
        number: full.number,
        size: full.size,
        customer: full.customer?.name,
        notes: full.notes,
        extras: full.priceSnapshot.lines.filter((l) => l.group === "extras").map((l) => l.label),
      }, { sheetWidthMm: sheet, onProgress: setBusy });
      const url = URL.createObjectURL(new Blob([res.zip as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNotes(res.notes);
      const bad = res.notes.filter((n) => n.level === "bad").length;
      if (bad) toast.warning(`Paquete generado con ${bad} aviso(s) importante(s)`);
      else toast.success(`Paquete de producción: ${res.pieces} pieza(s) DTF`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el paquete");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 p-3">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400"><Printer className="size-3.5" /> Producción DTF</div>
      <p className="mb-3 text-[12px] text-neutral-500">
        ZIP con las piezas a 300 ppp y tamaño real de la talla {order.size ? `EU ${order.size}` : "(sin talla)"}, la hoja DTF lista para el proveedor, plantillas 1:1, originales y la hoja de producción.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-neutral-200 p-0.5">
          {SHEETS.map((s) => (
            <button key={s.mm} type="button" onClick={() => setSheet(s.mm)} className={cn("rounded-md px-2.5 py-1 text-[12px]", sheet === s.mm ? "bg-neutral-900 text-white" : "text-neutral-600")}>{s.label}</button>
          ))}
        </div>
        <Button size="sm" onClick={() => void run()} disabled={!!busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Download />} {busy ?? "Descargar paquete"}
        </Button>
      </div>
      {notes && notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-[12px]">
          {notes.map((n, i) => (
            <li key={i} className={cn(n.level === "bad" ? "font-medium text-red-600" : n.level === "warn" ? "text-amber-700" : "text-emerald-700")}>{n.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, ShoppingBag, WifiOff } from "lucide-react";
import { formatMoney, useLivePrice } from "@/lib/api/pricing";
import { Button } from "@/components/ui/button";
import { OrderDialog } from "./OrderDialog";
import { cn } from "@/lib/utils/cn";

/**
 * Precio en vivo del diseño actual. El desglose lo calcula el servidor con las reglas vigentes;
 * aquí solo se muestra. Si el API no está disponible, lo dice en lugar de inventar un número.
 */
export function PricePanel({ className }: { className?: string }) {
  const price = useLivePrice();
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState(false);
  const q = price.quote;

  return (
    <div className={cn("pointer-events-auto w-[260px] rounded-2xl border border-neutral-200/80 bg-white/95 shadow-lg backdrop-blur", className)} data-testid="price-panel">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Precio estimado</div>
          {price.status === "unavailable" ? (
            <div className="flex items-center gap-1.5 text-[12px] text-neutral-500"><WifiOff className="size-3.5" /> No disponible</div>
          ) : (
            <div className="flex items-center gap-2 text-[20px] font-semibold tabular-nums tracking-tight text-neutral-900" data-testid="price-total">
              {q ? formatMoney(q.total, q.currency) : "—"}
              {price.status === "loading" && <Loader2 className="size-3.5 animate-spin text-neutral-400" />}
            </div>
          )}
        </div>
        {q ? (open ? <ChevronDown className="size-4 text-neutral-400" /> : <ChevronUp className="size-4 text-neutral-400" />) : null}
      </button>
      {open && q && (
        <div className="border-t border-neutral-100 px-4 py-3 text-[12px]">
          <ul className="space-y-1">
            {q.lines.map((l) => (
              <li key={l.code} className="flex items-baseline justify-between gap-2">
                <span className="truncate text-neutral-600">{l.label}{l.qty > 1 ? <span className="text-neutral-400"> × {l.qty}</span> : null}</span>
                <span className="tabular-nums text-neutral-900">{formatMoney(l.amount, q.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-neutral-100 pt-2 text-[11px] text-neutral-500">
            <span>Base {formatMoney(q.basePrice, q.currency)} · Personalización {formatMoney(q.customization, q.currency)}</span>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-neutral-400">Precio orientativo según las reglas actuales del taller. Se confirma al cotizar; no incluye envío.</p>
        </div>
      )}
      <div className="border-t border-neutral-100 p-2">
        <Button className="w-full" size="sm" disabled={!q} onClick={() => setOrder(true)}>
          <ShoppingBag /> Solicitar pedido
        </Button>
      </div>
      {order && <OrderDialog onClose={() => setOrder(false)} />}
    </div>
  );
}

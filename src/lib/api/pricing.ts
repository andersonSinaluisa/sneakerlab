import { useEffect, useState } from "react";
import type { QuoteBreakdown } from "./types";
import { useDoc } from "@/lib/editor/store";
import { quotesApi, type QuoteExtras } from "./client";

export type PriceState =
  | { status: "loading"; quote: QuoteBreakdown | null }
  | { status: "ready"; quote: QuoteBreakdown }
  | { status: "unavailable"; quote: null; reason: string };

/**
 * Cotización en vivo: pide al servidor el desglose cada vez que cambia el documento (con debounce).
 * Nunca calcula precios en el cliente; si el API no responde, el panel muestra "no disponible".
 */
export function useLivePrice(extras?: QuoteExtras): PriceState {
  const doc = useDoc();
  const [state, setState] = useState<PriceState>({ status: "loading", quote: null });
  const extrasKey = JSON.stringify(extras ?? null);
  useEffect(() => {
    let cancelled = false;
    const t0 = setTimeout(() => setState((s) => ({ status: "loading", quote: s.quote })), 0);
    const t = setTimeout(async () => {
      try {
        const { quote } = await quotesApi.preview(doc, extras);
        if (!cancelled) setState({ status: "ready", quote });
      } catch (e) {
        if (!cancelled) setState({ status: "unavailable", quote: null, reason: e instanceof Error ? e.message : "Sin conexión con el servidor" });
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(t0); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, extrasKey]);
  return state;
}

export const formatMoney = (n: number, currency = "USD") => new Intl.NumberFormat("es", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);

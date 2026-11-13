import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { api, ordersApi, quotesApi, type Order, type Quote, type QuoteExtras, type Shipping } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth";
import { formatMoney } from "@/lib/api/pricing";
import { syncAssetsToCloud } from "@/lib/api/sync";
import { useEditor } from "@/lib/editor/store";
import { saveToCloud, remoteLink } from "@/components/account/CloudDesignsDialog";
import { AuthDialog } from "@/components/account/AuthDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface Extras { finishes: { code: string; label: string; amount: number }[]; services: { code: string; label: string; amount: number }[] }
const SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];
const input = "h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] outline-none focus:border-neutral-900";

/**
 * Flujo de pedido en tres pasos: extras → cotización formal (servidor) → datos de envío → pedido.
 * El pedido referencia la cotización y el servidor verifica que el documento no cambió.
 */
export function OrderDialog({ onClose }: { onClose: () => void }) {
  const user = useAuth((s) => s.user);
  const [auth, setAuth] = useState(false);
  const [step, setStep] = useState<"extras" | "shipping" | "done">("extras");
  const [extrasCatalog, setExtrasCatalog] = useState<Extras | null>(null);
  const [extras, setExtras] = useState<QuoteExtras>({ services: [] });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [size, setSize] = useState("42");
  const [notes, setNotes] = useState("");
  const [ship, setShip] = useState<Shipping>({ fullName: user?.name ?? "", address1: "", city: "", country: "EC" });
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    api<Extras>("/catalog/extras").then(setExtrasCatalog).catch(() => setExtrasCatalog({ finishes: [], services: [] }));
  }, []);

  const requestQuote = async () => {
    if (!user) return setAuth(true);
    setBusy("Cotizando…");
    try {
      // Guardamos el diseño en la cuenta (sube las imágenes) para que el pedido quede ligado a él.
      const design = await saveToCloud();
      const doc = await syncAssetsToCloud(useEditor.getState().doc());
      const { quote: q } = await quotesApi.create(doc, extras, design.id);
      setQuote(q);
      setStep("shipping");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cotizar");
    } finally { setBusy(null); }
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;
    setBusy("Enviando pedido…");
    try {
      const local = useEditor.getState().doc();
      const doc = await syncAssetsToCloud(local);
      const { order: o } = await ordersApi.create({ quoteId: quote.id, document: doc, designId: remoteLink.get(local.id), size, notes: notes || undefined, shipping: ship });
      setOrder(o);
      setStep("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el pedido");
    } finally { setBusy(null); }
  };

  const toggleService = (code: string) => setExtras((x) => ({ ...x, services: x.services.includes(code) ? x.services.filter((s) => s !== code) : [...x.services, code] }));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5">
          <h3 className="text-[15px] font-semibold text-neutral-900">
            {step === "extras" ? "Solicitar pedido" : step === "shipping" ? "Datos de envío" : "Pedido recibido"}
          </h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar"><X /></Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "extras" && (
            <div className="space-y-5">
              {!extrasCatalog ? <Loader2 className="size-4 animate-spin text-neutral-400" /> : (
                <>
                  {extrasCatalog.finishes.length > 0 && (
                    <section>
                      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Acabado</h4>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Choice active={!extras.finish} onClick={() => setExtras((x) => ({ ...x, finish: undefined }))} label="Estándar" price="incluido" />
                        {extrasCatalog.finishes.map((f) => <Choice key={f.code} active={extras.finish === f.code} onClick={() => setExtras((x) => ({ ...x, finish: f.code }))} label={f.label} price={`+${formatMoney(f.amount)}`} />)}
                      </div>
                    </section>
                  )}
                  {extrasCatalog.services.length > 0 && (
                    <section>
                      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Servicios adicionales</h4>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {extrasCatalog.services.map((s) => <Choice key={s.code} active={extras.services.includes(s.code)} onClick={() => toggleService(s.code)} label={s.label} price={`+${formatMoney(s.amount)}`} />)}
                      </div>
                    </section>
                  )}
                </>
              )}
              <p className="text-[11px] leading-snug text-neutral-400">Al continuar, el diseño se guarda en tu cuenta y el taller emite una cotización formal con validez de 72 h. El envío se calcula aparte.</p>
            </div>
          )}

          {step === "shipping" && quote && (
            <form id="order-form" onSubmit={placeOrder} className="space-y-4">
              <div className="rounded-xl bg-neutral-50 p-3 text-[12px]">
                <div className="flex justify-between font-medium text-neutral-900"><span>Cotización</span><span className="tabular-nums">{formatMoney(quote.total, quote.currency)}</span></div>
                <div className="mt-1 text-neutral-500">Base {formatMoney(quote.basePrice)} · Personalización {formatMoney(quote.customization)} · Extras {formatMoney(quote.extras)}</div>
                <div className="mt-1 text-[11px] text-neutral-400">Válida hasta {new Date(quote.expiresAt).toLocaleString("es")}</div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Talla (EU)</label>
                <div className="flex flex-wrap gap-1.5">
                  {SIZES.map((s) => <button key={s} type="button" onClick={() => setSize(s)} className={cn("h-8 min-w-9 rounded-lg border px-2 text-[12px] tabular-nums", size === s ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-700")}>{s}</button>)}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input className={cn(input, "sm:col-span-2")} placeholder="Nombre completo" required value={ship.fullName} onChange={(e) => setShip({ ...ship, fullName: e.target.value })} autoComplete="name" />
                <input className={input} placeholder="Teléfono (opcional)" value={ship.phone ?? ""} onChange={(e) => setShip({ ...ship, phone: e.target.value })} autoComplete="tel" />
                <input className={input} placeholder="País (código, p. ej. EC)" required maxLength={2} value={ship.country} onChange={(e) => setShip({ ...ship, country: e.target.value.toUpperCase() })} autoComplete="country" />
                <input className={cn(input, "sm:col-span-2")} placeholder="Dirección" required value={ship.address1} onChange={(e) => setShip({ ...ship, address1: e.target.value })} autoComplete="address-line1" />
                <input className={input} placeholder="Ciudad" required value={ship.city} onChange={(e) => setShip({ ...ship, city: e.target.value })} autoComplete="address-level2" />
                <input className={input} placeholder="Código postal (opcional)" value={ship.postalCode ?? ""} onChange={(e) => setShip({ ...ship, postalCode: e.target.value })} autoComplete="postal-code" />
              </div>
              <textarea className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-[13px] outline-none focus:border-neutral-900" rows={2} placeholder="Notas para el taller (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            </form>
          )}

          {step === "done" && order && (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="size-10 text-emerald-600" />
              <h4 className="mt-3 text-[16px] font-semibold text-neutral-900">Pedido #{order.number}</h4>
              <p className="mt-1 max-w-xs text-[13px] text-neutral-500">Lo recibimos en estado <b>pendiente</b>. El taller lo revisará y verás cada cambio de estado en «Mis pedidos».</p>
              <div className="mt-3 text-[18px] font-semibold tabular-nums">{formatMoney(order.total, order.currency)}</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-5 py-3">
          {step === "extras" && <Button onClick={requestQuote} disabled={!!busy || !extrasCatalog}>{busy ? <><Loader2 className="animate-spin" /> {busy}</> : user ? "Continuar y cotizar" : "Entrar para cotizar"}</Button>}
          {step === "shipping" && <><Button variant="ghost" onClick={() => setStep("extras")} disabled={!!busy}>Atrás</Button><Button type="submit" form="order-form" disabled={!!busy}>{busy ? <><Loader2 className="animate-spin" /> {busy}</> : "Confirmar pedido"}</Button></>}
          {step === "done" && <><Button variant="outline" asChild><Link to="/orders">Ver mis pedidos</Link></Button><Button onClick={onClose}>Seguir diseñando</Button></>}
        </div>
      </div>
      {auth && <AuthDialog onClose={() => setAuth(false)} reason="Necesitas una cuenta para cotizar y pedir." />}
    </div>
  );
}

function Choice({ active, onClick, label, price }: { active: boolean; onClick: () => void; label: string; price: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[13px]", active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-700 hover:bg-neutral-50")}>
      <span>{label}</span><span className={cn("text-[11px] tabular-nums", active ? "text-neutral-300" : "text-neutral-400")}>{price}</span>
    </button>
  );
}

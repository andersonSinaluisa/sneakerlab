import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/api/auth";
import { ordersApi, type Order } from "@/lib/api/client";
import { formatMoney } from "@/lib/api/pricing";
import { AuthDialog } from "@/components/account/AuthDialog";
import { Button } from "@/components/ui/button";
import { EmptyState, PageShell, StatusBadge } from "./shared";

export default function MyOrders() {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [open, setOpen] = useState<Order | null>(null);

  useEffect(() => { void useAuth.getState().hydrate(); }, []);
  useEffect(() => {
    if (!user) return;
    ordersApi.list().then((r) => setOrders(r.orders)).catch((e) => { toast.error(e.message); setOrders([]); });
    return () => setOrders(null);
  }, [user]);

  const cancel = async (o: Order) => {
    if (!window.confirm(`¿Cancelar el pedido #${o.number}?`)) return;
    try {
      const { order } = await ordersApi.cancel(o.id);
      setOrders((list) => list?.map((x) => (x.id === order.id ? { ...x, ...order } : x)) ?? null);
      toast.success("Pedido cancelado");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo cancelar"); }
  };

  const openDetail = async (o: Order) => {
    try { setOpen((await ordersApi.get(o.id)).order); } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  return (
    <PageShell title="Mis pedidos" subtitle={user ? `Sesión de ${user.email}` : undefined}>
      {status === "loading" || status === "idle" ? (
        <div className="flex items-center gap-2 text-[13px] text-neutral-400"><Loader2 className="size-4 animate-spin" /> Cargando…</div>
      ) : status === "offline" ? (
        <EmptyState>No se pudo conectar con el servidor de pedidos.</EmptyState>
      ) : !user ? (
        <>
          <EmptyState>Inicia sesión para ver tus pedidos.</EmptyState>
          <AuthDialog onClose={() => { if (!useAuth.getState().user) history.back(); }} />
        </>
      ) : !orders ? (
        <div className="flex items-center gap-2 text-[13px] text-neutral-400"><Loader2 className="size-4 animate-spin" /> Cargando…</div>
      ) : orders.length === 0 ? (
        <EmptyState>Todavía no has hecho ningún pedido. Diseña tu par y pulsa «Solicitar pedido» en el editor.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white px-4 py-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDetail(o)}>
                <div className="flex items-center gap-2 text-[14px] font-semibold">#{o.number} <StatusBadge status={o.status} /></div>
                <div className="text-[12px] text-neutral-500">{new Date(o.createdAt).toLocaleString("es")} · Talla {o.size}</div>
              </button>
              <div className="text-[15px] font-semibold tabular-nums">{formatMoney(o.total, o.currency)}</div>
              {(o.status === "pending" || o.status === "in_review") && <Button variant="outline" size="sm" onClick={() => cancel(o)}>Cancelar</Button>}
            </li>
          ))}
        </ul>
      )}
      {open && <OrderDetail order={open} onClose={() => setOpen(null)} />}
    </PageShell>
  );
}

export function OrderDetail({ order, onClose, children }: { order: Order; onClose: () => void; children?: React.ReactNode }) {
  const b = order.priceSnapshot;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-semibold">Pedido #{order.number}</h3>
          <StatusBadge status={order.status} />
        </div>
        {order.customer && <p className="mt-1 text-[12px] text-neutral-500">{order.customer.name} · {order.customer.email}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
          <dt className="text-neutral-400">Talla</dt><dd>{order.size}</dd>
          <dt className="text-neutral-400">Fecha</dt><dd>{new Date(order.createdAt).toLocaleString("es")}</dd>
          {order.shipping && (<><dt className="text-neutral-400">Envío</dt><dd>{order.shipping.fullName}, {order.shipping.address1}{order.shipping.address2 ? `, ${order.shipping.address2}` : ""}, {order.shipping.city} {order.shipping.postalCode ?? ""} ({order.shipping.country}){order.shipping.phone ? ` · ${order.shipping.phone}` : ""}</dd></>)}
          {order.notes && (<><dt className="text-neutral-400">Notas</dt><dd className="whitespace-pre-wrap">{order.notes}</dd></>)}
        </dl>
        {b?.lines && (
          <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-[12px]">
            {b.lines.map((l) => <div key={l.code} className="flex justify-between"><span className="text-neutral-600">{l.label}{l.qty > 1 ? ` × ${l.qty}` : ""}</span><span className="tabular-nums">{formatMoney(l.amount, order.currency)}</span></div>)}
            <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 font-semibold"><span>Total</span><span className="tabular-nums">{formatMoney(order.total, order.currency)}</span></div>
          </div>
        )}
        {order.history && (
          <ol className="mt-4 space-y-1 text-[12px]">
            {order.history.map((h, i) => <li key={i} className="flex gap-2"><span className="w-36 shrink-0 text-neutral-400">{new Date(h.at).toLocaleString("es")}</span><span><StatusBadge status={h.to} />{h.note ? <span className="ml-2 text-neutral-500">{h.note}</span> : null}</span></li>)}
          </ol>
        )}
        {children}
        <div className="mt-4 flex justify-end"><Button variant="outline" onClick={onClose}>Cerrar</Button></div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/api/auth";
import { adminApi, type Order, type OrderStatus } from "@/lib/api/client";
import { formatMoney } from "@/lib/api/pricing";
import { AuthDialog } from "@/components/account/AuthDialog";
import { Button } from "@/components/ui/button";
import { EmptyState, PageShell, STATUS_LABELS, STATUS_ORDER, StatusBadge } from "./shared";
import { OrderDetail } from "./MyOrders";
import { ProductionPack } from "./ProductionPack";
import { cn } from "@/lib/utils/cn";

/** Transiciones que ofrece la UI; el servidor vuelve a validarlas. */
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ["in_review", "cancelled"], in_review: ["approved", "pending", "cancelled"], approved: ["in_production", "cancelled"],
  in_production: ["finished"], finished: ["delivered"], delivered: [], cancelled: [],
};

export default function AdminOrders() {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof adminApi.stats>> | null>(null);
  const [open, setOpen] = useState<Order | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => { void useAuth.getState().hydrate(); }, []);
  const refresh = useCallback(async () => {
    try {
      const [o, s] = await Promise.all([adminApi.orders(filter === "all" ? undefined : filter), adminApi.stats()]);
      setOrders(o.orders); setStats(s);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); setOrders([]); }
  }, [filter]);
  useEffect(() => { if (user?.role === "admin") void Promise.resolve().then(refresh); }, [user, refresh]);

  const move = async (o: Order, to: OrderStatus) => {
    try {
      const { order } = await adminApi.setStatus(o.id, to, note || undefined);
      toast.success(`#${order.number} → ${STATUS_LABELS[to]}`);
      setNote("");
      setOpen(null);
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo cambiar el estado"); }
  };

  if (status === "idle" || status === "loading") return <PageShell title="Pedidos"><Loader2 className="size-4 animate-spin text-neutral-400" /></PageShell>;
  if (!user) return <PageShell title="Pedidos"><EmptyState>Inicia sesión como administrador.</EmptyState><AuthDialog onClose={() => { if (!useAuth.getState().user) history.back(); }} /></PageShell>;
  if (user.role !== "admin") return <PageShell title="Pedidos"><EmptyState>Tu cuenta no tiene permisos de administración.</EmptyState></PageShell>;

  return (
    <PageShell title="Pedidos" subtitle="Taller · gestión de estados">
      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <Stat label="Usuarios" value={String(stats.users)} />
          <Stat label="Diseños" value={String(stats.designs)} />
          {STATUS_ORDER.filter((s) => s !== "cancelled" && s !== "delivered").map((s) => { const r = stats.orders.find((o) => o.status === s); return <Stat key={s} label={STATUS_LABELS[s]} value={String(r?.count ?? 0)} sub={r ? formatMoney(r.total) : undefined} />; })}
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", ...STATUS_ORDER] as const).map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={cn("rounded-full border px-3 py-1 text-[12px]", filter === s ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-600")}>
            {s === "all" ? "Todos" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {!orders ? <Loader2 className="size-4 animate-spin text-neutral-400" /> : orders.length === 0 ? <EmptyState>No hay pedidos en este estado.</EmptyState> : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wider text-neutral-400">
              <tr><th className="px-4 py-2">Nº</th><th className="px-4 py-2">Cliente</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2">Talla</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2">Fecha</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {orders.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-neutral-50" onClick={async () => setOpen((await adminApi.order(o.id)).order)}>
                  <td className="px-4 py-2 font-semibold">#{o.number}</td>
                  <td className="px-4 py-2"><div>{o.customer?.name}</div><div className="text-[11px] text-neutral-400">{o.customer?.email}</div></td>
                  <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-2">{o.size}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatMoney(o.total, o.currency)}</td>
                  <td className="px-4 py-2 text-neutral-500">{new Date(o.createdAt).toLocaleDateString("es")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <OrderDetail order={open} onClose={() => setOpen(null)}>
          {open.status !== "cancelled" && <ProductionPack order={open} />}
          {NEXT[open.status].length > 0 && (
            <div className="mt-4 rounded-xl border border-neutral-200 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Cambiar estado</div>
              <input className="mb-2 h-9 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-neutral-900" placeholder="Nota para el historial (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              <div className="flex flex-wrap gap-2">
                {NEXT[open.status].map((to) => <Button key={to} size="sm" variant={to === "cancelled" ? "destructive" : "default"} onClick={() => move(open, to)}>{STATUS_LABELS[to]}</Button>)}
              </div>
            </div>
          )}
        </OrderDetail>
      )}
    </PageShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-400">{label}</div>
      <div className="text-[18px] font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}

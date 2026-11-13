import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/api/auth";
import { adminApi, type PriceRule } from "@/lib/api/client";
import { AuthDialog } from "@/components/account/AuthDialog";
import { Button } from "@/components/ui/button";
import { EmptyState, PageShell } from "./shared";

const KINDS: { id: PriceRule["kind"]; label: string; usesFactor?: boolean; targetHint: string }[] = [
  { id: "base_model", label: "Precio base por modelo", targetHint: "modelId (p. ej. court-low-01)" },
  { id: "per_zone", label: "Por zona personalizada", targetHint: "vacío = genérica" },
  { id: "per_image", label: "Por ilustración", targetHint: "vacío = genérica" },
  { id: "per_text", label: "Por texto", targetHint: "vacío = genérica" },
  { id: "per_pattern", label: "Por patrón", targetHint: "vacío = genérica" },
  { id: "material_factor", label: "Factor de material", usesFactor: true, targetHint: "materialId (suede, mesh…)" },
  { id: "complexity", label: "Factor de complejidad", usesFactor: true, targetHint: "vacío" },
  { id: "finish", label: "Acabado (extra)", targetHint: "código del acabado" },
  { id: "service", label: "Servicio (extra)", targetHint: "código del servicio" },
];
const input = "h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-[13px] outline-none focus:border-neutral-900";

export default function AdminPricing() {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const [rules, setRules] = useState<PriceRule[] | null>(null);
  const [draft, setDraft] = useState<Omit<PriceRule, "id">>({ kind: "service", target: "", label: "", amount: 0, factor: 1, active: true });

  useEffect(() => { void useAuth.getState().hydrate(); }, []);
  const refresh = () => adminApi.rules().then((r) => setRules(r.rules)).catch((e) => { toast.error(e.message); setRules([]); });
  useEffect(() => { if (user?.role === "admin") void Promise.resolve().then(refresh); }, [user]);

  const save = async (r: PriceRule, patch: Partial<PriceRule>) => {
    try {
      const { rule } = await adminApi.updateRule(r.id, patch);
      setRules((list) => list?.map((x) => (x.id === rule.id ? rule : x)) ?? null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo guardar"); }
  };
  const remove = async (r: PriceRule) => {
    if (!window.confirm(`¿Eliminar la regla "${r.label}"?`)) return;
    try { await adminApi.deleteRule(r.id); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };
  const create = async () => {
    if (!draft.label.trim()) return toast.error("Pon una etiqueta");
    try {
      await adminApi.createRule({ ...draft, target: draft.target?.trim() || null });
      setDraft({ ...draft, label: "", target: "", amount: 0 });
      await refresh();
      toast.success("Regla creada");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  if (status === "idle" || status === "loading") return <PageShell title="Precios"><Loader2 className="size-4 animate-spin text-neutral-400" /></PageShell>;
  if (!user) return <PageShell title="Precios"><EmptyState>Inicia sesión como administrador.</EmptyState><AuthDialog onClose={() => { if (!useAuth.getState().user) history.back(); }} /></PageShell>;
  if (user.role !== "admin") return <PageShell title="Precios"><EmptyState>Tu cuenta no tiene permisos de administración.</EmptyState></PageShell>;

  return (
    <PageShell title="Reglas de precio" subtitle="Cada cambio afecta a las cotizaciones nuevas; los pedidos conservan su desglose.">
      {!rules ? <Loader2 className="size-4 animate-spin text-neutral-400" /> : (
        <div className="space-y-6">
          {KINDS.map((k) => {
            const list = rules.filter((r) => r.kind === k.id);
            return (
              <section key={k.id} className="rounded-2xl border border-neutral-200/80 bg-white">
                <header className="flex items-center justify-between px-4 py-2.5">
                  <h2 className="text-[13px] font-semibold">{k.label}</h2>
                  <span className="text-[11px] text-neutral-400">{k.targetHint}</span>
                </header>
                {list.length === 0 ? <p className="px-4 pb-3 text-[12px] text-neutral-400">Sin reglas.</p> : (
                  <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
                    {list.map((r) => (
                      <li key={r.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 px-4 py-2">
                        <div className="min-w-0">
                          <input className={`${input} w-full`} defaultValue={r.label} onBlur={(e) => e.target.value !== r.label && save(r, { label: e.target.value })} aria-label="Etiqueta" />
                          <div className="mt-0.5 truncate text-[11px] text-neutral-400">{r.target ?? "genérica"}</div>
                        </div>
                        {k.usesFactor ? (
                          <label className="flex items-center gap-1 text-[12px] text-neutral-500">×<input type="number" step="0.01" min="0" className={`${input} w-20`} defaultValue={r.factor} onBlur={(e) => Number(e.target.value) !== r.factor && save(r, { factor: Number(e.target.value) })} /></label>
                        ) : (
                          <label className="flex items-center gap-1 text-[12px] text-neutral-500">$<input type="number" step="0.5" min="0" className={`${input} w-24`} defaultValue={r.amount} onBlur={(e) => Number(e.target.value) !== r.amount && save(r, { amount: Number(e.target.value) })} /></label>
                        )}
                        <label className="flex items-center gap-1.5 text-[12px] text-neutral-600"><input type="checkbox" className="accent-neutral-900" checked={r.active} onChange={(e) => save(r, { active: e.target.checked })} /> Activa</label>
                        <span />
                        <Button variant="destructive" size="icon-sm" onClick={() => remove(r)} aria-label="Eliminar"><Trash2 /></Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          <section className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 p-4">
            <h2 className="mb-3 text-[13px] font-semibold">Nueva regla</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select className={input} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
              <input className={`${input} w-44`} placeholder="target (opcional)" value={draft.target ?? ""} onChange={(e) => setDraft({ ...draft, target: e.target.value })} />
              <input className={`${input} w-56`} placeholder="Etiqueta visible" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              <label className="flex items-center gap-1 text-[12px] text-neutral-500">$<input type="number" step="0.5" min="0" className={`${input} w-24`} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} /></label>
              <label className="flex items-center gap-1 text-[12px] text-neutral-500">×<input type="number" step="0.01" min="0" className={`${input} w-20`} value={draft.factor} onChange={(e) => setDraft({ ...draft, factor: Number(e.target.value) })} /></label>
              <Button size="sm" onClick={create}><Plus /> Añadir</Button>
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}

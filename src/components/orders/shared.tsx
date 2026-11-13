import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Toaster } from "sonner";
import type { OrderStatus } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente", in_review: "En revisión", approved: "Aprobado", in_production: "En producción",
  finished: "Finalizado", delivered: "Entregado", cancelled: "Cancelado",
};
export const STATUS_ORDER: OrderStatus[] = ["pending", "in_review", "approved", "in_production", "finished", "delivered", "cancelled"];
const TONE: Record<OrderStatus, string> = {
  pending: "bg-amber-50 text-amber-700", in_review: "bg-sky-50 text-sky-700", approved: "bg-indigo-50 text-indigo-700",
  in_production: "bg-violet-50 text-violet-700", finished: "bg-emerald-50 text-emerald-700", delivered: "bg-emerald-100 text-emerald-800", cancelled: "bg-neutral-100 text-neutral-500",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[status])}>{STATUS_LABELS[status]}</span>;
}

export function PageShell({ title, subtitle, children, actions }: { title: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="h-dvh overflow-y-auto bg-[#f4f3f0] text-neutral-900">
      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link to="/disenar"><ArrowLeft /> Editor</Link></Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="text-[13px] text-neutral-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </div>
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 p-10 text-center text-[13px] text-neutral-500">{children}</div>;
}

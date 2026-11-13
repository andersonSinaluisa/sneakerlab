import * as React from "react";
import { Slider } from "./slider";
import { cn } from "@/lib/utils/cn";

export function PanelSection({
  title,
  children,
  className,
  action,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-3 px-4 py-4", className)}>
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
}

/** Slider con etiqueta. Agrupa un arrastre completo en una sola entrada del historial. */
export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  onGestureStart,
  onGestureEnd,
}: SliderFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-500">{label}</span>
        <span className="tabular-nums text-neutral-800">{format ? format(value) : value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onPointerDown={onGestureStart}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={() => onGestureEnd?.()}
      />
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "amber" | "blue" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "neutral" && "bg-neutral-100 text-neutral-500",
        tone === "amber" && "bg-amber-100 text-amber-700",
        tone === "blue" && "bg-blue-50 text-blue-600",
      )}
    >
      {children}
    </span>
  );
}

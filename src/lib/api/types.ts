/** Contratos compartidos con el API PHP (ver api/src/Pricing/Engine.php). */
export interface BreakdownLine { code: string; label: string; qty: number; unit: number; amount: number; group: "base" | "customization" | "extras" }
export interface QuoteBreakdown {
  currency: "USD";
  basePrice: number;
  customization: number;
  extras: number;
  total: number;
  lines: BreakdownLine[];
  /** 0..1, informativo: cuánto se aleja el diseño del modelo base */
  complexity: number;
}

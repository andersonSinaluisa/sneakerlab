/**
 * Cliente HTTP del API. Por defecto usa el mismo origen (`/api`, servido por el API PHP en el mismo dominio);
 * VITE_API_URL permite apuntar directo al API en desarrollo.
 */
import type { QuoteBreakdown } from "./types";
import type { DesignDocument } from "@/lib/editor/types";
import type { SneakerDesignPreset } from "@/lib/designs/schema";

export const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const TOKEN_KEY = "sneakerlab:token";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}/api${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Error ${res.status}`, body.details);
  return body as T;
}

/* ---------- Tipos de respuesta ---------- */
export interface ApiUser { id: string; email: string; name: string; role: "customer" | "admin"; createdAt: string }
export interface DesignSummary { id: string; name: string; modelId: string; thumbnailUrl: string | null; isPublic: boolean; shareToken: string | null; createdAt: string; updatedAt: string }
export interface DesignFull extends DesignSummary { document: DesignDocument }
export interface Quote { id: string; designId: string | null; modelId: string; currency: string; basePrice: number; customization: number; extras: number; total: number; breakdown: QuoteBreakdown; expiresAt: string; createdAt: string }
export type OrderStatus = "pending" | "in_review" | "approved" | "in_production" | "finished" | "delivered" | "cancelled";
export interface Shipping { fullName: string; phone?: string; address1: string; address2?: string; city: string; region?: string; postalCode?: string; country: string }
export interface Order { id: string; number: number; status: OrderStatus; total: number; currency: string; size: string | null; notes: string | null; shipping: Shipping | null; priceSnapshot: QuoteBreakdown; designId: string | null; createdAt: string; updatedAt: string; history?: { from: OrderStatus | null; to: OrderStatus; note: string | null; at: string }[]; customer?: { email: string; name: string } }
export interface PriceRule { id: string; kind: string; target: string | null; label: string; amount: number; factor: number; active: boolean }
export interface QuoteExtras { services: string[]; finish?: string }

/* ---------- Endpoints ---------- */
export const authApi = {
  register: (data: { email: string; password: string; name: string }) => api<{ user: ApiUser; token: string }>("/auth/register", { method: "POST", json: data }),
  login: (data: { email: string; password: string }) => api<{ user: ApiUser; token: string }>("/auth/login", { method: "POST", json: data }),
  me: () => api<{ user: ApiUser }>("/auth/me"),
};

export const designsApi = {
  list: () => api<{ designs: DesignSummary[] }>("/designs"),
  get: (id: string) => api<{ design: DesignFull }>(`/designs/${id}`),
  create: (document: DesignDocument, thumbnailUrl?: string) => api<{ design: DesignFull }>("/designs", { method: "POST", json: { document, thumbnailUrl } }),
  update: (id: string, document: DesignDocument, thumbnailUrl?: string) => api<{ design: DesignFull }>(`/designs/${id}`, { method: "PUT", json: { document, thumbnailUrl } }),
  remove: (id: string) => api<void>(`/designs/${id}`, { method: "DELETE" }),
  duplicate: (id: string) => api<{ design: DesignFull }>(`/designs/${id}/duplicate`, { method: "POST" }),
  share: (id: string, enabled: boolean) => api<{ design: DesignSummary }>(`/designs/${id}/share`, { method: "POST", json: { enabled } }),
  shared: (token: string) => api<{ design: DesignFull }>(`/designs/shared/${token}`),
};

export const assetsApi = {
  /** Sube una imagen en dos pasos (registro → PUT → confirmación) y devuelve la referencia pública. */
  async upload(blob: Blob, meta: { name: string; width: number; height: number }) {
    const { asset, upload } = await api<{ asset: RemoteAsset; upload: { method: "PUT"; url: string; headers: Record<string, string> } }>("/assets", { method: "POST", json: { name: meta.name, mime: blob.type, bytes: blob.size, width: meta.width, height: meta.height } });
    const put = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: blob });
    if (!put.ok) throw new ApiError(put.status, "No se pudo subir la imagen");
    return (await api<{ asset: RemoteAsset }>(`/assets/${asset.id}/confirm`, { method: "POST" })).asset;
  },
};
export interface RemoteAsset { id: string; name: string; mime: string; width: number; height: number; bytes: number; createdAt: string; url: string; confirmed: boolean }

export const quotesApi = {
  preview: (document: DesignDocument, extras?: QuoteExtras) => api<{ quote: QuoteBreakdown }>("/quotes/preview", { method: "POST", json: { document, extras } }),
  create: (document: DesignDocument, extras?: QuoteExtras, designId?: string) => api<{ quote: Quote }>("/quotes", { method: "POST", json: { document, extras, designId } }),
};

export const ordersApi = {
  list: () => api<{ orders: Order[] }>("/orders"),
  get: (id: string) => api<{ order: Order }>(`/orders/${id}`),
  create: (data: { quoteId: string; document: DesignDocument; designId?: string; size: string; notes?: string; shipping: Shipping }) => api<{ order: Order }>("/orders", { method: "POST", json: data }),
  cancel: (id: string) => api<{ order: Order }>(`/orders/${id}/cancel`, { method: "POST" }),
};

export const presetsApi = {
  published: () => api<{ presets: SneakerDesignPreset[] }>("/presets"),
  favorites: () => api<{ favorites: string[] }>("/presets/favorites"),
  favorite: (id: string, on: boolean) => api<void>(`/presets/favorites/${id}`, { method: on ? "PUT" : "DELETE" }),
};

export const adminApi = {
  stats: () => api<{ users: number; designs: number; orders: { status: OrderStatus; count: number; total: number }[] }>("/admin/stats"),
  rules: () => api<{ rules: PriceRule[] }>("/admin/price-rules"),
  createRule: (r: Omit<PriceRule, "id">) => api<{ rule: PriceRule }>("/admin/price-rules", { method: "POST", json: r }),
  updateRule: (id: string, r: Partial<Omit<PriceRule, "id">>) => api<{ rule: PriceRule }>(`/admin/price-rules/${id}`, { method: "PUT", json: r }),
  deleteRule: (id: string) => api<void>(`/admin/price-rules/${id}`, { method: "DELETE" }),
  orders: (status?: OrderStatus) => api<{ orders: Order[] }>(`/admin/orders${status ? `?status=${status}` : ""}`),
  order: (id: string) => api<{ order: Order & { documentSnapshot: DesignDocument } }>(`/admin/orders/${id}`),
  setStatus: (id: string, status: OrderStatus, note?: string) => api<{ order: Order }>(`/admin/orders/${id}/status`, { method: "POST", json: { status, note } }),
  presets: () => api<{ presets: SneakerDesignPreset[] }>("/admin/presets"),
  savePreset: (p: SneakerDesignPreset) => api<{ preset: SneakerDesignPreset }>("/admin/presets", { method: "POST", json: p }),
  publishPreset: (id: string, published: boolean) => api<{ preset: SneakerDesignPreset }>(`/admin/presets/${id}/publish`, { method: "POST", json: { published } }),
  deletePreset: (id: string) => api<void>(`/admin/presets/${id}`, { method: "DELETE" }),
};

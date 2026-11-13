/**
 * Pruebas de contrato del API PHP (caja negra por HTTP). Mismas aserciones que tenía el API Node.
 * Requieren un API limpio con APP_ENV=test: `npm run test:api` lo levanta en Docker y lo destruye al final.
 */
import { describe, expect, it } from "vitest";
import { createDocument, setZoneColor, addLayer } from "@/lib/editor/document";
import { getModel, DEFAULT_MODEL_ID } from "@/lib/model/registry";
import type { ImageLayer } from "@/lib/editor/types";

const BASE = (process.env.API_TEST_URL ?? "").replace(/\/$/, "");
let now = new Date("2026-11-09T12:00:00Z");

/** Como app.request() de Hono: ruta relativa; X-Test-Now fija la hora del servidor (solo APP_ENV=test). */
const req = (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("X-Test-Now", now.toISOString());
  return fetch(BASE + path, { ...init, headers });
};
const json = (method: string, path: string, body?: unknown, token?: string) =>
  req(path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });

describe.skipIf(!BASE)("API SneakerLab (PHP)", () => {
  let token: string;
  let adminToken: string;
  let designId: string;
  let quoteId: string;
  let orderId: string;
  const model = getModel(DEFAULT_MODEL_ID);
  let doc = setZoneColor(createDocument(model, "Mi par"), ["right", "left"], "toe", "#ff3366");

  it("health y catálogo público", async () => {
    expect((await req("/api/health")).status).toBe(200);
    const models = await (await req("/api/catalog/models")).json();
    expect(models.models.map((m: { modelId: string }) => m.modelId)).toContain(DEFAULT_MODEL_ID);
    const mats = await (await req("/api/catalog/materials")).json();
    expect(mats.materials.length).toBeGreaterThan(3);
  });

  it("registro, login y /me; el admin sembrado inicia sesión", async () => {
    const r = await json("POST", "/api/auth/register", { email: "Ana@Example.com", password: "secreta123", name: "Ana" });
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.user.role).toBe("customer");
    expect(body.user.email).toBe("ana@example.com");
    token = body.token;
    expect((await json("POST", "/api/auth/register", { email: "ana@example.com", password: "secreta123", name: "Ana" })).status).toBe(409);
    expect((await json("POST", "/api/auth/login", { email: "ana@example.com", password: "mal" })).status).toBe(401);
    const me = await (await json("GET", "/api/auth/me", undefined, token)).json();
    expect(me.user.name).toBe("Ana");
    const a = await json("POST", "/api/auth/login", { email: "admin@test.local", password: "admin-pass-123" });
    expect(a.status).toBe(200);
    adminToken = (await a.json()).token;
    expect((await json("GET", "/api/admin/price-rules", undefined, token)).status).toBe(403);
    expect((await json("GET", "/api/admin/price-rules", undefined)).status).toBe(401);
  });

  it("CRUD de diseños con validación del documento", async () => {
    expect((await json("POST", "/api/designs", { document: doc })).status).toBe(401);
    expect((await json("POST", "/api/designs", { document: { foo: 1 } }, token)).status).toBe(422);
    const r = await json("POST", "/api/designs", { document: doc }, token);
    expect(r.status).toBe(201);
    const { design } = await r.json();
    designId = design.id;
    expect(design.document.shoes.right.zones.toe.color).toBe("#ff3366");
    const list = await (await json("GET", "/api/designs", undefined, token)).json();
    expect(list.designs).toHaveLength(1);
    const upd = await json("PUT", `/api/designs/${designId}`, { name: "Renombrado", document: doc }, token);
    expect((await upd.json()).design.name).toBe("Renombrado");
    const dup = await json("POST", `/api/designs/${designId}/duplicate`, undefined, token);
    expect(dup.status).toBe(201);
    // compartir
    const share = await (await json("POST", `/api/designs/${designId}/share`, { enabled: true }, token)).json();
    expect(share.design.shareToken).toBeTruthy();
    const pub = await req(`/api/designs/shared/${share.design.shareToken}`);
    expect(pub.status).toBe(200);
    await json("POST", `/api/designs/${designId}/share`, { enabled: false }, token);
    expect((await req(`/api/designs/shared/${share.design.shareToken}`)).status).toBe(404);
    // otro usuario no ve el diseño
    const other = await (await json("POST", "/api/auth/register", { email: "otro@example.com", password: "secreta123", name: "Otro" })).json();
    expect((await json("GET", `/api/designs/${designId}`, undefined, other.token)).status).toBe(404);
  });

  it("subida de imagen en dos pasos con driver local", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const r = await json("POST", "/api/assets", { name: "px.png", mime: "image/png", bytes: png.byteLength, width: 1, height: 1 }, token);
    expect(r.status).toBe(201);
    const { asset, upload } = await r.json();
    expect(upload.method).toBe("PUT");
    // confirmar antes de subir → 409
    expect((await json("POST", `/api/assets/${asset.id}/confirm`, undefined, token)).status).toBe(409);
    const path = new URL(upload.url).pathname;
    const put = await req(path, { method: "PUT", body: png });
    expect(put.status).toBe(204);
    const ok = await json("POST", `/api/assets/${asset.id}/confirm`, undefined, token);
    expect(ok.status).toBe(200);
    const got = await req(path);
    expect(got.headers.get("content-type")).toBe("image/png");
    // un archivo que no es imagen se rechaza al confirmar
    const bad = await (await json("POST", "/api/assets", { name: "x.png", mime: "image/png", bytes: 4, width: 1, height: 1 }, token)).json();
    await req(new URL(bad.upload.url).pathname, { method: "PUT", body: "ABCD" });
    expect((await json("POST", `/api/assets/${bad.asset.id}/confirm`, undefined, token)).status).toBe(415);
    // añadimos la imagen al documento para que cuente en la cotización
    const layer: ImageLayer = { id: "l1", name: "px", kind: "image", shoe: "right", zoneId: "outer", x: 0.5, y: 0.5, width: 0.3, rotation: 0, opacity: 1, flipX: false, visible: true, assetId: asset.id };
    doc = addLayer({ ...doc, assets: { [asset.id]: { id: asset.id, name: "px.png", mime: "image/png", width: 1, height: 1, bytes: png.byteLength, createdAt: asset.createdAt, url: asset.url } } }, layer);
  });

  it("cotización: preview sin sesión, formal con vigencia y desglose del servidor", async () => {
    const prev = await json("POST", "/api/quotes/preview", { document: doc });
    expect(prev.status).toBe(200);
    const { quote: p } = await prev.json();
    expect(p.basePrice).toBe(89);
    // toe en 2 pies + outer con imagen = 3 zonas (18) + 1 imagen (9)
    expect(p.customization).toBe(27);
    expect(p.total).toBe(116);
    const r = await json("POST", "/api/quotes", { document: doc, designId, extras: { services: ["gift-box"] } }, token);
    expect(r.status).toBe(201);
    const { quote } = await r.json();
    quoteId = quote.id;
    expect(quote.total).toBe(124);
    expect(new Date(quote.expiresAt).getTime()).toBe(now.getTime() + 72 * 3600_000);
    // intentar inyectar un precio no cambia nada: el cliente no envía importes
    const hacked = await (await json("POST", "/api/quotes/preview", { document: doc, total: 1 })).json();
    expect(hacked.quote.total).toBe(116);
  });

  it("pedidos: coherencia con la cotización, numeración y máquina de estados", async () => {
    const shipping = { fullName: "Ana Pérez", address1: "Calle 1", city: "Quito", country: "EC" };
    // documento modificado respecto a la cotización → 409
    const tampered = setZoneColor(doc, ["right"], "heel", "#00ff00");
    expect((await json("POST", "/api/orders", { quoteId, document: tampered, size: "42", shipping }, token)).status).toBe(409);
    const r = await json("POST", "/api/orders", { quoteId, document: doc, designId, size: "42", shipping }, token);
    expect(r.status).toBe(201);
    const { order } = await r.json();
    orderId = order.id;
    expect(order.number).toBe(1001);
    expect(order.status).toBe("pending");
    expect(order.total).toBe(124);
    // el cliente puede cancelar en pending, no en producción
    const detail = await (await json("GET", `/api/orders/${orderId}`, undefined, token)).json();
    expect(detail.order.history).toHaveLength(1);
    // admin mueve estados
    expect((await json("POST", `/api/admin/orders/${orderId}/status`, { status: "finished" }, adminToken)).status).toBe(409);
    expect((await json("POST", `/api/admin/orders/${orderId}/status`, { status: "in_review", note: "Revisando" }, adminToken)).status).toBe(200);
    expect((await json("POST", `/api/admin/orders/${orderId}/status`, { status: "approved" }, adminToken)).status).toBe(200);
    expect((await json("POST", `/api/admin/orders/${orderId}/status`, { status: "in_production" }, adminToken)).status).toBe(200);
    expect((await json("POST", `/api/orders/${orderId}/cancel`, undefined, token)).status).toBe(409);
    const list = await (await json("GET", "/api/admin/orders?status=in_production", undefined, adminToken)).json();
    expect(list.orders).toHaveLength(1);
    expect(list.orders[0].customer.email).toBe("ana@example.com");
    const full = await (await json("GET", `/api/admin/orders/${orderId}`, undefined, adminToken)).json();
    expect(full.order.history.map((h: { to: string }) => h.to)).toEqual(["pending", "in_review", "approved", "in_production"]);
    // cotización caducada
    now = new Date(now.getTime() + 100 * 3600_000);
    expect((await json("POST", "/api/orders", { quoteId, document: doc, size: "42", shipping }, token)).status).toBe(409);
  });

  it("admin edita reglas de precio y la cotización cambia", async () => {
    const { rules } = await (await json("GET", "/api/admin/price-rules", undefined, adminToken)).json();
    const base = rules.find((r: { kind: string; target: string }) => r.kind === "base_model" && r.target === DEFAULT_MODEL_ID);
    const upd = await json("PUT", `/api/admin/price-rules/${base.id}`, { amount: 99 }, adminToken);
    expect(upd.status).toBe(200);
    const { quote } = await (await json("POST", "/api/quotes/preview", { document: createDocument(model) })).json();
    expect(quote.total).toBe(99);
    expect((await json("POST", "/api/admin/price-rules", { kind: "service", target: "laces-extra", label: "Cordones extra", amount: 3 }, adminToken)).status).toBe(201);
    const stats = await (await json("GET", "/api/admin/stats", undefined, adminToken)).json();
    expect(stats.users).toBe(3);
    expect(stats.orders.find((o: { status: string }) => o.status === "in_production").count).toBe(1);
  });

  it("presets personalizados: borrador, publicación bloqueada por ilustraciones pendientes, favoritos", async () => {
    const preset = { name: "Prueba", category: "graffiti", compatibleModels: [DEFAULT_MODEL_ID], colorPalette: ["#112233"], zones: [{ zoneId: "toe", color: "#112233" }], layers: [], assets: [], status: "draft", pendingAssets: ["falta-logo"], tags: [] };
    const r = await json("POST", "/api/admin/presets", preset, adminToken);
    expect(r.status).toBe(201);
    const { preset: created } = await r.json();
    expect(created.status).toBe("pending-assets");
    expect((await json("POST", `/api/admin/presets/${created.id}/publish`, { published: true }, adminToken)).status).toBe(409);
    await json("PUT", `/api/admin/presets/${created.id}`, { ...preset, pendingAssets: [], status: "published" }, adminToken);
    const pub = await (await req("/api/presets")).json();
    expect(pub.presets.map((p: { id: string }) => p.id)).toContain(created.id);
    expect((await json("POST", "/api/admin/presets", preset, token)).status).toBe(403);
    await json("PUT", `/api/presets/favorites/${created.id}`, undefined, token);
    await json("PUT", `/api/presets/favorites/${created.id}`, undefined, token);
    const fav = await (await json("GET", "/api/presets/favorites", undefined, token)).json();
    expect(fav.favorites).toEqual([created.id]);
    await json("DELETE", `/api/presets/favorites/${created.id}`, undefined, token);
    expect((await (await json("GET", "/api/presets/favorites", undefined, token)).json()).favorites).toEqual([]);
  });

  it("estilos: crear, ocultar, validar en presets y proteger integrados y usados", async () => {
    const pub0 = await (await req("/api/catalog/categories")).json();
    expect(pub0.categories.map((c: { id: string }) => c.id)).toContain("graffiti");
    expect(Object.keys(pub0.groups)).toContain("urban");

    expect((await json("POST", "/api/admin/categories", { label: "Fútbol", group: "urban" }, token)).status).toBe(403);
    const r = await json("POST", "/api/admin/categories", { label: "Fútbol Retro", group: "urban" }, adminToken);
    expect(r.status).toBe(201);
    const { category } = await r.json();
    expect(category).toMatchObject({ id: "futbol-retro", label: "Fútbol Retro", group: "urban", active: true, builtin: false });
    expect((await json("POST", "/api/admin/categories", { label: "Fútbol retro", group: "urban" }, adminToken)).status).toBe(409);
    expect((await json("POST", "/api/admin/categories", { label: "X", group: "no-existe" }, adminToken)).status).toBe(422);

    // Un preset con estilo inexistente se rechaza; con el nuevo, se acepta
    const base = { name: "Con estilo", compatibleModels: [DEFAULT_MODEL_ID], colorPalette: ["#112233"], zones: [], layers: [], assets: [], tags: [] };
    expect((await json("POST", "/api/admin/presets", { ...base, category: "no-existe" }, adminToken)).status).toBe(422);
    const created = await (await json("POST", "/api/admin/presets", { ...base, category: "futbol-retro" }, adminToken)).json();

    // Ocultar: desaparece del catálogo público, sigue en el de admin
    expect((await (await json("PUT", "/api/admin/categories/futbol-retro", { active: false }, adminToken)).json()).category.active).toBe(false);
    expect((await (await req("/api/catalog/categories")).json()).categories.map((c: { id: string }) => c.id)).not.toContain("futbol-retro");
    expect((await (await json("GET", "/api/admin/categories", undefined, adminToken)).json()).categories.map((c: { id: string }) => c.id)).toContain("futbol-retro");

    // Borrado: integrados nunca; propios solo si nadie los usa
    expect((await json("DELETE", "/api/admin/categories/graffiti", undefined, adminToken)).status).toBe(409);
    expect((await json("DELETE", "/api/admin/categories/futbol-retro", undefined, adminToken)).status).toBe(409);
    await json("DELETE", `/api/admin/presets/${created.preset.id}`, undefined, adminToken);
    expect((await json("DELETE", "/api/admin/categories/futbol-retro", undefined, adminToken)).status).toBe(204);
  });
});

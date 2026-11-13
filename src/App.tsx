import { Suspense, lazy, useEffect, type ComponentType, type LazyExoticComponent } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { SEO, type PageSeo } from "@/components/landing/content";

/** La landing no carga three.js; el resto de vistas (WebGL, IndexedDB, Canvas) se cargan bajo demanda. */
const Landing = lazy(() => import("@/components/landing/Landing"));
const EditorShell = lazy(() => import("@/components/editor/EditorShell"));
const MyOrders = lazy(() => import("@/components/orders/MyOrders"));
const AdminOrders = lazy(() => import("@/components/orders/AdminOrders"));
const AdminPricing = lazy(() => import("@/components/orders/AdminPricing"));
const AdminDesigns = lazy(() => import("@/components/designs/AdminDesigns"));
/** Ruta interna para generar las miniaturas del catálogo (`npm run designs:render`). No se enlaza. */
const RenderHarness = lazy(() => import("@/components/designs/RenderHarness"));

function Loading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-[#f4f3f0] text-sm text-neutral-500">
      Cargando…
    </div>
  );
}

function setMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

/** Título, descripción y robots por ruta (Google ejecuta JS; el HTML estático de `/` ya trae los de la landing). */
function Page({ view: View, seo }: { view: LazyExoticComponent<ComponentType>; seo: PageSeo }) {
  useEffect(() => {
    document.title = seo.title;
    setMeta("description", seo.description);
    setMeta("robots", seo.index ? "index, follow" : "noindex, nofollow");
  }, [seo]);
  return <View />;
}

/** `/` es la landing. Los enlaces anteriores al cambio (`/?shared=…`, `/?admin=1`) siguen abriendo el editor. */
function Home() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  if (params.has("shared") || params.has("admin") || params.has("diseno")) return <Navigate to={`/disenar${search}`} replace />;
  return <Page view={Landing} seo={SEO.home} />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/disenar" element={<Page view={EditorShell} seo={SEO.editor} />} />
        <Route path="/orders" element={<Page view={MyOrders} seo={SEO.private("Mis pedidos")} />} />
        <Route path="/admin/orders" element={<Page view={AdminOrders} seo={SEO.private("Pedidos (admin)")} />} />
        <Route path="/admin/pricing" element={<Page view={AdminPricing} seo={SEO.private("Reglas de precio (admin)")} />} />
        <Route path="/admin/designs" element={<Page view={AdminDesigns} seo={SEO.private("Administración de diseños")} />} />
        <Route path="/studio/render" element={<Page view={RenderHarness} seo={SEO.private("Render")} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

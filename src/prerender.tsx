/**
 * Entrada de servidor para el prerender (scripts/prerender.mjs). Renderiza el mismo árbol que
 * src/main.tsx, esperando a las vistas lazy, para que el navegador pueda hidratarlo sin repintar.
 */
import { StrictMode } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { StaticRouter } from "react-router";
import { AppRoutes } from "./App";

export { BRAND, FAQ, SEO } from "@/components/landing/content";

export async function render(url: string): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    <StrictMode>
      <StaticRouter location={url}>
        <AppRoutes />
      </StaticRouter>
    </StrictMode>,
  );
  let html = "";
  for await (const chunk of prelude) html += chunk.toString();
  return html;
}

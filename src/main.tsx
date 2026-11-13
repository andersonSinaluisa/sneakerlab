import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AppRoutes } from "./App";
import "./styles/fonts.css";
import "./styles/globals.css";

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>
);

// `/` llega prerenderizado (scripts/prerender.mjs): se hidrata para no repintar.
// El resto de rutas usan app.html, con #root vacío.
if (root.firstElementChild && location.pathname === "/" && !location.search) hydrateRoot(root, app);
else createRoot(root).render(app);

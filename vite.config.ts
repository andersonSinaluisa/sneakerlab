import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

/** En desarrollo, /api y /uploads van al API PHP (`npm run api:dev`, puerto 8080). */
const API_DEV = process.env.API_DEV_URL ?? "http://localhost:8080";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 3000,
    proxy: { "/api": API_DEV, "/uploads": API_DEV },
  },
  build: { outDir: "dist", chunkSizeWarningLimit: 2500 },
});

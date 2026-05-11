import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "/static/",
  build: {
    outDir: path.resolve(__dirname, "../persona_router/web"),
    emptyOutDir: true,
    assetsDir: "assets",
  },
  server: {
    port: 5173,
    proxy: {
      "/agents": "http://127.0.0.1:8000",
      "/sessions": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
    },
  },
});

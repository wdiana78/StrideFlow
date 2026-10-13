import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the API runs on :8000; requests to /api and /files are proxied there.
const preview = process.env.VITE_DEMO === "1";

export default defineConfig({
  plugins: [react()],
  // The hosted preview is published as one self-contained HTML file.
  base: preview ? "./" : "/",
  build: preview ? { outDir: "dist-preview", assetsInlineLimit: 100000000, rollupOptions: { output: { inlineDynamicImports: true } } } : {},
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/files": "http://localhost:8000",
    },
  },
});

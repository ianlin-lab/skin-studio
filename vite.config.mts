import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // The renderer is loaded from file:// inside the packaged macOS app.
  // Relative asset URLs work there while retaining the normal Vite dev server.
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@renderer": path.resolve(rootDirectory, "src/renderer"),
      "@shared": path.resolve(rootDirectory, "src/shared"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

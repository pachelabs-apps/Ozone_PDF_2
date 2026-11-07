import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// la versión de la app sale de package.json (la usa "Buscar actualizaciones")
const version = pkg.version;

// MuPDF trae su motor en WebAssembly; se excluye del pre-empaquetado para que Vite lo copie tal cual.
export default defineConfig({
  plugins: [react()],
  define: { __VERSION__: JSON.stringify(version) },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  optimizeDeps: { exclude: ["mupdf"] },
  worker: { format: "es" },
  build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 1500 },
});

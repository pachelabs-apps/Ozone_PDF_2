import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// la versión de la app sale de package.json (la usa "Buscar actualizaciones")
const version = pkg.version;

// en el celular (tauri android/ios dev) la app se carga por la red de tu casa: Tauri avisa la IP en TAURI_DEV_HOST
const host = process.env.TAURI_DEV_HOST;

// MuPDF trae su motor en WebAssembly; se excluye del pre-empaquetado para que Vite lo copie tal cual.
export default defineConfig({
  plugins: [react()],
  define: { __VERSION__: JSON.stringify(version) },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  optimizeDeps: { exclude: ["mupdf"] },
  worker: { format: "es" },
  build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 1500 },
});

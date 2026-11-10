import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { idioma } from "./i18n";
import "./estilos.css";

document.documentElement.lang = idioma();

// En Android la app se dibuja detrás de las barras del sistema y el navegador interno no avisa
// cuánto miden; la parte nativa lo deja en window.__ozoneBordes (en compu no existe y no pasa nada).
type Bordes = { arriba: number; abajo: number };
function aplicarBordes() {
  // Si en Android todavía no llegó la medida, se reserva lo de una barra de botones común
  // (48 dp): mejor un poco de aire de más que una herramienta tapada.
  const android = /Android/i.test(navigator.userAgent);
  const b = (window as unknown as { __ozoneBordes?: Bordes }).__ozoneBordes ?? (android ? { arriba: 28, abajo: 48 } : null);
  if (!b) return;
  const r = document.documentElement.style;
  r.setProperty("--borde-arriba", `max(env(safe-area-inset-top, 0px), ${b.arriba}px)`);
  r.setProperty("--borde-abajo", `max(env(safe-area-inset-bottom, 0px), ${b.abajo}px)`);
}
aplicarBordes();
window.addEventListener("ozone-bordes", aplicarBordes);
window.addEventListener("resize", aplicarBordes);
createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { idioma } from "./i18n";
import "./estilos.css";

document.documentElement.lang = idioma();
createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

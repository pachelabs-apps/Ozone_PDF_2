import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const CLAVE_VISTO = "ozone.carrilVisto";

// La fila de herramientas de abajo en el celular: no entran todas, así que se desliza.
// Para que se note que hay más:
// - los botones se ajustan de ancho para que el último visible quede cortado a la mitad;
// - en el borde que tiene más herramientas aparece un degradado con una flecha (tocarla avanza);
// - la primera vez, la fila se desliza sola un poco y vuelve.
export default function Carril({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [izq, setIzq] = useState(false);
  const [der, setDer] = useState(false);

  useEffect(() => {
    const l = ref.current;
    if (!l) return;
    const celular = window.matchMedia("(max-width: 760px)");
    const botones = () => Array.from(l.querySelectorAll<HTMLElement>(".herr"));

    const actualizar = () => {
      setIzq(l.scrollLeft > 4);
      setDer(l.scrollLeft + l.clientWidth < l.scrollWidth - 4);
    };
    const medir = () => {
      const bs = botones();
      bs.forEach((b) => { b.style.width = ""; b.style.minWidth = ""; });
      if (celular.matches && bs.length && l.scrollWidth > l.clientWidth + 2) {
        // Cada botón conserva su ancho; se le suma a todos lo mismo para que el botón que
        // cruza el borde quede justo a la mitad (con la mayor cantidad posible de botones enteros).
        const gap = parseFloat(getComputedStyle(l).columnGap) || 0;
        const anchos = bs.map((b) => b.getBoundingClientRect().width);
        const inicioL = l.getBoundingClientRect().left - l.scrollLeft;
        const W = l.clientWidth;
        let extra = 0;
        for (let k = 0, antes = 0; k < bs.length; k++) {
          // "antes": desde el borde izquierdo hasta el comienzo del botón k (incluye separadores y bordes)
          antes = bs[k].getBoundingClientRect().left - inicioL;
          const e = (W - antes - anchos[k] / 2) / (k + 0.5);
          if (e < 0) break;
          extra = e;
        }
        bs.forEach((b, i) => { b.style.minWidth = Math.floor(anchos[i] + extra) + "px"; });
      }
      actualizar();
    };

    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(l);
    l.addEventListener("scroll", actualizar, { passive: true });

    // el empujoncito de la primera vez
    let t1 = 0, t2 = 0;
    let visto = false;
    try { visto = localStorage.getItem(CLAVE_VISTO) === "1"; } catch { /* nada */ }
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("a11y-sin-movimiento");
    if (!visto && celular.matches && l.scrollWidth > l.clientWidth + 2) {
      try { localStorage.setItem(CLAVE_VISTO, "1"); } catch { /* nada */ }
      if (!quieto) {
        t1 = window.setTimeout(() => l.scrollTo({ left: Math.min(110, l.scrollWidth - l.clientWidth), behavior: "smooth" }), 1100);
        t2 = window.setTimeout(() => l.scrollTo({ left: 0, behavior: "smooth" }), 1900);
      }
    }
    return () => {
      obs.disconnect();
      l.removeEventListener("scroll", actualizar);
      window.clearTimeout(t1); window.clearTimeout(t2);
    };
  }, []);

  const avanzar = (sentido: 1 | -1) => {
    const l = ref.current;
    if (l) l.scrollBy({ left: sentido * l.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <div className="carril">
      <div className={className} ref={ref}>{children}</div>
      <button type="button" className={"carril__flecha carril__flecha--izq" + (izq ? " carril__flecha--ver" : "")}
        tabIndex={-1} aria-hidden onClick={() => avanzar(-1)}><ChevronLeft size={18} /></button>
      <button type="button" className={"carril__flecha carril__flecha--der" + (der ? " carril__flecha--ver" : "")}
        tabIndex={-1} aria-hidden onClick={() => avanzar(1)}><ChevronRight size={18} /></button>
    </div>
  );
}
